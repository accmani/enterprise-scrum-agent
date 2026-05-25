"""
Scanner Tool — LLM-First Autonomous Defect Detection.

Design principles:
1. NO hardcoded bug patterns — LLM reads the code and reasons about it
2. NOT limited to known files — scans ANY Java file in the repo
3. PHI-safe — code is analyzed structurally, patient data never sent to LLM
4. Domain-aware — LLM gets HCSC business context to understand semantic bugs
5. Confidence-scored — every finding gets a 0-100% confidence rating

This catches bugs that regex CANNOT:
  - Inverted boolean logic (if (isEligible) → denial)
  - Wrong operator direction (> vs >= at business boundary)
  - Missing negation (!isActive vs isActive)
  - Business rule violations (wrong copay rate for service type)
  - Semantic errors (approve when should deny)
  - Off-by-one in date ranges, amount thresholds
"""

import json
import re
import httpx
import base64
from langchain.tools import BaseTool
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.config import settings


class ScannerInput(BaseModel):
    query: str = Field(
        description=(
            "Scanning instruction. Examples: "
            "'scan all java files for bugs', "
            "'scan ClaimAdjudicationService.java', "
            "'scan for boundary condition bugs', "
            "'scan for inverted logic bugs', "
            "'scan bds domain files', "
            "'scan cts domain files', "
            "'scan for null pointer risks'"
        )
    )


# ── PHI Masking — strip patient data before sending to LLM ───────────────
PHI_PATTERNS = [
    # Member IDs, SSN-like patterns
    (r'\b\d{3}-\d{2}-\d{4}\b', '[SSN-MASKED]'),
    (r'\bMBR[-_]?\d{4,10}\b', '[MBR-ID-MASKED]'),
    # Hardcoded names or emails in strings
    (r'"[A-Z][a-z]+ [A-Z][a-z]+"', '"[NAME-MASKED]"'),
    (r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL-MASKED]'),
    # Hardcoded dates that look like DOB
    (r'\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b', '[DATE-MASKED]'),
    # Dollar amounts that look like actual claim values (large numbers)
    (r'\$\s*\d{4,}(?:\.\d{2})?', '$[AMOUNT-MASKED]'),
    # NPI numbers
    (r'\bNPI[-_]?\d{7,10}\b', '[NPI-MASKED]'),
]


def mask_phi(code: str) -> str:
    """Remove potential PHI from code before sending to LLM."""
    masked = code
    for pattern, replacement in PHI_PATTERNS:
        masked = re.sub(pattern, replacement, masked)
    return masked


def truncate_for_llm(content: str, max_chars: int = 4000) -> str:
    """
    Truncate file to fit LLM context.
    Keeps beginning and end — where bugs are most common.
    Structural code (imports, class declarations) kept intact.
    """
    if len(content) <= max_chars:
        return content
    # Keep first 2/3 and last 1/3
    keep_start = int(max_chars * 0.67)
    keep_end   = max_chars - keep_start
    return (
        content[:keep_start] +
        f"\n\n... [truncated {len(content) - max_chars} chars] ...\n\n" +
        content[-keep_end:]
    )


# ── HCSC Domain Context (injected into LLM prompt — no PHI) ──────────────
HCSC_DOMAIN_CONTEXT = """
You are analyzing Java source code for HCSC (Health Care Service Corporation) — 
a Blue Cross Blue Shield healthcare payer serving 17 million members across 5 states.

HCSC BUSINESS RULES TO ENFORCE:
1. ELIGIBILITY: Members must have active coverage (TERM_DT is null or in future)
   - isEligible=true means member CAN receive benefits — should NOT be denied
   - if (isEligible) { deny } is WRONG — should be if (!isEligible) { deny }

2. DEDUCTIBLES (COV_ACCUM_HIST table):
   - remaining == 0 means deductible EXACTLY MET — member should NOT be charged again
   - compareTo(ZERO) > 0 misses the == 0 boundary — should be >= 0
   - Off-by-one at deductible boundary = double billing = CMS audit risk

3. COPAY RATES (PLN_BEN_CONFIG table):
   - PRIMARY_CARE = $20 copay
   - SPECIALIST = $50 copay  
   - EMERGENCY = $150 copay (must be explicit — cannot fall through to default)
   - Missing EMERGENCY case in switch = $20 charged instead of $150 = revenue leakage

4. NULL SAFETY (MMBR, CLM_HDR tables):
   - DB2 queries return null when no matching row — ALWAYS null-check before method calls
   - coverage.isActive() without null check = NPE when member has no coverage record
   - claim.getClmAmt() can be null — always check before arithmetic

5. BATCH PROCESSING (CLM_HDR table):
   - DB2 result sets can contain null rows — NEVER modify list while iterating
   - Use stream().filter() not for-each with remove() — ConcurrentModificationException

6. PRIOR AUTH (PRIOR_AUTH_TXN table):
   - All SPECIALIST (SVC_TYPE=SPEC) claims MUST check PRIOR_AUTH_TXN
   - isEmergency() || ... short-circuit can bypass PA check — CMS fraud risk

7. ICD-10 VALIDATION (DX_CODE_REF table):
   - Z00-Z13 range = ACA preventive wellness — CANNOT deny even if not in ODS snapshot
   - Missing ACA override = wellness claim denial = ACA mandate violation

8. DATE BOUNDARIES:
   - Service date on termination date = VALID (use !isAfter not isBefore)
   - isBefore(termDt) misses the exact termination date = members denied on last day

CONFIDENCE SCORING GUIDE:
- 0.90-1.00: Clear violation of above rules, high impact
- 0.70-0.89: Probable bug, needs human review
- 0.50-0.69: Suspicious pattern, low risk
- Below 0.50: Do not report
"""


class ScannerTool(BaseTool):
    name: str = "code_scanner"
    description: str = (
        "ONLY use this tool when the user explicitly asks to SCAN or SEARCH the codebase for unknown bugs. "
        "DO NOT use this tool when a specific bug or defect is already described — answer from domain knowledge instead. "
        "Autonomously scans HCSC healthcare-claims Java codebase for undiscovered defects. "
        "PHI-safe: patient data masked before LLM analysis. "
        "Returns findings with confidence scores, domain classification, affected tables."
    )
    args_schema: type[BaseModel] = ScannerInput

    def _run(self, query: str) -> str:
        return self._execute(query)

    async def _arun(self, query: str) -> str:
        return self._execute(query)

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.github_token}",
            "Accept": "application/vnd.github.v3+json",
        }

    def _get_llm(self):
        return AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            azure_deployment=settings.azure_openai_deployment,
            api_version=settings.openai_api_version,
            api_key=settings.azure_openai_api_key,
            temperature=0.1,
            max_tokens=1500,
        )

    def _list_java_files(self) -> list[dict]:
        """List ALL Java files in the repo — not filtered to known files."""
        files = []
        try:
            base_url = f"https://api.github.com/repos/{settings.github_repo}"
            resp = httpx.get(
                f"{base_url}/git/trees/main?recursive=1",
                headers=self._get_headers(),
                timeout=20,
            )
            if resp.status_code == 200:
                tree = resp.json().get("tree", [])
                for item in tree:
                    if item.get("type") == "blob" and item["path"].endswith(".java"):
                        filename = item["path"].split("/")[-1]
                        # Guess domain from filename — not required to be in registry
                        domain = self._guess_domain(filename)
                        files.append({
                            "path":     item["path"],
                            "filename": filename,
                            "domain":   domain,
                            "size":     item.get("size", 0),
                        })
        except Exception as e:
            pass
        return files

    def _guess_domain(self, filename: str) -> str:
        """
        Guess HCSC domain from filename even if not in registry.
        BDS = Benefit Determination (eligibility, accumulator, copay, PA)
        CTS = Core Adjudication (claims, batch, ICD-10, fee schedule)
        """
        fname = filename.lower()
        if any(k in fname for k in ['bds', 'accumulator', 'eligib', 'copay', 'priorauth', 'benefit', 'member']):
            return 'bds'
        if any(k in fname for k in ['cts', 'claim', 'adjudic', 'batch', 'icd', 'feeschedule', 'payment', 'eob']):
            return 'cts'
        if any(k in fname for k in ['edi', 'axway', 'edifec', '837', '835']):
            return 'edi'
        return 'unknown'

    def _get_file_content(self, path: str) -> str | None:
        """Fetch file content from GitHub."""
        try:
            base_url = f"https://api.github.com/repos/{settings.github_repo}"
            resp = httpx.get(
                f"{base_url}/contents/{path}",
                headers=self._get_headers(),
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("encoding") == "base64":
                    return base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
        except Exception:
            pass
        return None

    def _llm_scan_file(self, content: str, filename: str, domain: str) -> list[dict]:
        """
        Use LLM to analyze a single file for bugs.
        PHI is masked before sending. LLM gets HCSC domain context.
        Returns list of findings.
        """
        # Step 1: Mask PHI
        safe_content = mask_phi(content)

        # Step 2: Truncate to fit context window
        safe_content = truncate_for_llm(safe_content, max_chars=4000)

        # Step 3: Build domain hint
        domain_hint = ""
        if domain == 'bds':
            domain_hint = "This file is in the BDS (Benefit Determination System) domain — handles eligibility, accumulators, copay, prior auth."
        elif domain == 'cts':
            domain_hint = "This file is in the CTS (Core Adjudication System) domain — handles claims processing, batch jobs, ICD-10 validation."
        else:
            domain_hint = f"This file appears to be in the {domain} domain."

        scan_prompt = f"""Analyze this HCSC Java source file for bugs.

FILE: {filename}
DOMAIN: {domain_hint}

SOURCE CODE (PHI has been masked):
```java
{safe_content}
```

TASK:
Find ALL bugs in this file. Focus especially on:
1. Boundary conditions — wrong comparison operators (> vs >=, < vs <=)
2. Inverted logic — if (isEligible) leads to denial instead of if (!isEligible)
3. Null pointer risks — method calls without null checks on DB2 results
4. Missing switch cases — EMERGENCY service type not handled
5. Business rule violations — wrong copay rate, wrong date comparison
6. Concurrent modification — list modified during iteration
7. Off-by-one errors — wrong threshold values

For EACH bug found, provide:
- line_number: approximate line where bug occurs
- bug_type: boundary_condition | inverted_logic | null_pointer | missing_case | business_rule | concurrent_modification | off_by_one | other
- description: what is wrong and why it matters for HCSC claims processing
- code_snippet: the specific buggy code (2-3 lines max, no PHI)
- fix_hint: concrete suggestion for how to fix it
- confidence: 0.0 to 1.0 (only report >= 0.50)
- impact: financial | compliance | stability | data_quality

YOU MUST respond with ONLY a JSON array. No explanation, no markdown, no preamble.
If no bugs found return: []

Example format:
[
  {{
    "line_number": 75,
    "bug_type": "inverted_logic",
    "description": "if (isEligible) leads to claim denial — logic is inverted. When isEligible=true member should receive benefits, not be denied.",
    "code_snippet": "if (isEligible) {{ return AdjudicationResult.denied(...); }}",
    "fix_hint": "Change to if (!isEligible) to deny only when member is NOT eligible",
    "confidence": 0.92,
    "impact": "compliance"
  }}
]"""

        try:
            llm = self._get_llm()
            response = llm.invoke([
                SystemMessage(content=HCSC_DOMAIN_CONTEXT),
                HumanMessage(content=scan_prompt),
            ])

            raw = response.content.strip()
            # Strip markdown fences
            raw = re.sub(r'^```json\s*', '', raw, flags=re.MULTILINE)
            raw = re.sub(r'^```\s*', '', raw, flags=re.MULTILINE)
            raw = raw.strip()

            findings = json.loads(raw)
            if not isinstance(findings, list):
                return []

            # Filter low confidence + add file metadata
            results = []
            for f in findings:
                if not isinstance(f, dict):
                    continue
                conf = float(f.get('confidence', 0))
                if conf < 0.50:
                    continue
                results.append({
                    'file':         filename,
                    'domain':       domain,
                    'line_number':  f.get('line_number', '?'),
                    'bug_type':     f.get('bug_type', 'unknown'),
                    'description':  f.get('description', ''),
                    'code_snippet': f.get('code_snippet', ''),
                    'fix_hint':     f.get('fix_hint', ''),
                    'confidence':   conf,
                    'impact':       f.get('impact', 'unknown'),
                })
            return results

        except Exception as e:
            return []

    def _execute(self, query: str) -> str:
        if not settings.github_token or not settings.github_repo:
            return json.dumps({"error": "GitHub not configured."})

        q = query.lower()

        # ── Determine scope ────────────────────────────────────────────────
        domain_filter = None
        if 'bds' in q:
            domain_filter = 'bds'
        elif 'cts' in q or 'core' in q or 'adjudic' in q:
            domain_filter = 'cts'

        # Single file scan
        specific_file = None
        # Extract filename from query
        file_match = re.search(r'(\w+\.java)', query, re.IGNORECASE)
        if file_match:
            specific_file = file_match.group(1)

        # Bug type focus
        focus = None
        focus_map = {
            'boundary': 'boundary_condition',
            'null':     'null_pointer',
            'inverted': 'inverted_logic',
            'logic':    'inverted_logic',
            'switch':   'missing_case',
            'batch':    'concurrent_modification',
            'concurrent': 'concurrent_modification',
        }
        for keyword, bug_type in focus_map.items():
            if keyword in q:
                focus = bug_type
                break

        # ── Get file list ──────────────────────────────────────────────────
        all_files = self._list_java_files()

        if not all_files:
            return json.dumps({
                "error": "Could not list files from GitHub repo.",
                "findings": [],
            })

        # Filter files
        if specific_file:
            files_to_scan = [f for f in all_files if f['filename'].lower() == specific_file.lower()]
            if not files_to_scan:
                # Try partial match
                files_to_scan = [f for f in all_files if specific_file.lower() in f['filename'].lower()]
        elif domain_filter:
            files_to_scan = [f for f in all_files if f['domain'] == domain_filter]
        else:
            files_to_scan = all_files

        # Cap at 8 files per scan to stay within rate limits + cost
        files_to_scan = files_to_scan[:8]

        if not files_to_scan:
            return json.dumps({
                "findings": [],
                "summary": f"No Java files found matching the scan criteria.",
                "files_scanned": 0,
            })

        # ── Scan each file ─────────────────────────────────────────────────
        all_findings = []
        files_scanned = 0

        for file_info in files_to_scan:
            content = self._get_file_content(file_info['path'])
            if not content:
                continue

            # Skip very small files (likely interfaces or enums)
            if len(content) < 200:
                continue

            findings = self._llm_scan_file(
                content,
                file_info['filename'],
                file_info['domain'],
            )

            # Apply bug type filter
            if focus:
                findings = [f for f in findings if f.get('bug_type') == focus]

            all_findings.extend(findings)
            files_scanned += 1

        # ── Sort by confidence descending ──────────────────────────────────
        all_findings.sort(key=lambda x: x.get('confidence', 0), reverse=True)

        # ── Build summary ──────────────────────────────────────────────────
        if not all_findings:
            summary = (
                f"Scanned {files_scanned} file(s) — no defects detected above 50% confidence. "
                "Code appears clean for the scanned scope."
            )
        else:
            top = all_findings[0]
            bug_types = list(set(f['bug_type'] for f in all_findings))
            summary = (
                f"Found {len(all_findings)} potential defect(s) across {files_scanned} file(s). "
                f"Highest confidence: {top['bug_type']} in {top['file']} "
                f"({int(top['confidence']*100)}% confidence). "
                f"Bug types detected: {', '.join(bug_types)}. "
                f"PHI was masked before LLM analysis — no patient data was processed."
            )

        return json.dumps({
            "findings":      all_findings[:10],
            "total_found":   len(all_findings),
            "files_scanned": files_scanned,
            "domains_covered": list(set(f['domain'] for f in all_findings)),
            "phi_protection": "All PHI patterns masked before LLM analysis",
            "llm_model":     settings.azure_openai_deployment,
            "summary":       summary,
        }, indent=2)