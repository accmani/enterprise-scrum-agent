import React, { useState } from 'react';
import { chatApi } from '../../services/api';

// ── Domain definitions ─────────────────────────────────────────────────────────

const DOMAINS = [
  {
    id: 'bds',
    label: 'BDS — Benefit Determination',
    subtitle: 'Distributed Java · DB2 MMBR / PLN_BEN_CONFIG',
    bg: '#1565C0',
    border: '#42A5F5',
    headerBg: '#1976D2',
    orchestrators: [
      {
        id: 'bds-orch-1',
        label: 'Benefits Orchestrator',
        desc: 'Routes eligibility & benefit queries · reads HCSC_DB2.MMBR and PLN_BEN_CONFIG',
        icon: '🧠',
      },
    ],
    specialists: [
      {
        id: 'bds-sp-1',
        label: 'Eligibility Agent',
        desc: 'Validates MMBR.TERM_DT, plan enrollment, COBRA status in DB2',
        icon: '✅',
      },
      {
        id: 'bds-sp-2',
        label: 'Accumulator Agent',
        desc: 'Reads ODS COV_ACCUM_HIST — YTD deductible, OOP max, copay thresholds',
        icon: '🧮',
      },
    ],
    external: {
      id: 'bds-ext',
      label: 'PA Gateway (PRIOR_AUTH_TXN)',
      desc: 'Checks DB2 PRIOR_AUTH_TXN for specialist referral & high-cost PA decisions',
      icon: '🔑',
    },
    context: [
      'HCSC_DB2.MMBR — member enrollment & TERM_DT',
      'HCSC_DB2.PLN_BEN_CONFIG — copay, deductible limits',
      'HCSC_ODS.COV_ACCUM_HIST — YTD accumulator history',
      'HCSC_DB2.PRIOR_AUTH_TXN — PA decisions cache',
    ],
  },
  {
    id: 'core',
    label: 'CTS — Core Adjudication',
    subtitle: 'Mainframe COBOL · DB2 CLM_HDR / CLM_LINE',
    bg: '#0D2B6E',
    border: '#5C6BC0',
    headerBg: '#1A237E',
    orchestrators: [
      {
        id: 'core-orch-1',
        label: 'CTS Adj Orchestrator',
        desc: 'Receives context from Enterprise Agentic Bus, routes to COBOL adjudication routines (CLMADJX1/X2)',
        icon: '⚡',
      },
      {
        id: 'core-orch-2',
        label: 'Payment Orchestrator',
        desc: 'Finalizes PAID_AMT in CLM_HDR, triggers ODS write-back and EOB generation',
        icon: '💳',
      },
    ],
    specialists: [
      {
        id: 'core-sp-1',
        label: 'ICD-10 Validator',
        desc: 'Validates CLM_LINE.DIAG_CD against ODS DX_CODE_REF allowlist (Z00–Z13 ACA)',
        icon: '🏥',
      },
      {
        id: 'core-sp-2',
        label: 'Fee Schedule Agent',
        desc: 'Applies PRVDR contract rates from DB2 PRVDR_FEE_SCHED, COB logic',
        icon: '⚙️',
      },
    ],
    external: {
      id: 'core-ext',
      label: 'EOB Generator (Distributed)',
      desc: 'REST service reads adjudicated CLM_HDR, produces member EOB documents',
      icon: '📄',
    },
    context: [
      'HCSC_DB2.CLM_HDR — claim header, ADJUD_STS, PAID_AMT',
      'HCSC_DB2.CLM_LINE — line items, DIAG_CD, PROC_CD',
      'HCSC_DB2.PRVDR_FEE_SCHED — provider contracts',
      'HCSC_ODS.DX_CODE_REF — ICD-10 / CPT allowlists',
    ],
  },
];

const FLOW_STEPS = [
  { step: '1', label: 'Member / Provider submits claim (CTS intake)', icon: '👤', color: '#7C3AED' },
  { step: '2', label: 'BDS: MMBR eligibility + accumulator check (DB2/ODS)', icon: '✅', color: '#1976D2' },
  { step: '3', label: 'Enterprise Agentic Bus packages & routes BDS context', icon: '🔀', color: '#C2185B' },
  { step: '4', label: 'CTS COBOL adj (CLMADJX1) + ICD-10 / fee schedule', icon: '⚡', color: '#0D2B6E' },
  { step: '5', label: 'ODS write-back + EOB generated for member', icon: '📄', color: '#2E7D32' },
];

// ── Cross-domain scenarios ─────────────────────────────────────────────────────

const CONTEXT_SCENARIOS = [
  {
    id: 'CS-001',
    label: 'Cross-System Eligibility + CTS Adjudication',
    icon: '🔄',
    domains: ['BDS — Benefit Determination', 'CTS — Core Adjudication'],
    description: 'BDS queries MMBR + ODS accumulators, Enterprise Agentic Bus packages context and routes to CTS COBOL adjudication (CLMADJX1).',
    prompt: 'You are demonstrating the HCSC Agentic AI SDLC Context Engine. A specialist claim arrives for BCBS-IL member MBR-8821. Walk through the cross-system flow: 1) BDS Eligibility Agent queries HCSC_DB2.MMBR — confirms enrollment, checks TERM_DT, 2) BDS Accumulator Agent reads HCSC_ODS.COV_ACCUM_HIST — YTD deductible $1,200/$1,500, OOP $3,100/$5,000, 3) PA Gateway checks HCSC_DB2.PRIOR_AUTH_TXN — PA#887234 approved for this specialist, 4) Enterprise Agentic Bus packages full BDS context and routes to CTS Core Adjudication, 5) CTS Adj Orchestrator calls COBOL routine CLMADJX1 with context, 6) Fee Schedule Agent applies PRVDR_FEE_SCHED for in-network provider, 7) Payment Orchestrator writes ADJUD_STS=APPRVD and PAID_AMT=$240 to CLM_HDR, 8) ODS write-back updates COV_ACCUM_HIST, EOB triggered. Show the context window passed between each HCSC system.',
  },
  {
    id: 'CS-002',
    label: 'PA Gate → BDS PRIOR_AUTH_TXN Check',
    icon: '🔑',
    domains: ['BDS — Benefit Determination'],
    description: 'BDS detects missing PA for specialist claim, initiates auth workflow against PRIOR_AUTH_TXN table.',
    prompt: 'You are demonstrating the HCSC Agentic AI SDLC Context Engine. A specialist claim (SVC_TYPE=SPEC, PRVDR_ID=NPI-4421) arrives with no PRIOR_AUTH_TXN record (reproducing BUG-007). Show how Agentic AI SDLC handles it: 1) BDS Benefits Orchestrator reads CLM_HDR.SVC_TYPE=SPEC from CTS intake, 2) PA Gateway queries HCSC_DB2.PRIOR_AUTH_TXN — no matching AUTH_ID found, 3) BDS Accumulator Agent checks PLN_BEN_CONFIG — this plan requires PA for all specialist visits over $200, 4) Benefits Orchestrator flags claim ADJUD_STS=PEND-PA in CLM_HDR, 5) PA workflow initiated — AUTH_REQ_TXN record created in DB2, 6) Once PA approved, Enterprise Agentic Bus forwards to CTS for adjudication with PA confirmation. Show the DB2 tables written at each step.',
  },
  {
    id: 'CS-003',
    label: 'ICD-10 Z-Code Denial Recovery (ACA Mandate)',
    icon: '🏥',
    domains: ['CTS — Core Adjudication', 'BDS — Benefit Determination'],
    description: 'CTS ICD-10 Validator denies Z00.00 wellness code; BDS + ODS consulted to recover under ACA mandate.',
    prompt: 'You are demonstrating the HCSC Agentic AI SDLC Context Engine. A BCBS-TX preventive care claim with ICD-10 Z00.00 (wellness visit) is denied by CTS ICD-10 Validator because HCSC_ODS.DX_CODE_REF snapshot is missing Z00–Z13 range (BUG-006). Show the Agentic AI SDLC recovery flow: 1) CTS ICD-10 Validator checks CLM_LINE.DIAG_CD=Z00.00 against DX_CODE_REF — not found, initial denial, 2) CTS Adj Orchestrator escalates — cross-domain query to BDS via Enterprise Agentic Bus, 3) BDS reads PLN_BEN_CONFIG.ACA_PREV_CARE_IND=Y — this plan covers ACA preventive care, 4) BDS cross-references HCSC regulatory rules — Z00–Z13 mandated by ACA, cannot deny, 5) CTS overrides denial, sets ADJUD_STS=APPRVD, 6) DX_CODE_REF gap logged in ODS.DX_CODE_GAP_AUDIT table, 7) Agentic AI SDLC creates Jira ticket for CTS team to patch ODS allowlist. Show each DB2/ODS table touched.',
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function AgentCard({
  label, desc, icon, variant, onClick, selected,
}: {
  label: string; desc: string; icon: string;
  variant: 'orchestrator' | 'specialist' | 'external' | 'broker' | 'receiver';
  onClick?: () => void; selected?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    orchestrator: { background: '#374151', border: '1px solid #6B7280', color: '#F9FAFB' },
    broker:       { background: '#374151', border: '2px solid #C084FC', color: '#F9FAFB' },
    receiver:     { background: '#374151', border: '2px solid #C084FC', color: '#F9FAFB' },
    specialist:   { background: '#4B5563', border: '1px solid #9CA3AF', color: '#F3F4F6' },
    external:     { background: '#92400E', border: '2px solid #F59E0B', color: '#FEF3C7' },
  };

  const base = styles[variant] || styles.orchestrator;
  return (
    <div
      onClick={onClick}
      style={{
        ...base,
        borderRadius: '8px',
        padding: '10px 12px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
        boxShadow: selected ? '0 0 0 2px #A78BFA, 0 4px 12px rgba(167,139,250,0.3)' : 'none',
        transform: selected ? 'translateY(-2px)' : 'none',
        minWidth: '120px',
        flex: 1,
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: base.color as string, lineHeight: 1.2 }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: '10px', color: '#D1D5DB', margin: 0, lineHeight: 1.4 }}>{desc}</p>
    </div>
  );
}

function DomainPanel({ domain, selectedAgent, onSelectAgent }: {
  domain: typeof DOMAINS[0];
  selectedAgent: string | null;
  onSelectAgent: (id: string) => void;
}) {
  return (
    <div style={{
      background: domain.bg,
      border: `2px solid ${domain.border}`,
      borderRadius: '14px',
      flex: 1,
      overflow: 'hidden',
    }}>
      <div style={{ background: domain.headerBg, padding: '14px 18px' }}>
        <p style={{ fontSize: '16px', fontWeight: 800, color: 'white', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {domain.label}
        </p>
        <p style={{ fontSize: '11px', color: '#90CAF9', margin: 0 }}>{domain.subtitle}</p>
      </div>

      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '9px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
          Orchestrator Agents
        </p>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          {domain.orchestrators.map(o => (
            <AgentCard
              key={o.id}
              label={o.label}
              desc={o.desc}
              icon={o.icon}
              variant="orchestrator"
              selected={selectedAgent === o.id}
              onClick={() => onSelectAgent(o.id)}
            />
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${domain.border}40`, margin: '0 0 12px' }} />

        <p style={{ fontSize: '9px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
          Specialist & External Agents
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          {domain.specialists.map(s => (
            <AgentCard
              key={s.id}
              label={s.label}
              desc={s.desc}
              icon={s.icon}
              variant="specialist"
              selected={selectedAgent === s.id}
              onClick={() => onSelectAgent(s.id)}
            />
          ))}
          <AgentCard
            key={domain.external.id}
            label={domain.external.label}
            desc={domain.external.desc}
            icon={domain.external.icon}
            variant="external"
            selected={selectedAgent === domain.external.id}
            onClick={() => onSelectAgent(domain.external.id)}
          />
        </div>

        <div style={{ marginTop: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 12px' }}>
          <p style={{ fontSize: '9px', fontWeight: 600, color: '#7DD3FC', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
            🗂 Domain Context Window
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {domain.context.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                <span style={{ fontSize: '9px', color: '#60A5FA', marginTop: '1px', flexShrink: 0 }}>▸</span>
                <span style={{ fontSize: '10px', color: '#CBD5E1' }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Enterprise Agentic Bus (standalone center node) ────────────────────────

function EnterpriseAgenticBus() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '170px',
      flexShrink: 0,
      gap: '0',
    }}>
      {/* Arrow in from BDS */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '6px' }}>
        <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, #42A5F5, #C084FC)' }} />
        <div style={{
          width: 0, height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: '7px solid #C084FC',
        }} />
      </div>

      {/* Broker box */}
      <div style={{
        background: '#1E1B4B',
        border: '2px solid #C084FC',
        borderRadius: '12px',
        padding: '14px 12px',
        textAlign: 'center',
        width: '100%',
        boxShadow: '0 0 24px rgba(192,132,252,0.3)',
      }}>
        <div style={{ fontSize: '24px', marginBottom: '6px' }}>🔀</div>
        <p style={{
          fontSize: '10px', fontWeight: 800, color: '#E0E7FF',
          margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3,
        }}>
          Enterprise<br/>Agentic Bus
        </p>
        <p style={{ fontSize: '9px', color: '#A78BFA', margin: '0 0 10px' }}>
          Cross-Domain Broker
        </p>
        <div style={{ borderTop: '1px solid #4338CA', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {[
            { icon: '📦', label: 'Packages BDS context' },
            { icon: '🔄', label: 'Transforms payload' },
            { icon: '🛣️', label: 'Routes to CTS queue' },
            { icon: '📋', label: 'Writes audit log' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '10px', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: '9px', color: '#C4B5FD', textAlign: 'left', lineHeight: 1.3 }}>{item.label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px', borderTop: '1px solid #4338CA', paddingTop: '8px' }}>
          <p style={{ fontSize: '8px', color: '#6D28D9', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            MuleSoft / IBM MQ
          </p>
          <p style={{ fontSize: '8px', color: '#7C3AED', margin: '2px 0 0' }}>
            or Custom ESB
          </p>
        </div>
      </div>

      {/* Arrow out to CTS */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginTop: '6px' }}>
        <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, #C084FC, #5C6BC0)' }} />
        <div style={{
          width: 0, height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: '7px solid #5C6BC0',
        }} />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ContextEngine() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showFlow, setShowFlow] = useState(false);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Record<string, string>>({});
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  const runScenario = async (scenario: typeof CONTEXT_SCENARIOS[0]) => {
    setRunningScenario(scenario.id);
    setExpandedScenario(scenario.id);
    setScenarioResults(prev => ({ ...prev, [scenario.id]: '' }));
    try {
      const result = await chatApi.send(scenario.prompt, [], 'tech_lead');
      setScenarioResults(prev => ({ ...prev, [scenario.id]: result.reply }));
    } catch (e: any) {
      setScenarioResults(prev => ({ ...prev, [scenario.id]: `Error: ${e.message}` }));
    }
    setRunningScenario(null);
  };

  const handleSelect = (id: string) => {
    setSelectedAgent(prev => prev === id ? null : id);
  };

  const allAgents = DOMAINS.flatMap(d => [
    ...d.orchestrators.map(o => ({ ...o, domain: d.label, domainId: d.id })),
    ...d.specialists.map(s => ({ ...s, domain: d.label, domainId: d.id })),
    { ...d.external, domain: d.label, domainId: d.id },
  ]);
  const selected = allAgents.find(a => a.id === selectedAgent);

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', fontFamily: 'inherit', background: 'var(--color-background-primary)', minHeight: '100%' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
              HCSC / BCBS — Agentic AI SDLC Context Engine
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 4px', fontWeight: 600 }}>
              BUILD BY DOMAIN — Governance, specificity &amp; cross-system collaboration across BDS · CTS · DB2 · ODS · Mainframe
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', margin: 0 }}>
              BDS and CTS run as isolated domain agent networks. The Enterprise Agentic Bus sits between them —
              packaging BDS context, transforming it, and routing to CTS Core Adjudication.
            </p>
          </div>
          <button
            onClick={() => setShowFlow(f => !f)}
            style={{
              padding: '8px 16px',
              background: showFlow ? '#7C3AED' : '#1E40AF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: '16px',
            }}
          >
            {showFlow ? 'Hide' : 'Show'} Claim Flow
          </button>
        </div>
      </div>

      {/* ── Claim Flow (collapsible) ── */}
      {showFlow && (
        <div style={{
          background: '#1E1B4B',
          border: '1px solid #4338CA',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            End-to-End Claim Processing Flow
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap' }}>
            {FLOW_STEPS.map((s, i) => (
              <React.Fragment key={s.step}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: `${s.color}22`, border: `1px solid ${s.color}66`, borderRadius: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{s.icon}</span>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8' }}>Step {s.step}</span>
                    <p style={{ fontSize: '11px', color: '#E2E8F0', margin: 0, fontWeight: 500 }}>{s.label}</p>
                  </div>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div style={{ color: '#6366F1', fontSize: '18px', padding: '0 6px', flexShrink: 0 }}>→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ── Domain Panels — 3-column: BDS | Enterprise Bus | CTS ── */}
      <div style={{ display: 'flex', gap: '0', alignItems: 'stretch', marginBottom: '20px' }}>

        {/* BDS Panel */}
        <div style={{ flex: 1 }}>
          <DomainPanel
            domain={DOMAINS[0]}
            selectedAgent={selectedAgent}
            onSelectAgent={handleSelect}
          />
        </div>

        {/* Enterprise Agentic Bus */}
        <EnterpriseAgenticBus />

        {/* CTS Panel */}
        <div style={{ flex: 1 }}>
          <DomainPanel
            domain={DOMAINS[1]}
            selectedAgent={selectedAgent}
            onSelectAgent={handleSelect}
          />
        </div>
      </div>

      {/* ── Agent Detail Panel (on click) ── */}
      {selected && (
        <div style={{
          background: '#1E1B4B',
          border: '1px solid #6366F1',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '24px' }}>{selected.icon}</span>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#E0E7FF', margin: '0 0 2px' }}>{selected.label}</p>
              <p style={{ fontSize: '11px', color: '#818CF8', margin: 0 }}>{selected.domain}</p>
            </div>
            <button
              onClick={() => setSelectedAgent(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#CBD5E1', margin: 0 }}>{selected.desc}</p>
        </div>
      )}

      {/* ── Cross-Domain Scenarios ── */}
      <div style={{ marginTop: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '16px' }}>⚡</span>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
              Live Cross-Domain Scenarios
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Run real agent workflows that demonstrate domain handoffs through the Enterprise Agentic Bus
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {CONTEXT_SCENARIOS.map(scenario => (
            <div key={scenario.id} style={{
              background: 'var(--color-background-primary)',
              border: expandedScenario === scenario.id ? '1px solid #6366F1' : '0.5px solid var(--color-border-secondary)',
              borderRadius: '12px',
              padding: '16px',
              transition: 'border-color 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{scenario.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-text-info)', fontWeight: 600 }}>{scenario.id}</span>
                    {scenario.domains.map(d => (
                      <span key={d} style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '20px', fontWeight: 600,
                        background: d.includes('BDS') ? '#DBEAFE' : '#E0E7FF',
                        color: d.includes('BDS') ? '#1D4ED8' : '#4338CA',
                        border: d.includes('BDS') ? '0.5px solid #93C5FD' : '0.5px solid #A5B4FC',
                      }}>{d}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 3px', color: 'var(--color-text-primary)' }}>{scenario.label}</p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{scenario.description}</p>
                </div>
                <button
                  onClick={() => runningScenario ? undefined : runScenario(scenario)}
                  disabled={!!runningScenario}
                  style={{
                    padding: '7px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 600,
                    cursor: runningScenario ? 'default' : 'pointer',
                    background: runningScenario === scenario.id ? 'var(--color-background-secondary)' : '#4F46E5',
                    color: runningScenario === scenario.id ? 'var(--color-text-secondary)' : 'white',
                    display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                  }}>
                  {runningScenario === scenario.id && (
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid #999', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  )}
                  {runningScenario === scenario.id ? 'Running...' : '▶ Run'}
                </button>
              </div>

              {expandedScenario === scenario.id && scenarioResults[scenario.id] !== undefined && (
                <div style={{ marginTop: '12px' }}>
                  {runningScenario === scenario.id && !scenarioResults[scenario.id] ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--color-background-secondary)', borderRadius: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #6366F1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Enterprise Agentic Bus orchestrating cross-domain agents...</span>
                    </div>
                  ) : scenarioResults[scenario.id] && (
                    <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', margin: 0, maxHeight: '320px', overflowY: 'auto', background: 'var(--color-background-secondary)', padding: '12px', borderRadius: '8px' }}>
                      {scenarioResults[scenario.id]}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Legend ── */}
      <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {[
          { color: '#374151', border: '#6B7280', label: 'Orchestrator Agent' },
          { color: '#4B5563', border: '#9CA3AF', label: 'Specialist Agent' },
          { color: '#92400E', border: '#F59E0B', label: 'External Agent' },
          { color: '#1E1B4B', border: '#C084FC', label: 'Enterprise Agentic Bus' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: l.color, border: `2px solid ${l.border}` }} />
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
          Click any agent card to inspect its role
        </div>
      </div>
    </div>
  );
}
