"""
Evaluator Tool — LLM self-evaluation of agent-generated fixes.

Option B implementation:
- Agent generates a fix
- This tool asks the LLM to score its own output
- Returns structured score + gaps + refinement suggestions
- Score below threshold triggers refinement loop

Used in step 6 of the SDLC pipeline after auto_fix completes.
"""

import json
import re
from langchain_classic.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_openai import AzureChatOpenAI
from app.config import settings


class EvaluatorInput(BaseModel):
    query: str = Field(
        description=(
            "Evaluate a code fix. Pass as JSON string with: "
            "fixed_code (the generated fix), "
            "bug_type (boundary_condition|null_pointer|concurrent_modification|missing_case|logic_bypass), "
            "domain (bds|cts), "
            "bug_description (what the bug does), "
            "business_impact (financial/compliance impact). "
            "Example: {\"fixed_code\": \"if (x >= 0)\", \"bug_type\": \"boundary_condition\", "
            "\"domain\": \"bds\", \"bug_description\": \"deductible off-by-one\", "
            "\"business_impact\": \"CMS audit risk\"}"
        )
    )


# ── Evaluation rubrics per bug type ───────────────────────────────────────

EVAL_RUBRICS = {
    'boundary_condition': {
        'criteria': [
            {
                'key': 'boundary_correct',
                'label': 'Boundary condition correctly handled',
                'question': 'Does the fix correctly handle the boundary case (== 0, exact threshold)? Does it use >= instead of >?',
                'weight': 35,
            },
            {
                'key': 'null_safety',
                'label': 'Null safety before method calls',
                'question': 'Is there a null check before calling methods on DB2 repository results? Could this throw NPE?',
                'weight': 25,
            },
            {
                'key': 'test_boundary',
                'label': 'Test covers exact boundary case',
                'question': 'Does the fix include or reference a test that specifically tests the == 0 boundary value?',
                'weight': 25,
            },
            {
                'key': 'business_rule_documented',
                'label': 'Business rule documented in code',
                'question': 'Is there a comment explaining WHY this boundary value matters (CMS rule, deductible exhaustion, etc)?',
                'weight': 15,
            },
        ],
        'threshold': 0.80,
        'domain_context': 'HCSC BDS accumulator logic — COV_ACCUM_HIST remaining == 0 means deductible exactly met. CMS billing rules prohibit charging again at this boundary.',
    },
    'null_pointer': {
        'criteria': [
            {
                'key': 'null_check_present',
                'label': 'Explicit null check added',
                'question': 'Is there an explicit null check (if x == null) before calling any method on the DB2 result object?',
                'weight': 40,
            },
            {
                'key': 'hipaa_safe_message',
                'label': 'HIPAA-safe error message',
                'question': 'Does the denial/error message avoid exposing PHI? Is it using a member ID reference rather than personal details?',
                'weight': 25,
            },
            {
                'key': 'correct_return',
                'label': 'Correct return type and flow',
                'question': 'Does the fix return the correct type? Does control flow properly after the null check?',
                'weight': 20,
            },
            {
                'key': 'test_null_case',
                'label': 'Test for null DB2 result',
                'question': 'Is there a test case that passes null as the DB2 repository return value?',
                'weight': 15,
            },
        ],
        'threshold': 0.80,
        'domain_context': 'HCSC BDS eligibility — MMBR table returns null when member has no active coverage record. Null must be handled before calling isActive() or getTermDt().',
    },
    'concurrent_modification': {
        'criteria': [
            {
                'key': 'no_modify_during_iteration',
                'label': 'No list modification during iteration',
                'question': 'Does the fix avoid modifying the source list while iterating? Does it use stream().filter() or a separate list?',
                'weight': 40,
            },
            {
                'key': 'null_filter',
                'label': 'Null rows filtered before processing',
                'question': 'Does the fix filter out null CLM_HDR rows before the processing loop?',
                'weight': 30,
            },
            {
                'key': 'amt_null_check',
                'label': 'Null amount check included',
                'question': 'Is getClmAmt() null-checked as well as the row itself?',
                'weight': 20,
            },
            {
                'key': 'test_mixed_data',
                'label': 'Test with mixed null/valid data',
                'question': 'Is there a test that passes a list containing both null and valid claim rows?',
                'weight': 10,
            },
        ],
        'threshold': 0.82,
        'domain_context': 'HCSC CTS batch processor — CLM_HDR result sets from DB2 can contain null rows. Nightly batch must handle mixed null/valid claim lists without crashing.',
    },
    'missing_case': {
        'criteria': [
            {
                'key': 'case_added',
                'label': 'Missing case explicitly added',
                'question': 'Is the missing EMERGENCY (or other) case explicitly added to the switch statement?',
                'weight': 40,
            },
            {
                'key': 'correct_value_returned',
                'label': 'Correct value returned for new case',
                'question': 'Does the new case return the correct value (getErCopay() not getPcCopay())?',
                'weight': 30,
            },
            {
                'key': 'default_preserved',
                'label': 'Default case still present',
                'question': 'Is the default case still present for unknown service types?',
                'weight': 20,
            },
            {
                'key': 'test_all_cases',
                'label': 'Test covers all service types',
                'question': 'Is there a test that verifies all three service types return the correct copay?',
                'weight': 10,
            },
        ],
        'threshold': 0.80,
        'domain_context': 'HCSC BDS copay lookup — PLN_BEN_CONFIG has distinct copay rates per service type. EMERGENCY must return erCopay ($150), not pcCopay ($20).',
    },
    'logic_bypass': {
        'criteria': [
            {
                'key': 'bypass_removed',
                'label': 'Short-circuit bypass removed',
                'question': 'Is the isEmergency() short-circuit OR condition removed or refactored to not bypass the PA check?',
                'weight': 40,
            },
            {
                'key': 'pa_check_explicit',
                'label': 'PA check explicitly enforced',
                'question': 'Is PRIOR_AUTH_TXN explicitly queried for specialist claims regardless of emergency status?',
                'weight': 35,
            },
            {
                'key': 'compliance_maintained',
                'label': 'CMS PA compliance maintained',
                'question': 'Does the fix ensure all SVC_TYPE=SPEC claims go through PA validation?',
                'weight': 15,
            },
            {
                'key': 'test_specialist',
                'label': 'Test for specialist PA requirement',
                'question': 'Is there a test that verifies specialist claims require PA even when isEmergency() is true?',
                'weight': 10,
            },
        ],
        'threshold': 0.85,
        'domain_context': 'HCSC BDS prior auth gateway — all SVC_TYPE=SPEC claims MUST check PRIOR_AUTH_TXN. Short-circuit with isEmergency() is a CMS fraud risk.',
    },
    'missing_validation': {
        'criteria': [
            {
                'key': 'validation_added',
                'label': 'Validation logic added',
                'question': 'Is the missing validation (null check, range check, allowlist supplement) explicitly added?',
                'weight': 40,
            },
            {
                'key': 'correct_fallback',
                'label': 'Correct fallback/override logic',
                'question': 'When validation fails, does the fix apply the correct override (ACA mandate, regulatory rule)?',
                'weight': 30,
            },
            {
                'key': 'audit_logged',
                'label': 'Gap or override logged for audit',
                'question': 'Is the validation gap or override logged to an audit table for compliance reporting?',
                'weight': 20,
            },
            {
                'key': 'test_edge_case',
                'label': 'Test for the specific validation gap',
                'question': 'Is there a test that specifically reproduces the validation gap (e.g. Z00.00 not in ODS allowlist)?',
                'weight': 10,
            },
        ],
        'threshold': 0.80,
        'domain_context': 'HCSC CTS ICD-10 validation — DX_CODE_REF ODS snapshot may be missing Z00-Z13 ACA wellness codes. ACA mandate requires these claims be approved regardless of allowlist.',
    },
}

DEFAULT_RUBRIC = EVAL_RUBRICS['boundary_condition']


class EvaluatorTool(BaseTool):
    name: str = "evaluator_tool"
    description: str = (
        "Evaluates the quality of a generated code fix using LLM self-evaluation. "
        "Pass the fixed_code, bug_type, domain, bug_description and business_impact. "
        "Returns a confidence score (0.0-1.0), per-criterion scores, identified gaps, "
        "and refinement suggestions. Use this after github_integration auto_fix "
        "to verify fix quality before creating the PR."
    )
    args_schema: type[BaseModel] = EvaluatorInput

    def _get_llm(self):
        return AzureChatOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            azure_deployment=settings.azure_openai_deployment,
            api_version=settings.openai_api_version,
            api_key=settings.azure_openai_api_key,
            temperature=0.1,
            max_tokens=1000,
        )

    def _run(self, query: str) -> str:
        return self._execute(query)

    async def _arun(self, query: str) -> str:
        return self._execute(query)

    def _execute(self, query: str) -> str:
        # Parse input
        try:
            params = json.loads(query)
        except Exception:
            # Try to extract from plain text
            params = {
                'fixed_code': query,
                'bug_type': 'boundary_condition',
                'domain': 'bds',
                'bug_description': 'unknown',
                'business_impact': 'unknown',
            }

        fixed_code      = params.get('fixed_code', '')
        bug_type        = params.get('bug_type', 'boundary_condition')
        domain          = params.get('domain', 'bds')
        bug_description = params.get('bug_description', '')
        business_impact = params.get('business_impact', '')

        # Get rubric for this bug type
        rubric = EVAL_RUBRICS.get(bug_type, DEFAULT_RUBRIC)
        criteria = rubric['criteria']
        threshold = rubric['threshold']
        domain_ctx = rubric['domain_context']

        # Build evaluation prompt
        criteria_text = '\n'.join([
            f"{i+1}. [{c['key']}] {c['label']} (weight: {c['weight']}%)\n"
            f"   Question: {c['question']}"
            for i, c in enumerate(criteria)
        ])

        eval_prompt = f"""You are a senior HCSC healthcare claims engineer evaluating a code fix.

DOMAIN CONTEXT:
{domain_ctx}

BUG TYPE: {bug_type}
BUG DESCRIPTION: {bug_description}
BUSINESS IMPACT: {business_impact}

GENERATED FIX TO EVALUATE:
```java
{fixed_code}
```

EVALUATION CRITERIA:
{criteria_text}

Score each criterion from 0-10:
- 10: Fully addressed, production-ready
- 7-9: Mostly correct, minor gaps
- 4-6: Partially addressed, needs improvement  
- 0-3: Missing or incorrect

You MUST respond with ONLY valid JSON, no other text:
{{
  "scores": {{
    {', '.join([f'"{c["key"]}": <0-10>' for c in criteria])}
  }},
  "overall": <weighted_average_0.0_to_1.0>,
  "confidence_label": "<High|Medium|Low>",
  "gaps": ["<specific issue 1>", "<specific issue 2>"],
  "refinement_suggestions": ["<concrete suggestion 1>", "<concrete suggestion 2>"],
  "production_ready": <true|false>,
  "reviewer_notes": "<one sentence for the human reviewer>"
}}"""

        try:
            llm = self._get_llm()
            from langchain_core.messages import HumanMessage
            response = llm.invoke([HumanMessage(content=eval_prompt)])
            raw = response.content.strip()

            # Strip markdown fences if present
            raw = re.sub(r'^```json\s*', '', raw, flags=re.MULTILINE)
            raw = re.sub(r'^```\s*', '', raw, flags=re.MULTILINE)
            raw = raw.strip()

            result = json.loads(raw)

            # Recompute overall as weighted average to be sure
            weighted = sum(
                (result['scores'].get(c['key'], 5) / 10) * c['weight']
                for c in criteria
            ) / 100
            result['overall'] = round(weighted, 3)
            result['threshold'] = threshold
            result['needs_refinement'] = weighted < threshold
            result['bug_type'] = bug_type
            result['domain'] = domain

            return json.dumps(result, indent=2)

        except Exception as e:
            # Fallback — return a basic score if LLM fails
            fallback_score = 0.75
            return json.dumps({
                'scores': {c['key']: 7 for c in criteria},
                'overall': fallback_score,
                'confidence_label': 'Medium',
                'gaps': ['Could not perform full LLM evaluation'],
                'refinement_suggestions': ['Manual review recommended'],
                'production_ready': False,
                'reviewer_notes': f'Automated evaluation failed: {str(e)[:100]}. Manual review required.',
                'threshold': threshold,
                'needs_refinement': True,
                'bug_type': bug_type,
                'domain': domain,
                'error': str(e)[:200],
            }, indent=2)
