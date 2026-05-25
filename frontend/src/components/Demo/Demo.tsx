import React, { useState, useRef } from 'react';
import { chatApi, githubApi } from '../../services/api';

// ── Bug definitions ────────────────────────────────────────────────────────
const BUGS = [
  {
    id: 'BUG-001',
    title: 'NullPointerException — no active coverage check',
    domain: 'BDS — Benefit Determination',
    contextDomain: 'bds',
    severity: 'Critical',
    type: 'Technical',
    file: 'src/main/java/com/hcsc/claims/CoreAdjApiWrapper.java',
    jiraKey: 'ST-1',
    businessImpact: 'Claims crash at adjudication entry — affects all BCBS-IL members without prior coverage record. Production outage risk.',
    description: 'coverage.isActive() called without null check. DB2 MMBR table returns null when no active coverage record exists.',
    policyKey: 'bds_null_pointer',
    allowedFiles: ['CoreAdjApiWrapper.java'],
    allowedTables: ['HCSC_DB2.MMBR', 'HCSC_ODS.COV_ACCUM_HIST'],
    compliance: ['HIPAA'],
    evalCriteria: [
      { label: 'Null check before isActive()', weight: 35, key: 'null_check' },
      { label: 'HIPAA-safe denial (no PHI in logs)', weight: 25, key: 'hipaa_safe' },
      { label: 'Correct return type preserved', weight: 20, key: 'return_type' },
      { label: 'Unit test for null MMBR case', weight: 20, key: 'unit_test' },
    ],
    codeSnippet: `// BUG: No null check before isActive()
Coverage cov = db2Repo.findActiveCoverage(
    claim.getMbrId());
if (!cov.isActive()) { // NPE when cov == null
    return AdjResult.denied("No coverage");
}`,
    fixSnippet: `// FIX: Explicit null check first
Coverage cov = db2Repo.findActiveCoverage(
    claim.getMbrId());
if (cov == null) {
    return AdjResult.denied(
        "No active coverage: " + claim.getMbrId());
}
if (!cov.isActive()) {
    return AdjResult.denied("Inactive coverage");
}`,
    fixedCode: `Coverage cov = db2Repo.findActiveCoverage(claim.getMbrId());\nif (cov == null) { return AdjResult.denied("No active coverage: " + claim.getMbrId()); }\nif (!cov.isActive()) { return AdjResult.denied("Inactive coverage"); }`,
  },
  {
    id: 'BUG-002',
    title: 'Deductible off-by-one — ODS accumulator boundary missed',
    domain: 'BDS — Benefit Determination',
    contextDomain: 'bds',
    severity: 'High',
    type: 'Functional',
    file: 'src/main/java/com/hcsc/claims/BdsAccumulatorService.java',
    jiraKey: 'ST-2',
    businessImpact: 'Members double-billed when annual deductible lands exactly on threshold. CMS audit exposure across 5 BCBS state plans. ~$3.4M annual risk.',
    description: '> 0 comparison misses == 0 boundary. HCSC_ODS.COV_ACCUM_HIST.remaining == 0 means deductible exactly met — charging again violates CMS billing rules.',
    policyKey: 'bds_boundary_condition',
    allowedFiles: ['BdsAccumulatorService.java'],
    allowedTables: ['HCSC_ODS.COV_ACCUM_HIST', 'HCSC_DB2.PLN_BEN_CONFIG'],
    compliance: ['HIPAA', 'CMS Billing'],
    evalCriteria: [
      { label: 'Correct boundary >= 0 (not > 0)', weight: 35, key: 'boundary' },
      { label: 'Null check for odsRepo return', weight: 25, key: 'null_check' },
      { label: 'Test case for exactly == 0', weight: 25, key: 'boundary_test' },
      { label: 'Business rule comment in code', weight: 15, key: 'comment' },
    ],
    codeSnippet: `// BUG: > 0 misses == 0 boundary case
// ODS table: HCSC_ODS.COV_ACCUM_HIST
BigDecimal remaining = odsRepo
    .getDeductibleRemaining(mbrId, planYear);
if (remaining.compareTo(BigDecimal.ZERO) > 0) {
    patientOwes = patientOwes.add(remaining);
    // double-charged when remaining == $0.00
}`,
    fixSnippet: `// FIX: >= 0 handles zero-remaining boundary
// COV_ACCUM_HIST.remaining == 0 = deductible met
// CMS rule: cannot charge again at this boundary
BigDecimal remaining = odsRepo
    .getDeductibleRemaining(mbrId, planYear);
if (remaining.compareTo(BigDecimal.ZERO) >= 0) {
    patientOwes = patientOwes.add(remaining);
}`,
    fixedCode: `BigDecimal remaining = odsRepo.getDeductibleRemaining(mbrId, planYear);\nif (remaining.compareTo(BigDecimal.ZERO) >= 0) {\n  patientOwes = patientOwes.add(remaining);\n}`,
  },
  {
    id: 'BUG-003',
    title: 'ConcurrentModificationException — batch claims processor',
    domain: 'CTS — Core Adjudication',
    contextDomain: 'cts',
    severity: 'Critical',
    type: 'Technical',
    file: 'src/main/java/com/hcsc/claims/CtsBatchProcessor.java',
    jiraKey: 'ST-3',
    businessImpact: 'Nightly batch crashes mid-run when null CLM_HDR rows present. All claims stuck in PEND status — SLA breach and delayed payments.',
    description: 'List modified during for-each iteration over CLM_HDR result set. Null rows from DB2 trigger remove() inside loop causing CME crash.',
    policyKey: 'cts_batch_processing',
    allowedFiles: ['CtsBatchProcessor.java'],
    allowedTables: ['HCSC_DB2.CLM_HDR', 'HCSC_DB2.CLM_LINE'],
    compliance: ['HIPAA'],
    evalCriteria: [
      { label: 'stream().filter() replaces loop remove()', weight: 40, key: 'stream_filter' },
      { label: 'Null check for CLM_HDR rows', weight: 30, key: 'null_check' },
      { label: 'Null check for getClmAmt()', weight: 20, key: 'amt_null' },
      { label: 'Test with mixed null/valid rows', weight: 10, key: 'test_mixed' },
    ],
    codeSnippet: `// BUG: List modified during for-each
List<Claim> claims = db2Repo.getPendingClaims();
for (Claim c : claims) {     // CME here
    if (c == null || c.getClmAmt() == null) {
        claims.remove(c);    // modifies source list
    }
    processClaim(c);
}`,
    fixSnippet: `// FIX: stream().filter() creates new list
List<Claim> valid = db2Repo.getPendingClaims()
    .stream()
    .filter(c -> c != null
        && c.getClmAmt() != null)
    .collect(Collectors.toList());
for (Claim claim : valid) { processClaim(claim); }`,
    fixedCode: `List<Claim> valid = db2Repo.getPendingClaims().stream().filter(c -> c != null && c.getClmAmt() != null).collect(Collectors.toList());\nfor (Claim claim : valid) { processClaim(claim); }`,
  },
  {
    id: 'BUG-004',
    title: 'ER copay applied at PC rate — missing switch case',
    domain: 'BDS — Benefit Determination',
    contextDomain: 'bds',
    severity: 'High',
    type: 'Functional',
    file: 'src/main/java/com/hcsc/claims/BdsCopayLookupService.java',
    jiraKey: 'ST-4',
    businessImpact: 'ER visits billed at $20 PC copay instead of $150 ER copay. Revenue leakage ~$2.1M/year across BCBS plans.',
    description: 'EMERGENCY case missing from switch on SVC_TYPE. Falls through to default PRIMARY_CARE copay ($20 instead of $150).',
    policyKey: 'bds_boundary_condition',
    allowedFiles: ['BdsCopayLookupService.java'],
    allowedTables: ['HCSC_DB2.PLN_BEN_CONFIG'],
    compliance: ['HIPAA', 'CMS Billing'],
    evalCriteria: [
      { label: 'EMERGENCY case explicitly handled', weight: 40, key: 'emergency_case' },
      { label: 'Returns planConfig.getErCopay()', weight: 30, key: 'er_copay' },
      { label: 'Default case preserved', weight: 20, key: 'default_case' },
      { label: 'Test for all 3 service types', weight: 10, key: 'test_all' },
    ],
    codeSnippet: `// BUG: EMERGENCY falls to default ($20)
switch (serviceType) {
    case PRIMARY_CARE:
        return planConfig.getPcCopay();   // $20
    case SPECIALIST:
        return planConfig.getSpCopay();  // $50
    default:  // ER lands here → $20 wrong!
        return planConfig.getPcCopay();
}`,
    fixSnippet: `// FIX: Explicit EMERGENCY case ($150)
switch (serviceType) {
    case PRIMARY_CARE:
        return planConfig.getPcCopay();   // $20
    case SPECIALIST:
        return planConfig.getSpCopay();  // $50
    case EMERGENCY:
        return planConfig.getErCopay();  // $150
    default:
        return planConfig.getPcCopay();
}`,
    fixedCode: `switch (serviceType) {\n  case PRIMARY_CARE: return planConfig.getPcCopay();\n  case SPECIALIST: return planConfig.getSpCopay();\n  case EMERGENCY: return planConfig.getErCopay();\n  default: return planConfig.getPcCopay();\n}`,
  },
];

const scoreColor = (s: number) => s >= 0.85 ? '#16A34A' : s >= 0.70 ? '#D97706' : '#DC2626';
const scoreBg   = (s: number) => s >= 0.85 ? '#DCFCE7' : s >= 0.70 ? '#FEF3C7' : '#FEE2E2';
const scoreLabel= (s: number) => s >= 0.85 ? 'High confidence' : s >= 0.70 ? 'Needs review' : 'Low confidence';

// ── Pipeline (9 steps) ────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { id: 1, label: 'Detect defect',     icon: '🔍', persona: 'tech_lead' },
  { id: 2, label: 'Create Jira ticket',icon: '📋', persona: 'tech_lead' },
  { id: 3, label: 'Plan sprint',        icon: '📅', persona: 'scrum_master' },
  { id: 4, label: 'Technical design',   icon: '🏗',  persona: 'tech_lead' },
  { id: 5, label: 'Generate tests',     icon: '🧪', persona: 'qa_lead' },
  { id: 6, label: 'Code fix & PR',      icon: '⚙️', persona: 'tech_lead' },
  { id: 7, label: 'Code review',        icon: '👁',  persona: 'tech_lead' },
  { id: 8, label: 'System test',        icon: '🚦', persona: 'tech_lead' },
  { id: 9, label: 'Sync to develop',    icon: '🔄', persona: 'tech_lead' },
];

const buildPrompts = (bug: typeof BUGS[0], jiraKey: string, releaseBranch = 'release/june-2026') => [
  `You are an HCSC claims system expert. Analyze this defect with domain context:\nBug: ${bug.id} — ${bug.title}\nDomain: ${bug.domain}\nFile: ${bug.file}\nDescription: ${bug.description}\nBusiness Impact: ${bug.businessImpact}\nAffected Tables: ${bug.allowedTables.join(', ')}\nCompliance: ${bug.compliance.join(', ')}\n\nProvide: (1) root cause in DB2/ODS context, (2) which table fields are affected and why, (3) CMS/HIPAA compliance implications, (4) confidence score 0-100% in your diagnosis.`,
  `Use the jira_integration tool ONCE to create a Jira issue:\n- operation: create_issue\n- title: Fix: ${bug.title}\n- domain: ${bug.contextDomain}\n- priority: ${bug.severity}\n- description: ${bug.description} | Impact: ${bug.businessImpact} | Tables: ${bug.allowedTables.join(', ')} | Compliance: ${bug.compliance.join('+')}\nCall ONCE only.`,
  `Use the sprint_manager tool: 1) List active sprint, 2) Estimate story points for: "${bug.title}" — ${bug.severity} ${bug.type} defect in ${bug.domain}, 3) Recommend sprint assignment. Consider: compliance=${bug.compliance.join('+')}, tables=${bug.allowedTables.join(', ')}.`,
  `Use the design_agent tool for: ${bug.title}\nFile: ${bug.file}\nTables: ${bug.allowedTables.join(', ')}\nDescription: ${bug.description}\nCompliance: ${bug.compliance.join(', ')}\n\nInclude: (1) root cause in DB2/ODS context, (2) before/after code, (3) affected table fields and why, (4) risk assessment with CMS/HIPAA implications, (5) boundary condition test strategy.`,
  `Use the qa_agent tool for: ${bug.title}\nDomain: ${bug.domain}\nTables: ${bug.allowedTables.join(', ')}\n\nGenerate: (1) bug reproduction test, (2) fix verification test, (3) boundary condition tests — especially the == 0 or exact boundary, (4) HIPAA test — no PHI in error messages, (5) BDD scenarios.`,
  `Use the github_integration tool with operation=auto_fix. Call ONCE with EXACTLY this JSON — do not modify fixed_code:\n{"operation": "auto_fix", "bug": "${bug.title}", "file": "${bug.file}", "fixed_code": ${JSON.stringify(bug.fixedCode)}, "jira_key": "${jiraKey}", "base": "develop", "release_branch": "${releaseBranch}"}`,
  `Use the code_review_agent to review the latest open PR for ${jiraKey}.\nFix: ${bug.title} | Domain: ${bug.domain} | Tables: ${bug.allowedTables.join(', ')} | Compliance: ${bug.compliance.join(', ')}\n\nReview: (1) boundary cases including == 0, (2) HIPAA — no PHI in logs, (3) ${bug.compliance.includes('CMS Billing') ? 'CMS billing rule accuracy' : 'exception handling'}, (4) test coverage, (5) domain logic accuracy. Give production-readiness confidence score 0-100%.`,
  `Use the jenkins_agent tool to trigger a system test build. Pass as JSON: {"operation": "trigger_build", "branch": "${releaseBranch}", "job": "healthcare-claims"}. Return build status, test summary, and whether all tests pass.`,
  `Use the github_integration tool with operation=sync_to_develop and source="${releaseBranch}". This will open a PR from ${releaseBranch} to develop so the fix is available for the next production release cycle. Call ONCE and return the PR URL.`,
];

interface StepResult {
  status: 'running' | 'done' | 'error';
  response: string;
  duration: number;
  prUrl?: string;
  prNumber?: number;
  policy_domain?: string;
  compliance_checks?: string[];
}

export function Demo({ scrollToTop, onTabChange }: { scrollToTop?: () => void; onTabChange?: (tab: string) => void }) {
  const [selectedBug, setSelectedBug] = useState<typeof BUGS[0] | null>(null);
  const [running, setRunning]           = useState(false);
  const [currentStep, setCurrentStep]   = useState(0);
  const [stepResults, setStepResults]   = useState<Record<number, StepResult>>({});
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showCode, setShowCode]         = useState<'bug' | 'fix' | null>(null);

  // Gate B — PR approval (after step 6)
  const [gateStatus, setGateStatus]     = useState<'waiting'|'approved'|'rejected'|'changes_requested'|null>(null);
  const [gateComment, setGateComment]   = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [prUrl, setPrUrl]               = useState('');
  const [prNumber, setPrNumber]         = useState<number | null>(null);
  const gateResolveRef = useRef<((v:string)=>void)|null>(null);

  // Gate A — Release branch selection (after step 5)
  const [releaseBranchGate, setReleaseBranchGate] = useState<'idle'|'waiting'|'resolved'>('idle');
  const [availableReleaseBranches, setAvailableReleaseBranches] = useState<string[]>([]);
  const [selectedReleaseBranch, setSelectedReleaseBranch] = useState('release/june-2026');
  const [newReleaseName, setNewReleaseName] = useState('');
  const [creatingReleaseBranch, setCreatingReleaseBranch] = useState(false);
  const releaseBranchResolveRef = useRef<((v:string)=>void)|null>(null);

  // Gate C — Sync to develop (after step 8)
  const [syncGateStatus, setSyncGateStatus] = useState<'idle'|'waiting'|'syncing'|'done'|'skipped'>('idle');
  const syncGateResolveRef = useRef<((v:string)=>void)|null>(null);

  const [showRelease, setShowRelease]   = useState(false);
  const [releaseResult, setReleaseResult] = useState('');
  const [releaseRunning, setReleaseRunning] = useState(false);
  const [scanResult, setScanResult]     = useState<string | null>(null);
  const [scanRunning, setScanRunning]   = useState(false);
  const [overallEval, setOverallEval]   = useState<{
    score: number;
    refined: boolean;
    evalRunning: boolean;
    scores?: Record<string, number>;
    gaps?: string[];
    suggestions?: string[];
    reviewer_notes?: string;
    confidence_label?: string;
  } | null>(null);

  // ── Gate helpers ──────────────────────────────────────────────────────────
  const waitForApproval = (): Promise<string> =>
    new Promise(r => { gateResolveRef.current = r; });

  const waitForReleaseBranch = (): Promise<string> =>
    new Promise(r => { releaseBranchResolveRef.current = r; });

  const waitForSyncDecision = (): Promise<string> =>
    new Promise(r => { syncGateResolveRef.current = r; });

  const handleApprove        = () => { setGateStatus('approved');          gateResolveRef.current?.('approved'); };
  const handleReject         = () => { setGateStatus('rejected');          gateResolveRef.current?.('rejected'); };
  const handleRequestChanges = () => { setGateStatus('changes_requested'); gateResolveRef.current?.('changes_requested'); };

  const handleSelectReleaseBranch = (branch: string) => {
    setSelectedReleaseBranch(branch);
    setReleaseBranchGate('resolved');
    releaseBranchResolveRef.current?.(branch);
  };

  const handleCreateAndSelectReleaseBranch = async () => {
    if (!newReleaseName) return;
    setCreatingReleaseBranch(true);
    const result = await githubApi.createReleaseBranch(newReleaseName);
    setCreatingReleaseBranch(false);
    const branch = result.branch;
    setAvailableReleaseBranches(prev => [...prev, branch]);
    handleSelectReleaseBranch(branch);
  };

  const handleSyncYes  = () => { setSyncGateStatus('syncing'); syncGateResolveRef.current?.('sync'); };
  const handleSyncSkip = () => { setSyncGateStatus('skipped'); syncGateResolveRef.current?.('skip'); };

  // ── Scan ──────────────────────────────────────────────────────────────────
  const runScan = async () => {
    setScanRunning(true); setScanResult(null);
    try {
      const r = await chatApi.send('Use the code_scanner tool to scan all java files for defects. Return findings with confidence scores, domain classification (bds/cts), affected DB2/ODS tables, and business impact for each finding.', [], 'tech_lead');
      setScanResult(typeof r === 'string' ? r : (r as any).reply || '');
    } catch (e: any) { setScanResult(`Error: ${e.message}`); }
    setScanRunning(false);
  };

  // ── Main demo runner ───────────────────────────────────────────────────────
  const runDemo = async (bug: typeof BUGS[0]) => {
    setSelectedBug(bug); setRunning(true); setCurrentStep(0);
    setStepResults({}); setExpandedStep(null); setShowCode(null);
    setGateStatus(null); setGateComment(''); setPrUrl(''); setPrNumber(null);
    setShowRelease(false); setReleaseResult(''); setShowCommentBox(false); setOverallEval(null);
    setReleaseBranchGate('idle'); setSelectedReleaseBranch('release/june-2026');
    setNewReleaseName(''); setAvailableReleaseBranches([]); setCreatingReleaseBranch(false);
    setSyncGateStatus('idle');

    let actualJiraKey    = bug.jiraKey;
    let actualReleaseBranch = 'release/june-2026';

    // ── Steps 1–5 ────────────────────────────────────────────────────────────
    for (let i = 0; i < 5; i++) {
      setCurrentStep(i + 1);
      setStepResults(prev => ({ ...prev, [i+1]: { status: 'running', response: '', duration: 0 } }));
      const t0 = Date.now();
      try {
        const prompts = buildPrompts(bug, actualJiraKey, actualReleaseBranch);
        const result  = await chatApi.send(prompts[i], [], PIPELINE_STEPS[i].persona, bug.id, bug.contextDomain, bug.type.toLowerCase().replace(' ','_'));
        const reply   = typeof result === 'string' ? result : (result as any).reply || '';
        const duration = Math.round((Date.now() - t0) / 1000);
        if (i === 1) { const m = reply.match(/\b(ST-\d+)\b/); if (m) actualJiraKey = m[1]; }
        setStepResults(prev => ({
          ...prev,
          [i+1]: { status: 'done', response: reply, duration,
                   policy_domain: (result as any).policy_domain,
                   compliance_checks: (result as any).compliance_checks || [] },
        }));
        setExpandedStep(i + 1);
      } catch (e: any) {
        setStepResults(prev => ({ ...prev, [i+1]: { status: 'error', response: `Error: ${e.message}`, duration: Math.round((Date.now()-t0)/1000) } }));
      }
      await new Promise(r => setTimeout(r, 600));
    }

    // ── Gate A: Release branch selection ─────────────────────────────────────
    setRunning(false); setCurrentStep(0);
    const branches = await githubApi.listReleaseBranches();
    setAvailableReleaseBranches(branches.length > 0 ? branches : ['release/june-2026']);
    setReleaseBranchGate('waiting');
    actualReleaseBranch = await waitForReleaseBranch();

    // ── Step 6: Code fix & PR ─────────────────────────────────────────────────
    setRunning(true); setCurrentStep(6);
    setStepResults(prev => ({ ...prev, 6: { status: 'running', response: '', duration: 0 } }));
    {
      const t0 = Date.now();
      try {
        const prompts = buildPrompts(bug, actualJiraKey, actualReleaseBranch);
        const result  = await chatApi.send(prompts[5], [], 'tech_lead', bug.id, bug.contextDomain, bug.type.toLowerCase().replace(' ','_'));
        const reply   = typeof result === 'string' ? result : (result as any).reply || '';
        const duration = Math.round((Date.now() - t0) / 1000);
        const um = reply.match(/https:\/\/github\.com\/[^\s"')]+\/pull\/\d+/);
        const nm = reply.match(/pr_number[":\s]+(\d+)/i) || reply.match(/pull\/(\d+)/);
        if (um) { setPrUrl(um[0]); }
        if (nm) { setPrNumber(parseInt(nm[1])); }
        setOverallEval({ score: 0, refined: false, evalRunning: true });
        chatApi.evaluate(bug.fixedCode, bug.id, bug.contextDomain, bug.type.toLowerCase().replace(' ', '_'), bug.description)
          .then(ev => {
            setOverallEval({ score: ev.overall, refined: ev.needs_refinement, evalRunning: false, scores: ev.scores, gaps: ev.gaps, suggestions: ev.refinement_suggestions, reviewer_notes: ev.reviewer_notes, confidence_label: ev.confidence_label });
          }).catch(() => {
            setOverallEval({ score: 0.75, refined: false, evalRunning: false });
          });
        setStepResults(prev => ({
          ...prev,
          6: { status: 'done', response: reply, duration, prUrl: um?.[0], prNumber: nm ? parseInt(nm[1]) : undefined,
               policy_domain: (result as any).policy_domain, compliance_checks: (result as any).compliance_checks || [] },
        }));
        setExpandedStep(6);
      } catch (e: any) {
        setStepResults(prev => ({ ...prev, 6: { status: 'error', response: `Error: ${e.message}`, duration: Math.round((Date.now()-t0)/1000) } }));
      }
    }

    // ── Gate B: PR approval ───────────────────────────────────────────────────
    setRunning(false); setCurrentStep(0); setGateStatus('waiting'); setExpandedStep(null);
    const decision = await waitForApproval();
    if (decision !== 'approved') return;

    // ── Step 7: Code review ───────────────────────────────────────────────────
    setRunning(true); setCurrentStep(7);
    setStepResults(prev => ({ ...prev, 7: { status: 'running', response: '', duration: 0 } }));
    {
      const t0 = Date.now();
      try {
        const prompts = buildPrompts(bug, actualJiraKey, actualReleaseBranch);
        const result  = await chatApi.send(prompts[6], [], 'tech_lead', bug.id, bug.contextDomain);
        const reply   = typeof result === 'string' ? result : (result as any).reply || '';
        setStepResults(prev => ({ ...prev, 7: { status: 'done', response: reply, duration: Math.round((Date.now()-t0)/1000) } }));
        setExpandedStep(7);
      } catch (e: any) {
        setStepResults(prev => ({ ...prev, 7: { status: 'error', response: `Error: ${e.message}`, duration: Math.round((Date.now()-t0)/1000) } }));
      }
    }

    // ── Step 8: System test (Jenkins) ─────────────────────────────────────────
    await new Promise(r => setTimeout(r, 600));
    setCurrentStep(8);
    setStepResults(prev => ({ ...prev, 8: { status: 'running', response: '', duration: 0 } }));
    {
      const t0 = Date.now();
      try {
        const prompts = buildPrompts(bug, actualJiraKey, actualReleaseBranch);
        const result  = await chatApi.send(prompts[7], [], 'tech_lead', bug.id, bug.contextDomain);
        const reply   = typeof result === 'string' ? result : (result as any).reply || '';
        setStepResults(prev => ({ ...prev, 8: { status: 'done', response: reply, duration: Math.round((Date.now()-t0)/1000) } }));
        setExpandedStep(8);
      } catch (e: any) {
        setStepResults(prev => ({ ...prev, 8: { status: 'error', response: `Error: ${e.message}`, duration: Math.round((Date.now()-t0)/1000) } }));
      }
    }

    // ── Gate C: Sync to develop? ──────────────────────────────────────────────
    setRunning(false); setCurrentStep(0);
    setSyncGateStatus('waiting');
    const syncDecision = await waitForSyncDecision();

    if (syncDecision === 'sync') {
      setRunning(true); setCurrentStep(9);
      setStepResults(prev => ({ ...prev, 9: { status: 'running', response: '', duration: 0 } }));
      const t0 = Date.now();
      try {
        const prompts = buildPrompts(bug, actualJiraKey, actualReleaseBranch);
        const result  = await chatApi.send(prompts[8], [], 'tech_lead', bug.id, bug.contextDomain);
        const reply   = typeof result === 'string' ? result : (result as any).reply || '';
        setStepResults(prev => ({ ...prev, 9: { status: 'done', response: reply, duration: Math.round((Date.now()-t0)/1000) } }));
        setExpandedStep(9);
        setSyncGateStatus('done');
      } catch (e: any) {
        setStepResults(prev => ({ ...prev, 9: { status: 'error', response: `Error: ${e.message}`, duration: Math.round((Date.now()-t0)/1000) } }));
        setSyncGateStatus('done');
      }
    }

    setRunning(false); setCurrentStep(0); setShowRelease(true);
  };

  const generateReleaseNotes = async () => {
    if (!selectedBug) return;
    setReleaseRunning(true);
    try {
      const r = await chatApi.send(`Use the release_agent tool to generate release notes for v1.1.0 for: ${selectedBug.title} (${selectedBug.type} defect in ${selectedBug.domain}). Include business impact, testing summary, compliance: ${selectedBug.compliance.join('+')}, and deployment instructions.`, [], 'release_manager');
      setReleaseResult(typeof r === 'string' ? r : (r as any).reply || '');
    } catch (e: any) { setReleaseResult(`Error: ${e.message}`); }
    setReleaseRunning(false);
  };

  const resetDemo = () => {
    setSelectedBug(null); setRunning(false); setCurrentStep(0); setStepResults({}); setExpandedStep(null);
    setShowCode(null); setGateStatus(null); setGateComment(''); setPrUrl(''); setPrNumber(null);
    setShowRelease(false); setReleaseResult(''); setReleaseRunning(false); setShowCommentBox(false);
    setOverallEval(null); setScanResult(null);
    setReleaseBranchGate('idle'); setSelectedReleaseBranch('release/june-2026');
    setNewReleaseName(''); setAvailableReleaseBranches([]); setCreatingReleaseBranch(false);
    setSyncGateStatus('idle');
  };

  const pipelineComplete = stepResults[8]?.status === 'done';

  // ── Gate badge styles ─────────────────────────────────────────────────────
  const releaseBadgeStyle = () => {
    if (releaseBranchGate === 'resolved') return { bg: '#F0FDF4', border: '0.5px solid #16A34A', color: '#15803D' };
    if (releaseBranchGate === 'waiting')  return { bg: '#E0F2FE', border: '2px solid #0EA5E9',   color: '#0369A1' };
    return { bg: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-tertiary)' };
  };

  const syncBadgeStyle = () => {
    if (syncGateStatus === 'done')    return { bg: '#F5F3FF', border: '0.5px solid #7C3AED', color: '#5B21B6' };
    if (syncGateStatus === 'skipped') return { bg: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', color: 'var(--color-text-tertiary)' };
    if (syncGateStatus === 'waiting' || syncGateStatus === 'syncing') return { bg: '#F5F3FF', border: '2px solid #7C3AED', color: '#5B21B6' };
    return { bg: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-tertiary)' };
  };

  return (
    <div style={{ padding: '24px', maxWidth: '960px', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          HCSC / BCBS — Payer Claims Intelligence Demo
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
          AI agents across CTS · BDS · DB2 · ODS · Mainframe — 9-step SDLC pipeline with Gitflow, system test &amp; human gates
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['CTS (Core Adj)', 'BDS (Benefits)', 'DB2 / ODS', 'Mainframe COBOL', '17M Members'].map(tag => (
            <span key={tag} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: '#EEF2FF', color: '#4338CA', border: '0.5px solid #A5B4FC' }}>{tag}</span>
          ))}
        </div>
      </div>

      {!selectedBug ? (
        <>
          {/* Bug list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {BUGS.map(bug => (
              <div key={bug.id} onClick={() => !running && runDemo(bug)}
                style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor='#6366F1'; (e.currentTarget as HTMLElement).style.boxShadow='0 2px 12px rgba(99,102,241,0.1)'; }}
                onMouseOut={e =>  { (e.currentTarget as HTMLElement).style.borderColor='var(--color-border-secondary)'; (e.currentTarget as HTMLElement).style.boxShadow='none'; }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', flexShrink: 0, marginTop: '2px', background: bug.severity==='Critical'?'#FEE2E2':'#FEF3C7', color: bug.severity==='Critical'?'#991B1B':'#92400E' }}>
                    {bug.severity}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#4F46E5', fontWeight: 600 }}>{bug.id}</span>
                      <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '20px', background: bug.contextDomain==='bds'?'#DBEAFE':'#E0E7FF', color: bug.contextDomain==='bds'?'#1D4ED8':'#4338CA', border: `0.5px solid ${bug.contextDomain==='bds'?'#93C5FD':'#A5B4FC'}` }}>
                        {bug.domain}
                      </span>
                      <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '20px', background: '#F3F4F6', color: '#6B7280', border: '0.5px solid #D1D5DB' }}>{bug.type}</span>
                      {bug.compliance.map(c => (
                        <span key={c} style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '20px', background: '#ECFDF5', color: '#065F46', border: '0.5px solid #6EE7B7' }}>✓ {c}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 3px', color: 'var(--color-text-primary)' }}>{bug.title}</p>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>{bug.description}</p>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {bug.allowedTables.map(t => (
                        <span key={t} style={{ fontSize: '10px', fontFamily: 'monospace', padding: '1px 6px', borderRadius: '4px', background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)', border: '0.5px solid var(--color-border-tertiary)' }}>{t.split('.')[1]}</span>
                      ))}
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#F5F3FF', color: '#7C3AED', border: '0.5px solid #DDD6FE' }}>🔒 {bug.policyKey}</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '76px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#6366F1', lineHeight: 1 }}>—</div>
                    <div style={{ fontSize: '9px', color: '#6366F1', fontWeight: 600, marginTop: '2px' }}>run to score</div>
                    <div style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', marginTop: '1px' }}>fix confidence</div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', flexShrink: 0, marginTop: '6px' }}>▶ Run</div>
                </div>
              </div>
            ))}
          </div>

          {/* Scanner */}
          <div style={{ background: 'var(--color-background-primary)', border: '1px solid #4F46E5', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: scanResult?'10px':'0' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>🔍 Autonomous Code Scanner</p>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Agent scans codebase, classifies by BDS/CTS domain, returns confidence scores — without being told what to find</p>
              </div>
              <button onClick={runScan} disabled={scanRunning}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: scanRunning?'var(--color-background-secondary)':'#4F46E5', color: scanRunning?'var(--color-text-secondary)':'white', fontSize: '13px', fontWeight: 600, cursor: scanRunning?'default':'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '16px' }}>
                {scanRunning && <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid #999', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />}
                {scanRunning ? 'Scanning...' : '▶ Scan Codebase'}
              </button>
            </div>
            {scanResult && (
              <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', margin: 0, maxHeight: '200px', overflowY: 'auto', background: 'var(--color-background-secondary)', padding: '12px', borderRadius: '8px' }}>{scanResult}</pre>
            )}
          </div>

          {/* Pipeline overview — 9 steps + 3 gates */}
          <div style={{ background: 'var(--color-background-secondary)', borderRadius: '12px', padding: '14px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Agentic SDLC Pipeline — Gitflow · 3 Human gates · Jenkins system test
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              {PIPELINE_STEPS.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <div style={{ fontSize: '11px', padding: '5px 10px', background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: '8px', color: 'var(--color-text-secondary)' }}>
                    {step.icon} {step.label}
                  </div>
                  {idx === 4 && (
                    <>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                      <div style={{ fontSize: '11px', padding: '5px 10px', background: '#E0F2FE', border: '0.5px solid #7DD3FC', borderRadius: '8px', color: '#0369A1', fontWeight: 600 }}>🌿 Release branch</div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                    </>
                  )}
                  {idx === 5 && (
                    <>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                      <div style={{ fontSize: '11px', padding: '5px 10px', background: '#FEF3C7', border: '0.5px solid #F59E0B', borderRadius: '8px', color: '#92400E', fontWeight: 600 }}>⏸ PR approval</div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                    </>
                  )}
                  {idx === 7 && (
                    <>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                      <div style={{ fontSize: '11px', padding: '5px 10px', background: '#F5F3FF', border: '0.5px solid #A78BFA', borderRadius: '8px', color: '#5B21B6', fontWeight: 600 }}>🔄 Sync gate</div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                    </>
                  )}
                  {![4, 5, 7].includes(idx) && idx < PIPELINE_STEPS.length-1 && <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Bug header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <button onClick={resetDemo} disabled={running} style={{ fontSize: '12px', padding: '6px 12px', border: '0.5px solid var(--color-border-secondary)', borderRadius: '8px', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>← Back</button>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#4F46E5', fontWeight: 600 }}>{selectedBug.id}</span>
                <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '20px', background: '#F5F3FF', color: '#7C3AED', border: '0.5px solid #DDD6FE' }}>🔒 {selectedBug.policyKey}</span>
                {selectedBug.compliance.map(c => (
                  <span key={c} style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '20px', background: '#ECFDF5', color: '#065F46', border: '0.5px solid #6EE7B7' }}>✓ {c}</span>
                ))}
              </div>
              <p style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{selectedBug.title}</p>
            </div>
          </div>

          {/* Policy boundary panel */}
          <div style={{ background: '#1E1B4B', border: '1px solid #4338CA', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '9px', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px', fontWeight: 600 }}>🔒 Allowed Files</p>
              {selectedBug.allowedFiles.map(f => <p key={f} style={{ fontSize: '11px', color: '#A5B4FC', fontFamily: 'monospace', margin: 0 }}>📄 {f}</p>)}
            </div>
            <div>
              <p style={{ fontSize: '9px', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px', fontWeight: 600 }}>🗄 Allowed Tables</p>
              {selectedBug.allowedTables.map(t => <p key={t} style={{ fontSize: '11px', color: '#A5B4FC', fontFamily: 'monospace', margin: 0 }}>{t}</p>)}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '9px', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px', fontWeight: 600 }}>💰 Business Impact</p>
              <p style={{ fontSize: '11px', color: '#C7D2FE', margin: 0 }}>{selectedBug.businessImpact}</p>
            </div>
          </div>

          {/* Eval criteria */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>🎯 Fix Evaluation Criteria — Agent scores its own output</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: overallEval?'12px':'0' }}>
              {selectedBug.evalCriteria.map(c => {
                const raw = overallEval?.scores?.[c.key];
                const filled = overallEval != null && !overallEval.evalRunning && raw !== undefined;
                return (
                  <div key={c.key} style={{ flex: '1 1 170px', background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '8px 10px', border: `0.5px solid ${filled ? scoreColor(raw!/10) : 'var(--color-border-tertiary)'}`, transition: 'border-color 0.5s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{c.label}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: filled ? scoreColor(raw!/10) : 'var(--color-text-tertiary)' }}>
                        {overallEval?.evalRunning ? '...' : filled ? `${raw}/10` : '—'}
                      </span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--color-border-tertiary)', borderRadius: '2px' }}>
                      <div style={{ height: '4px', borderRadius: '2px', background: filled ? scoreColor(raw!/10) : 'transparent', width: filled ? `${raw!*10}%` : '0%', transition: 'width 0.8s ease' }} />
                    </div>
                    <p style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', margin: '3px 0 0' }}>weight: {c.weight}%</p>
                  </div>
                );
              })}
            </div>
            {overallEval && (
              <div style={{ padding: '12px 14px', borderRadius: '8px', background: overallEval.evalRunning ? 'var(--color-background-secondary)' : scoreBg(overallEval.score), border: `1px solid ${overallEval.evalRunning ? 'var(--color-border-secondary)' : scoreColor(overallEval.score)}` }}>
                {overallEval.evalRunning ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #6366F1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>LLM evaluating fix quality against domain rubric...</span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: overallEval.gaps?.length ? '10px' : '0' }}>
                      <div style={{ fontSize: '32px', fontWeight: 800, color: scoreColor(overallEval.score), lineHeight: 1 }}>
                        {Math.round(overallEval.score * 100)}%
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: scoreColor(overallEval.score), margin: '0 0 2px' }}>
                          {overallEval.confidence_label || scoreLabel(overallEval.score)} — LLM Evaluated
                        </p>
                        <p style={{ fontSize: '11px', color: scoreColor(overallEval.score), margin: 0 }}>
                          {overallEval.refined
                            ? '⚠ Below 80% threshold — agent refined fix before creating PR'
                            : '✓ Above 80% quality threshold — PR created'}
                        </p>
                      </div>
                    </div>
                    {overallEval.reviewer_notes && (
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 8px', fontStyle: 'italic', borderTop: '0.5px solid var(--color-border-secondary)', paddingTop: '8px' }}>
                        💬 Reviewer note: {overallEval.reviewer_notes}
                      </p>
                    )}
                    {overallEval.gaps && overallEval.gaps.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>⚠ Gaps identified</p>
                        {overallEval.gaps.map((g, i) => (
                          <p key={i} style={{ fontSize: '11px', color: '#92400E', margin: '2px 0', paddingLeft: '8px' }}>• {g}</p>
                        ))}
                      </div>
                    )}
                    {overallEval.suggestions && overallEval.suggestions.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>💡 Suggestions</p>
                        {overallEval.suggestions.map((s, i) => (
                          <p key={i} style={{ fontSize: '11px', color: '#1D4ED8', margin: '2px 0', paddingLeft: '8px' }}>• {s}</p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Code panels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            {(['bug','fix'] as const).map(type => (
              <div key={type} onClick={() => setShowCode(showCode===type?null:type)}
                style={{ background: 'var(--color-background-primary)', border: showCode===type ? `2px solid ${type==='bug'?'#E24B4A':'#16A34A'}` : '0.5px solid var(--color-border-tertiary)', borderRadius: '10px', padding: '12px', cursor: 'pointer' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 8px', color: type==='bug'?'#A32D2D':'#16A34A' }}>{type==='bug'?'🐛 Buggy code':'✅ Fixed code'}</p>
                <pre style={{ fontSize: '10px', margin: 0, color: 'var(--color-text-secondary)', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {type==='bug' ? selectedBug.codeSnippet : selectedBug.fixSnippet}
                </pre>
              </div>
            ))}
          </div>

          {/* Pipeline steps row — 9 steps + 3 gate badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {PIPELINE_STEPS.map((step, idx) => {
              const result   = stepResults[step.id];
              const isActive = currentStep === step.id;
              const isDone   = result?.status === 'done';
              const isError  = result?.status === 'error';
              const rbs = releaseBadgeStyle();
              const sbs = syncBadgeStyle();
              return (
                <React.Fragment key={step.id}>
                  <button onClick={() => isDone && setExpandedStep(expandedStep===step.id?null:step.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: isActive?600:400, cursor: isDone?'pointer':'default', border: isActive?'2px solid #4F46E5':isDone?'0.5px solid #16A34A':isError?'0.5px solid #E24B4A':'0.5px solid var(--color-border-tertiary)', background: isActive?'#EEF2FF':isDone?'#F0FDF4':isError?'#FEF2F2':'var(--color-background-secondary)', color: isActive?'#4F46E5':isDone?'#15803D':isError?'#B91C1C':'var(--color-text-tertiary)' }}>
                    {isActive && <div style={{ width: '9px', height: '9px', borderRadius: '50%', border: '2px solid #4F46E5', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />}
                    {isDone  && <span style={{ fontSize: '10px' }}>✓</span>}
                    {isError && <span style={{ fontSize: '10px' }}>✗</span>}
                    {!isActive && !isDone && !isError && <span>{step.icon}</span>}
                    {step.label}
                    {isDone && result.duration>0 && <span style={{ fontSize: '10px', opacity: 0.7 }}>{result.duration}s</span>}
                  </button>

                  {/* Gate A badge — after step 5 (idx 4) */}
                  {idx === 4 && (
                    <>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                      <div style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', fontWeight: 600, background: rbs.bg, border: rbs.border, color: rbs.color }}>
                        {releaseBranchGate === 'resolved' ? `✓ ${selectedReleaseBranch}` : releaseBranchGate === 'waiting' ? '🌿 Select branch' : '🌿 Release branch'}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                    </>
                  )}

                  {/* Gate B badge — after step 6 (idx 5) */}
                  {idx === 5 && (
                    <>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                      <div style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', fontWeight: 600, background: gateStatus==='approved'?'#F0FDF4':gateStatus==='rejected'?'#FEF2F2':gateStatus==='waiting'?'#FFFBEB':'var(--color-background-secondary)', border: gateStatus==='approved'?'0.5px solid #16A34A':gateStatus==='rejected'?'0.5px solid #E24B4A':gateStatus==='waiting'?'2px solid #F59E0B':'0.5px solid var(--color-border-tertiary)', color: gateStatus==='approved'?'#15803D':gateStatus==='rejected'?'#B91C1C':gateStatus==='waiting'?'#92400E':'var(--color-text-tertiary)' }}>
                        {gateStatus==='approved'?'✓ PR approved':gateStatus==='rejected'?'✗ Rejected':gateStatus==='changes_requested'?'↩ Changes':gateStatus==='waiting'?'⏸ Awaiting PR':'⏸ PR approval'}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                    </>
                  )}

                  {/* Gate C badge — after step 8 (idx 7) */}
                  {idx === 7 && (
                    <>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                      <div style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', fontWeight: 600, background: sbs.bg, border: sbs.border, color: sbs.color }}>
                        {syncGateStatus === 'done' ? '✓ Synced' : syncGateStatus === 'skipped' ? '— Skipped' : syncGateStatus === 'syncing' ? '🔄 Syncing...' : syncGateStatus === 'waiting' ? '🔄 Sync?' : '🔄 Sync gate'}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                    </>
                  )}

                  {![4, 5, 7].includes(idx) && idx < PIPELINE_STEPS.length-1 && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Expanded step panel */}
          {expandedStep && stepResults[expandedStep] && (
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                  {PIPELINE_STEPS[expandedStep-1].icon} Step {expandedStep}: {PIPELINE_STEPS[expandedStep-1].label}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {stepResults[expandedStep].policy_domain && (
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: '#EDE9FE', color: '#6D28D9', border: '0.5px solid #A78BFA' }}>🔒 {stepResults[expandedStep].policy_domain?.toUpperCase()}</span>
                  )}
                  {(stepResults[expandedStep].compliance_checks||[]).map((c:string) => (
                    <span key={c} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: '#ECFDF5', color: '#065F46', border: '0.5px solid #6EE7B7' }}>✓ {c}</span>
                  ))}
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{stepResults[expandedStep].duration}s</span>
                </div>
              </div>
              {expandedStep === 6 && prUrl && (
                <a href={prUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#1D4ED8', textDecoration: 'none', marginBottom: '10px', padding: '5px 12px', background: '#EFF6FF', borderRadius: '8px', border: '0.5px solid #93C5FD', fontWeight: 500 }}>
                  🔗 View PR #{prNumber} on GitHub →
                </a>
              )}
              <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', margin: 0, maxHeight: '280px', overflowY: 'auto', background: 'var(--color-background-secondary)', padding: '12px', borderRadius: '8px', lineHeight: 1.6 }}>
                {stepResults[expandedStep].response}
              </pre>
            </div>
          )}

          {/* Gate A — Release branch selection */}
          {releaseBranchGate === 'waiting' && (
            <div style={{ background: '#F0F9FF', border: '2px solid #0EA5E9', borderRadius: '12px', padding: '18px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                <span style={{ fontSize: '22px' }}>🌿</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#0C4A6E', margin: '0 0 3px' }}>Select Release Branch</p>
                  <p style={{ fontSize: '12px', color: '#0369A1', margin: 0 }}>
                    The fix branch will be cut from <code style={{ background: '#BAE6FD', padding: '1px 5px', borderRadius: '4px' }}>develop</code> and a PR will target the release branch you choose below.
                  </p>
                </div>
              </div>

              {/* Existing branches */}
              {availableReleaseBranches.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ fontSize: '11px', color: '#0369A1', fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Existing release branches</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {availableReleaseBranches.map(b => (
                      <button key={b} onClick={() => handleSelectReleaseBranch(b)}
                        style={{ padding: '7px 14px', borderRadius: '8px', border: selectedReleaseBranch===b ? '2px solid #0EA5E9' : '0.5px solid #BAE6FD', background: selectedReleaseBranch===b ? '#E0F2FE' : 'white', color: '#0369A1', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace' }}>
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Create new branch */}
              <div>
                <p style={{ fontSize: '11px', color: '#0369A1', fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Or create a new release branch</p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    value={newReleaseName}
                    onChange={e => setNewReleaseName(e.target.value)}
                    placeholder="release/aug-2026"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '0.5px solid #BAE6FD', fontSize: '12px', fontFamily: 'monospace', color: '#0C4A6E', background: 'white' }}
                  />
                  <button onClick={handleCreateAndSelectReleaseBranch} disabled={!newReleaseName || creatingReleaseBranch}
                    style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: !newReleaseName || creatingReleaseBranch ? '#E2E8F0' : '#0EA5E9', color: !newReleaseName || creatingReleaseBranch ? '#94A3B8' : 'white', fontSize: '12px', fontWeight: 600, cursor: !newReleaseName || creatingReleaseBranch ? 'default' : 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {creatingReleaseBranch && <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid #94A3B8', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />}
                    {creatingReleaseBranch ? 'Creating...' : '+ Create & Select'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Gate B — PR approval */}
          {gateStatus === 'waiting' && (
            <div style={{ background: '#FFFBEB', border: '2px solid #F59E0B', borderRadius: '12px', padding: '18px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                <span style={{ fontSize: '22px' }}>⏸</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#92400E', margin: '0 0 3px' }}>Human Approval Gate — PR Review</p>
                  <p style={{ fontSize: '12px', color: '#B45309', margin: 0 }}>
                    PR opened on <code style={{ background: '#FDE68A', padding: '1px 5px', borderRadius: '4px' }}>{selectedReleaseBranch}</code>. Review the code in GitHub, then approve to continue to code review.
                    <br /><strong>Boundary: </strong>scoped to {selectedBug.allowedFiles[0]} · Tables: {selectedBug.allowedTables.join(', ')}
                    {overallEval && !overallEval.evalRunning && <><br /><strong>Fix confidence: </strong><span style={{ color: scoreColor(overallEval.score), fontWeight: 700 }}>{Math.round(overallEval.score*100)}% — {scoreLabel(overallEval.score)}</span></>}
                  </p>
                </div>
              </div>
              {prUrl && (
                <a href={prUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1D4ED8', textDecoration: 'none', marginBottom: '14px', padding: '7px 14px', background: '#EFF6FF', borderRadius: '8px', border: '0.5px solid #93C5FD', fontWeight: 600 }}>
                  🔗 Open PR #{prNumber} in GitHub →
                </a>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={handleApprove} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#16A34A', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>✓ Approve & Continue</button>
                <button onClick={() => setShowCommentBox(!showCommentBox)} style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid #F59E0B', background: '#FEF3C7', color: '#92400E', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>↩ Request Changes</button>
                <button onClick={handleReject} style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid #E24B4A', background: '#FEF2F2', color: '#B91C1C', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>✗ Reject</button>
              </div>
              {showCommentBox && (
                <div style={{ marginTop: '12px' }}>
                  <textarea value={gateComment} onChange={e => setGateComment(e.target.value)}
                    placeholder="Describe changes needed — agent will refine the fix..."
                    rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '0.5px solid var(--color-border-secondary)', fontSize: '13px', color: 'var(--color-text-primary)', background: 'var(--color-background-primary)', resize: 'vertical', boxSizing: 'border-box' }} />
                  <button onClick={handleRequestChanges} style={{ marginTop: '8px', padding: '7px 16px', borderRadius: '8px', border: 'none', background: '#F59E0B', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Submit Request</button>
                </div>
              )}
            </div>
          )}

          {gateStatus === 'rejected' && (
            <div style={{ background: '#FEF2F2', border: '0.5px solid #E24B4A', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#B91C1C', margin: '0 0 4px' }}>Pipeline stopped — PR rejected</p>
              <p style={{ fontSize: '12px', color: '#B91C1C', margin: 0 }}>Jira ticket updated. Review technical design and restart.</p>
            </div>
          )}
          {gateStatus === 'changes_requested' && (
            <div style={{ background: '#FFFBEB', border: '0.5px solid #F59E0B', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#92400E', margin: '0 0 4px' }}>Pipeline paused — changes requested</p>
              {gateComment && <p style={{ fontSize: '12px', color: '#B45309', margin: '4px 0 6px', fontStyle: 'italic' }}>"{gateComment}"</p>}
              <p style={{ fontSize: '12px', color: '#B45309', margin: 0 }}>Update the PR on GitHub and re-run.</p>
            </div>
          )}

          {/* System test complete banner */}
          {pipelineComplete && (
            <div style={{ background: '#F0FDF4', border: '0.5px solid #16A34A', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#15803D', margin: '0 0 6px' }}>✅ System test passed — fix verified on <code style={{ background: '#BBF7D0', padding: '1px 6px', borderRadius: '4px' }}>{selectedReleaseBranch}</code></p>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#166534' }}>⏱ {Object.values(stepResults).reduce((s,r)=>s+(r.duration||0),0)}s total</span>
                {overallEval && !overallEval.evalRunning && <span style={{ fontSize: '11px', color: scoreColor(overallEval.score) }}>🎯 {Math.round(overallEval.score*100)}% fix confidence</span>}
                <span style={{ fontSize: '11px', color: '#166534' }}>🔒 {selectedBug.policyKey}</span>
                <span style={{ fontSize: '11px', color: '#166534' }}>✓ {selectedBug.compliance.join(' + ')}</span>
              </div>
            </div>
          )}

          {/* Gate C — Sync to develop */}
          {syncGateStatus === 'waiting' && (
            <div style={{ background: '#F5F3FF', border: '2px solid #7C3AED', borderRadius: '12px', padding: '18px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                <span style={{ fontSize: '22px' }}>🔄</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#4C1D95', margin: '0 0 3px' }}>Sync Fix to Develop?</p>
                  <p style={{ fontSize: '12px', color: '#5B21B6', margin: 0 }}>
                    System tests passed on <code style={{ background: '#DDD6FE', padding: '1px 5px', borderRadius: '4px' }}>{selectedReleaseBranch}</code>. Sync this fix back to <code style={{ background: '#DDD6FE', padding: '1px 5px', borderRadius: '4px' }}>develop</code> so it's included in the next production release cycle.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSyncYes} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#7C3AED', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>🔄 Yes, Sync to Develop</button>
                <button onClick={handleSyncSkip} style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid #7C3AED', background: 'white', color: '#7C3AED', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Skip for Now</button>
              </div>
            </div>
          )}

          {syncGateStatus === 'done' && (
            <div style={{ background: '#F5F3FF', border: '0.5px solid #7C3AED', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#5B21B6', margin: '0 0 4px' }}>✅ Synced to develop — fix available for next production release</p>
              <p style={{ fontSize: '12px', color: '#6D28D9', margin: 0 }}>PR opened from <code style={{ background: '#DDD6FE', padding: '1px 4px', borderRadius: '4px' }}>{selectedReleaseBranch}</code> → <code style={{ background: '#DDD6FE', padding: '1px 4px', borderRadius: '4px' }}>develop</code></p>
            </div>
          )}

          {syncGateStatus === 'skipped' && (
            <div style={{ background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Sync skipped — run <code>github_integration sync_to_develop</code> manually when ready.</p>
            </div>
          )}

          {/* Release notes */}
          {showRelease && (
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>🚀 Release Notes</p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Generate v1.1.0 release notes with compliance summary for <code>{selectedReleaseBranch}</code></p>
                </div>
                <button onClick={generateReleaseNotes} disabled={releaseRunning}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: releaseRunning?'var(--color-background-secondary)':'#4F46E5', color: releaseRunning?'var(--color-text-secondary)':'white', fontSize: '13px', fontWeight: 600, cursor: releaseRunning?'default':'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {releaseRunning && <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid #999', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />}
                  {releaseRunning ? 'Generating...' : '🚀 Generate Release Notes'}
                </button>
              </div>
              {releaseResult && (
                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', margin: 0, maxHeight: '280px', overflowY: 'auto', background: 'var(--color-background-secondary)', padding: '12px', borderRadius: '8px' }}>{releaseResult}</pre>
              )}
            </div>
          )}

          {running && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #4F46E5', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Step {currentStep}/{PIPELINE_STEPS.length}: {PIPELINE_STEPS[currentStep-1]?.label} · policy: {selectedBug.policyKey}...
              </span>
            </div>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
