"""
Domain Registry — maps HCSC source files and DB2/ODS tables
to their owning domain (bds | cts | edi | ims).

Used by:
  - scanner_tool.py  (classify detected defects by domain)
  - policies.py      (look up which policy applies)
  - chat.py          (inject domain context into agent calls)

When the agent scans a file and finds a suspicious pattern,
it looks up the file here to know:
  - which HCSC system owns it
  - which DB2/ODS tables it reads
  - which business rules apply
  - which compliance checks are mandatory
  - who must approve the fix
"""

from typing import Optional

# ── File → Domain mapping ──────────────────────────────────────────────────
# Maps Java source filenames to their HCSC domain

FILE_DOMAIN_MAP: dict[str, str] = {
    # BDS — Benefit Determination System (Distributed Java)
    'BdsAccumulatorService.java':    'bds',
    'BdsEligibilityService.java':    'bds',
    'BdsCopayLookupService.java':    'bds',
    'BdsPriorAuthGateway.java':      'bds',
    'BdsBenefitsOrchestrator.java':  'bds',
    'BdsMemberService.java':         'bds',
    'BdsPlanConfigService.java':     'bds',
    'CoreAdjApiWrapper.java':        'bds',

    # CTS — Claims Transaction System (Mainframe COBOL interface)
    'ClaimAdjudicationService.java': 'cts',
    'CtsBatchProcessor.java':        'cts',
    'CtsIcd10Validator.java':        'cts',
    'CtsClaimValidator.java':        'cts',
    'CtsAdjudicationService.java':   'cts',
    'CtsFeeScheduleService.java':    'cts',
    'CtsPaymentOrchestrator.java':   'cts',
    'ClaimAdjudicationService.java': 'cts',
    'ClaimBatchProcessor.java':      'cts',

    # EDI — Axway/Edifecs integration layer
    'AxwayEdiFacade.java':           'edi',
    'EdifecsMappingService.java':    'edi',
    'Edi837Processor.java':          'edi',
    'Edi835Generator.java':          'edi',

    # IMS — Infrastructure & Ops (ARES-IMS team)
    'ControlMJobService.java':       'ims',
    'ServiceNowConnector.java':      'ims',
    'RundeckTriggerService.java':    'ims',
}

# ── DB2/ODS Table → Business Context ──────────────────────────────────────
# When an agent sees a table name it looks this up to understand
# the business meaning, risk, and compliance requirements

TABLE_CONTEXT: dict[str, dict] = {
    # BDS tables
    'HCSC_DB2.MMBR': {
        'domain': 'bds',
        'short': 'MMBR',
        'meaning': 'Member enrollment — TERM_DT, plan code, COBRA status',
        'risk': 'Null rows when member has no active coverage record — NPE risk in adjudication',
        'compliance': ['hipaa'],
        'common_bugs': ['null_pointer', 'boundary_condition'],
        'reviewer': 'BDS Architect',
    },
    'HCSC_DB2.PLN_BEN_CONFIG': {
        'domain': 'bds',
        'short': 'PLN_BEN_CONFIG',
        'meaning': 'Plan benefit configuration — copay amounts, deductible limits, PA rules',
        'risk': 'Missing service type cases (EMERGENCY) cause wrong copay — revenue leakage',
        'compliance': ['hipaa', 'cms_billing'],
        'common_bugs': ['missing_case', 'boundary_condition'],
        'reviewer': 'BDS Architect',
    },
    'HCSC_ODS.COV_ACCUM_HIST': {
        'domain': 'bds',
        'short': 'COV_ACCUM_HIST',
        'meaning': 'YTD deductible, OOP max, copay accumulators per member per plan year',
        'risk': 'Boundary condition at remaining == 0 causes double-billing — CMS audit exposure across 5 state plans',
        'compliance': ['hipaa', 'cms_billing'],
        'common_bugs': ['boundary_condition'],
        'reviewer': 'BDS Architect',
    },
    'HCSC_DB2.PRIOR_AUTH_TXN': {
        'domain': 'bds',
        'short': 'PRIOR_AUTH_TXN',
        'meaning': 'Prior authorization decisions — AUTH_ID, status, valid dates',
        'risk': 'Short-circuit logic bypasses PA check for specialists — fraud risk, CMS penalty',
        'compliance': ['hipaa', 'cms_billing'],
        'common_bugs': ['logic_bypass', 'null_pointer'],
        'reviewer': 'BDS Architect',
    },

    # CTS tables
    'HCSC_DB2.CLM_HDR': {
        'domain': 'cts',
        'short': 'CLM_HDR',
        'meaning': 'Claim header — ADJUD_STS, PAID_AMT, BILLED_AMT, SVC_DT',
        'risk': '$0 BILLED_AMT rows corrupt ODS financial reports. Null rows crash nightly batch.',
        'compliance': ['hipaa'],
        'common_bugs': ['null_pointer', 'missing_validation', 'concurrent_modification'],
        'reviewer': 'CTS Tech Lead',
    },
    'HCSC_DB2.CLM_LINE': {
        'domain': 'cts',
        'short': 'CLM_LINE',
        'meaning': 'Claim line items — DIAG_CD, PROC_CD, individual amounts',
        'risk': 'Invalid DIAG_CD passes ICD-10 validation if allowlist is stale',
        'compliance': ['hipaa', 'aca_mandate'],
        'common_bugs': ['missing_validation'],
        'reviewer': 'CTS Tech Lead',
    },
    'HCSC_DB2.PRVDR_FEE_SCHED': {
        'domain': 'cts',
        'short': 'PRVDR_FEE_SCHED',
        'meaning': 'Provider contract rates — in-network vs out-of-network',
        'risk': 'Wrong fee schedule applied causes incorrect PAID_AMT in CLM_HDR',
        'compliance': ['hipaa'],
        'common_bugs': ['missing_case', 'boundary_condition'],
        'reviewer': 'CTS Tech Lead',
    },
    'HCSC_ODS.DX_CODE_REF': {
        'domain': 'cts',
        'short': 'DX_CODE_REF',
        'meaning': 'ICD-10/CPT allowlist — valid diagnosis codes loaded at startup',
        'risk': 'Z00-Z13 ACA wellness codes missing from snapshot — all preventive claims denied, ACA mandate violation',
        'compliance': ['hipaa', 'aca_mandate'],
        'common_bugs': ['missing_validation', 'stale_cache'],
        'reviewer': 'CTS Tech Lead',
    },
}

# ── Bug ID → Domain + File mapping ────────────────────────────────────────
BUG_DOMAIN_MAP: dict[str, dict] = {
    'BUG-001': {
        'domain': 'bds',
        'file': 'CoreAdjApiWrapper.java',
        'bug_type': 'null_pointer',
        'tables': ['HCSC_DB2.MMBR', 'HCSC_ODS.COV_ACCUM_HIST'],
    },
    'BUG-002': {
        'domain': 'bds',
        'file': 'BdsAccumulatorService.java',
        'bug_type': 'boundary_condition',
        'tables': ['HCSC_ODS.COV_ACCUM_HIST'],
    },
    'BUG-003': {
        'domain': 'cts',
        'file': 'CtsBatchProcessor.java',
        'bug_type': 'concurrent_modification',
        'tables': ['HCSC_DB2.CLM_HDR'],
    },
    'BUG-004': {
        'domain': 'bds',
        'file': 'BdsCopayLookupService.java',
        'bug_type': 'missing_case',
        'tables': ['HCSC_DB2.PLN_BEN_CONFIG'],
    },
    'BUG-005': {
        'domain': 'bds',
        'file': 'BdsEligibilityService.java',
        'bug_type': 'boundary_condition',
        'tables': ['HCSC_DB2.MMBR'],
    },
    'BUG-006': {
        'domain': 'cts',
        'file': 'CtsIcd10Validator.java',
        'bug_type': 'missing_validation',
        'tables': ['HCSC_ODS.DX_CODE_REF'],
    },
    'BUG-007': {
        'domain': 'bds',
        'file': 'BdsPriorAuthGateway.java',
        'bug_type': 'logic_bypass',
        'tables': ['HCSC_DB2.PRIOR_AUTH_TXN'],
    },
    'BUG-008': {
        'domain': 'cts',
        'file': 'CtsClaimValidator.java',
        'bug_type': 'missing_validation',
        'tables': ['HCSC_DB2.CLM_HDR'],
    },
}


def get_domain_for_file(filename: str) -> Optional[str]:
    """Return the HCSC domain for a given Java filename."""
    return FILE_DOMAIN_MAP.get(filename)


def get_table_context(table_name: str) -> Optional[dict]:
    """Return business context for a DB2/ODS table."""
    # Try exact match first, then short name match
    if table_name in TABLE_CONTEXT:
        return TABLE_CONTEXT[table_name]
    for key, ctx in TABLE_CONTEXT.items():
        if ctx['short'] == table_name or key.endswith(f'.{table_name}'):
            return ctx
    return None


def get_domain_context_summary(domain: str) -> str:
    """
    Returns a rich context summary injected into agent prompts.
    This is what makes the agent 'know' it's working in BDS vs CTS.
    """
    if domain == 'bds':
        tables = [ctx for ctx in TABLE_CONTEXT.values() if ctx['domain'] == 'bds']
        return (
            "DOMAIN CONTEXT — BDS (Benefit Determination System):\n"
            "You are operating in HCSC's Benefit Determination System — a distributed Java platform.\n"
            "Key tables you may encounter:\n" +
            "\n".join([f"  - {t['short']}: {t['meaning']}" for t in tables]) +
            "\n\nCritical business rules:\n"
            "  - COV_ACCUM_HIST.remaining == 0 means deductible EXACTLY MET — do not charge again\n"
            "  - MMBR rows can be null — always null-check before calling methods\n"
            "  - PRIOR_AUTH_TXN must be checked for all SVC_TYPE=SPEC claims\n"
            "  - PLN_BEN_CONFIG.EMERGENCY case must be explicit — do not fall through to default\n"
            "\nReviewer: BDS Architect must approve all changes in this domain."
        )
    elif domain == 'cts':
        tables = [ctx for ctx in TABLE_CONTEXT.values() if ctx['domain'] == 'cts']
        return (
            "DOMAIN CONTEXT — CTS (Claims Transaction System):\n"
            "You are operating in HCSC's Claims Transaction System — mainframe COBOL interface layer.\n"
            "Key tables you may encounter:\n" +
            "\n".join([f"  - {t['short']}: {t['meaning']}" for t in tables]) +
            "\n\nCritical business rules:\n"
            "  - CLM_HDR lists can contain nulls — always filter with stream().filter() before iteration\n"
            "  - DX_CODE_REF Z00-Z13 range is required by ACA — supplement if missing from snapshot\n"
            "  - CLM_HDR.BILLED_AMT must be > 0 — zero-dollar claims corrupt ODS financial reports\n"
            "  - Nightly batch CLM_HDR pull can contain null rows — stream-filter before processing\n"
            "\nReviewer: CTS Tech Lead must approve all changes in this domain."
        )
    return ""