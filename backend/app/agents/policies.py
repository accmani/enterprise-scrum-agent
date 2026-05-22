"""
Defect Policies — purpose-built guard rails per defect type.

Each policy defines:
- domain: which HCSC system owns this defect (bds | cts | edi | ims)
- allowed_files: only these files can be modified
- allowed_tables: only these DB2/ODS tables can be read
- compliance_checks: mandatory checks before PR merges
- review_persona: who reviews the PR
- tools: which tools are available for this defect type
- max_iterations: hard cap on agent reasoning loops
- system_prompt_suffix: domain-specific instructions injected into agent
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class DefectPolicy:
    domain: str                          # bds | cts | edi | ims | general
    allowed_files: List[str]             # files agent can commit to
    allowed_tables: List[str]            # DB2/ODS tables agent can read
    compliance_checks: List[str]         # hipaa | cms_billing | aca_mandate
    review_persona: str                  # who reviews the PR
    tools: List[str]                     # tool names available
    max_iterations: int = 5             # hard cap on ReAct loop
    system_prompt_suffix: str = ""       # injected into agent prompt


# ── BDS Defect Policies ────────────────────────────────────────────────────

BDS_BOUNDARY_CONDITION = DefectPolicy(
    domain='bds',
    allowed_files=[
        'BdsAccumulatorService.java',
        'BdsCopayLookupService.java',
        'BdsEligibilityService.java',
    ],
    allowed_tables=[
        'HCSC_ODS.COV_ACCUM_HIST',
        'HCSC_DB2.PLN_BEN_CONFIG',
        'HCSC_DB2.MMBR',
    ],
    compliance_checks=['hipaa', 'cms_billing'],
    review_persona='bds_architect',
    tools=['design_agent', 'qa_agent', 'github_integration',
           'jira_integration', 'code_review_agent', 'estimation_tool'],
    max_iterations=5,
    system_prompt_suffix="""
DOMAIN POLICY — BDS Boundary Condition Defect:
- You are operating in the BDS (Benefit Determination System) domain
- Only modify files in BdsAccumulatorService.java or BdsCopayLookupService.java
- Only reference these DB2/ODS tables: COV_ACCUM_HIST, PLN_BEN_CONFIG, MMBR
- The fix must handle the == 0 boundary case correctly for deductible exhaustion
- CMS billing compliance check is mandatory — incorrect boundaries cause audit exposure
- Do NOT touch CTS tables (CLM_HDR, CLM_LINE) — those are a different domain
""",
)

BDS_NULL_POINTER = DefectPolicy(
    domain='bds',
    allowed_files=[
        'BdsEligibilityService.java',
        'CoreAdjApiWrapper.java',
    ],
    allowed_tables=[
        'HCSC_DB2.MMBR',
        'HCSC_ODS.COV_ACCUM_HIST',
    ],
    compliance_checks=['hipaa'],
    review_persona='bds_architect',
    tools=['design_agent', 'qa_agent', 'github_integration',
           'jira_integration', 'code_review_agent', 'estimation_tool'],
    max_iterations=5,
    system_prompt_suffix="""
DOMAIN POLICY — BDS Null Pointer Defect:
- You are operating in the BDS (Benefit Determination System) domain
- The fix must add explicit null checks before calling any method on DB2 result objects
- MMBR table lookups can return null when member has no active coverage record
- Null members must be denied with a clear audit message — not crash the system
- HIPAA compliance: the denial message must not expose PHI in logs
""",
)

BDS_PRIOR_AUTH = DefectPolicy(
    domain='bds',
    allowed_files=[
        'BdsPriorAuthGateway.java',
    ],
    allowed_tables=[
        'HCSC_DB2.PRIOR_AUTH_TXN',
        'HCSC_DB2.PLN_BEN_CONFIG',
    ],
    compliance_checks=['hipaa', 'cms_billing'],
    review_persona='bds_architect',
    tools=['design_agent', 'qa_agent', 'github_integration',
           'jira_integration', 'code_review_agent', 'estimation_tool'],
    max_iterations=5,
    system_prompt_suffix="""
DOMAIN POLICY — BDS Prior Authorization Defect:
- You are operating in the BDS Prior Auth Gateway
- All specialist claims (SVC_TYPE=SPEC) MUST check PRIOR_AUTH_TXN before approval
- Short-circuit logic that bypasses PA check is a critical compliance violation
- Fix must explicitly query PRIOR_AUTH_TXN — do not rely on isEmergency() short-circuit
- CMS penalty exposure if PA bypass reaches production
""",
)

# ── CTS Defect Policies ────────────────────────────────────────────────────

CTS_BATCH_PROCESSING = DefectPolicy(
    domain='cts',
    allowed_files=[
        'CtsBatchProcessor.java',
    ],
    allowed_tables=[
        'HCSC_DB2.CLM_HDR',
        'HCSC_DB2.CLM_LINE',
    ],
    compliance_checks=['hipaa'],
    review_persona='cts_tech_lead',
    tools=['design_agent', 'qa_agent', 'github_integration',
           'jira_integration', 'code_review_agent', 'estimation_tool'],
    max_iterations=5,
    system_prompt_suffix="""
DOMAIN POLICY — CTS Batch Processing Defect:
- You are operating in the CTS (Claims Transaction System) batch domain
- Never modify a list while iterating — use stream().filter() or Iterator.remove()
- CLM_HDR rows can contain nulls — always filter before processing
- Batch failure leaves claims in PEND status — SLA breach risk
- Fix must handle null CLM_HDR rows AND null getClmAmt() values
- Test must verify the batch completes fully with mixed null/valid claim rows
""",
)

CTS_ICD10_VALIDATION = DefectPolicy(
    domain='cts',
    allowed_files=[
        'CtsIcd10Validator.java',
    ],
    allowed_tables=[
        'HCSC_ODS.DX_CODE_REF',
    ],
    compliance_checks=['hipaa', 'aca_mandate'],
    review_persona='cts_tech_lead',
    tools=['design_agent', 'qa_agent', 'github_integration',
           'jira_integration', 'code_review_agent', 'estimation_tool'],
    max_iterations=5,
    system_prompt_suffix="""
DOMAIN POLICY — CTS ICD-10 Validation Defect:
- You are operating in the CTS ICD-10 Validator domain
- ACA Section 2713 mandates coverage for Z00-Z13 wellness codes — CANNOT deny
- The fix must supplement DX_CODE_REF with ACA wellness range check
- Do NOT modify the ODS table directly — add a code-level override
- HEDIS quality scores are impacted by wellness claim denials
- Compliance check: ACA mandate takes precedence over ODS allowlist gaps
""",
)

CTS_CLAIM_VALIDATION = DefectPolicy(
    domain='cts',
    allowed_files=[
        'CtsClaimValidator.java',
    ],
    allowed_tables=[
        'HCSC_DB2.CLM_HDR',
    ],
    compliance_checks=['hipaa'],
    review_persona='cts_tech_lead',
    tools=['design_agent', 'qa_agent', 'github_integration',
           'jira_integration', 'code_review_agent', 'estimation_tool'],
    max_iterations=5,
    system_prompt_suffix="""
DOMAIN POLICY — CTS Claim Validation Defect:
- You are operating in the CTS Claim Validator domain
- CLM_HDR.BILLED_AMT must be > 0 — zero dollar claims pollute ODS financial reports
- Add validation BEFORE the claim enters the adjudication queue
- CFO dashboard accuracy depends on clean CLM_HDR data
- Fix must reject with clear error code — not silently pass
""",
)

# ── Policy Registry ────────────────────────────────────────────────────────

POLICY_REGISTRY: dict[str, DefectPolicy] = {
    # BDS policies
    'bds_boundary_condition': BDS_BOUNDARY_CONDITION,
    'bds_null_pointer':        BDS_NULL_POINTER,
    'bds_prior_auth':          BDS_PRIOR_AUTH,

    # CTS policies
    'cts_batch_processing':    CTS_BATCH_PROCESSING,
    'cts_icd10_validation':    CTS_ICD10_VALIDATION,
    'cts_claim_validation':    CTS_CLAIM_VALIDATION,
}

# Bug ID → policy mapping (matches Demo.tsx BUG IDs)
BUG_POLICY_MAP: dict[str, str] = {
    'BUG-001': 'bds_null_pointer',
    'BUG-002': 'bds_boundary_condition',
    'BUG-003': 'cts_batch_processing',
    'BUG-004': 'bds_boundary_condition',
    'BUG-005': 'bds_null_pointer',
    'BUG-006': 'cts_icd10_validation',
    'BUG-007': 'bds_prior_auth',
    'BUG-008': 'cts_claim_validation',
}

# Domain → default policy key
DOMAIN_DEFAULT_POLICY: dict[str, str] = {
    'bds':  'bds_boundary_condition',
    'cts':  'cts_batch_processing',
    'core': 'cts_batch_processing',
    'edi':  'bds_boundary_condition',
    'ims':  'bds_boundary_condition',
}

DEFAULT_POLICY = DefectPolicy(
    domain='general',
    allowed_files=[],
    allowed_tables=[],
    compliance_checks=['hipaa'],
    review_persona='tech_lead',
    tools=['design_agent', 'qa_agent', 'github_integration',
           'jira_integration', 'code_review_agent', 'estimation_tool',
           'sprint_manager', 'retro_agent', 'release_agent', 'metrics_tool'],
    max_iterations=8,
    system_prompt_suffix="",
)


def get_policy(bug_id: Optional[str] = None,
               domain: Optional[str] = None,
               bug_type: Optional[str] = None) -> DefectPolicy:
    """
    Resolve the correct policy for a given bug.
    Priority: bug_id > domain > default
    """
    if bug_id and bug_id.upper() in BUG_POLICY_MAP:
        policy_key = BUG_POLICY_MAP[bug_id.upper()]
        return POLICY_REGISTRY.get(policy_key, DEFAULT_POLICY)

    if domain:
        domain_lower = domain.lower()
        policy_key = DOMAIN_DEFAULT_POLICY.get(domain_lower)
        if policy_key:
            return POLICY_REGISTRY.get(policy_key, DEFAULT_POLICY)

    return DEFAULT_POLICY
