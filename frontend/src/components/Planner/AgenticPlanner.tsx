import React, { useState } from 'react';
import { BrainCircuit, ChevronRight } from 'lucide-react';

// ─── Tab names ────────────────────────────────────────────────────────────────

const TABS = [
  'Context',
  'Architecture',
  'Data Stores',
  'Security & Governance',
  'Deployment',
  'Estimation',
  'Risk & Readiness',
  'Project Charter',
] as const;

type TabName = typeof TABS[number];

// ─── Select option lists ──────────────────────────────────────────────────────

const DOMAINS = [
  'Infrastructure/AIOps', 'Application Maintenance', 'Integration/Middleware',
  'Data & Analytics', 'Testing & QA', 'Healthcare IT', 'Security Ops',
];

const PSIZE_OPTIONS = [
  { label: 'Small (<5 agents)', value: 0 },
  { label: 'Medium (5–15)',     value: 1 },
  { label: 'Large (15–30)',     value: 2 },
  { label: 'Enterprise (30+)', value: 3 },
];

const HORIZON_OPTIONS = [
  { label: 'POC (4–6 wks)',        value: 'poc'        },
  { label: 'MVP (3–4 mo)',         value: 'mvp'        },
  { label: 'Production (6–12 mo)', value: 'production' },
  { label: 'Program (>1 yr)',      value: 'program'    },
];

const HUMAN_OPTIONS = [
  { label: 'Fully autonomous',      value: 'autonomous' },
  { label: 'Approval gates',        value: 'approval'   },
  { label: 'Review before actions', value: 'review'     },
  { label: 'Frequent input',        value: 'frequent'   },
];

const FAILURE_OPTIONS = [
  { label: 'Low',                         value: 'low'      },
  { label: 'Medium (retry + alert)',      value: 'medium'   },
  { label: 'High (resilient)',            value: 'high'     },
  { label: 'Critical (zero-tolerance)',   value: 'critical' },
];

const DECISION_OPTIONS = [
  { label: 'Simple rules',          value: 0 },
  { label: 'Conditional branching', value: 1 },
  { label: 'Multi-step reasoning',  value: 2 },
  { label: 'Adaptive / learning',   value: 3 },
];

const ENV_OPTIONS = [
  { label: 'Azure (primary)', value: 'azure'      },
  { label: 'AWS',             value: 'aws'        },
  { label: 'GCP',             value: 'gcp'        },
  { label: 'On-premise',      value: 'onprem'     },
  { label: 'Hybrid',          value: 'hybrid'     },
  { label: 'Multi-cloud',     value: 'multicloud' },
];

// ─── Chip option lists ────────────────────────────────────────────────────────

const INTEGRATION_CHIPS = [
  { label: 'Control-M',        id: 'control-m'       },
  { label: 'ServiceNow',       id: 'servicenow'       },
  { label: 'MongoDB',          id: 'mongodb'          },
  { label: 'Teams/Webhook',    id: 'teams'            },
  { label: 'Dynatrace',        id: 'dynatrace'        },
  { label: 'Azure OpenAI',     id: 'azure-openai'     },
  { label: 'REST APIs',        id: 'rest-apis'        },
  { label: 'SQL/RDBMS',        id: 'sql'              },
  { label: 'Email/SMTP',       id: 'email'            },
  { label: 'SFTP/Filesystem',  id: 'sftp'             },
  { label: 'Rundeck',          id: 'rundeck'          },
  { label: 'Kafka/Event Hub',  id: 'kafka'            },
  { label: 'Power Automate',   id: 'power-automate'   },
  { label: 'Active Directory', id: 'active-directory' },
];

const DATA_CHAR_CHIPS = [
  { label: 'Unstructured docs/logs',  id: 'unstructured'  },
  { label: 'Semantic search',         id: 'semantic'       },
  { label: 'Historical incidents',    id: 'history'        },
  { label: 'Real-time state',         id: 'realtime'       },
  { label: 'Multi-model JSON+files',  id: 'multimodel'     },
  { label: 'Global/multi-region',     id: 'global'         },
  { label: 'Large volume (>1M rows)', id: 'largevolume'    },
  { label: 'Session/short-lived',     id: 'session'        },
  { label: 'Audit trail required',    id: 'audit'          },
  { label: 'Knowledge base/runbooks', id: 'knowledge-base' },
  { label: 'PII/PHI data',           id: 'pii'             },
  { label: 'Regulated data (HIPAA)',  id: 'hipaa'          },
];

const CAPABILITY_CHIPS = [
  { label: 'Parallel execution',        id: 'parallel'      },
  { label: 'Memory across sessions',    id: 'memory'        },
  { label: 'Self-healing/retry',        id: 'selfheal'      },
  { label: 'Scheduled batches',         id: 'scheduled'     },
  { label: 'Real-time response',        id: 'realtime-resp' },
  { label: 'RAG/doc retrieval',         id: 'rag'           },
  { label: 'Context caching',           id: 'ctx-cache'     },
  { label: 'Multi-agent collaboration', id: 'multiagent'    },
  { label: 'Tool use/function calling', id: 'tooluse'       },
  { label: 'Code generation',           id: 'codegen'       },
  { label: 'Data analysis',            id: 'dataanalysis'   },
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormData {
  projectName:  string;
  objective:    string;
  domain:       string;
  psizeIdx:     number;
  horizon:      string;
  human:        string;
  failure:      string;
  decisionIdx:  number;
  environment:  string;
  integrations: string[];
  dataChars:    string[];
  capabilities: string[];
}

const DEFAULT_FORM: FormData = {
  projectName: '', objective: '', domain: DOMAINS[0],
  psizeIdx: 1, horizon: 'mvp', human: 'approval',
  failure: 'medium', decisionIdx: 1, environment: 'azure',
  integrations: [], dataChars: [], capabilities: [],
};

// ─── Project presets ──────────────────────────────────────────────────────────

interface Preset {
  id:          string;
  label:       string;
  description: string;
  form:        FormData;
}

const PRESETS: Preset[] = [
  {
    id: 'context-engine',
    label: 'Context Engine',
    description: 'Healthcare claims delta engine — TMG → HealthSprings migration',
    form: {
      projectName: 'Context Engine',
      objective:
        'Healthcare claims parallel testing service — programmatically identify field-level ' +
        'deltas between TMG (legacy) and HealthSprings (target) adjudication systems across a ' +
        '600K+ member migration. Use Azure OpenAI + AI Search on business rules to classify ' +
        'variance with confidence scoring, log immutable audit trails to Cosmos DB, and surface ' +
        'exceptions via Service Bus alerts.',
      domain:       'Healthcare IT',
      psizeIdx:     1,          // Medium (5–15 agents)
      horizon:      'production',
      human:        'review',   // analysts review delta reports
      failure:      'high',     // resilient — healthcare data
      decisionIdx:  2,          // multi-step reasoning (confidence + classification)
      environment:  'azure',
      integrations: ['azure-openai', 'rest-apis'],
      dataChars:    ['history', 'semantic', 'largevolume', 'audit', 'pii', 'hipaa', 'multimodel'],
      capabilities: ['parallel', 'rag', 'scheduled', 'dataanalysis', 'selfheal'],
    },
  },
];

// ─── Results ──────────────────────────────────────────────────────────────────

type Status = 'needed' | 'optional' | 'skip';

interface Results {
  orchScore: number;   orchStatus: Status;
  superScore: number;  superStatus: Status;
  utilScore: number;   utilStatus: Status;
  vectorScore: number; vectorStatus: Status;
  cosmosScore: number; cosmosStatus: Status;
  redisScore: number;  redisStatus: Status;
  sbScore: number;     sbStatus: Status;
  blobScore: number;   blobStatus: Status;
  mongoScore: number;  mongoStatus: Status;
  agentDays: number; dataDays: number; govDays: number;
  secDays: number;   depDays: number;  obsDays: number;
  totalDays: number; sprints: number; calMonths: number; teamSize: string;
  pattern: string; sysCount: number;
  isAzure: boolean; isCritical: boolean;
  hasLLM: boolean; hasMongo: boolean; hasKafka: boolean;
  hasSemantic: boolean; hasUnstruct: boolean; hasHistory: boolean;
  hasRT: boolean; hasMultiModel: boolean; hasGlobal: boolean;
  hasLargeVol: boolean; hasSession: boolean; hasAudit: boolean;
  hasKB: boolean; hasPII: boolean; hasHIPAA: boolean;
  hasParallel: boolean; hasMemory: boolean; hasSelfHeal: boolean;
  hasCtxCache: boolean; hasMultiAgentCollab: boolean; hasRAG: boolean;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeResults(f: FormData): Results {
  const { psizeIdx, decisionIdx, integrations, dataChars, capabilities } = f;
  const sysCount = integrations.length;

  const isAzure    = ['azure', 'hybrid', 'multicloud'].includes(f.environment);
  const isCritical = f.failure === 'critical';
  const hasLLM     = integrations.includes('azure-openai');
  const hasMongo   = integrations.includes('mongodb');
  const hasKafka   = integrations.includes('kafka');
  const hasSemantic  = dataChars.includes('semantic');
  const hasUnstruct  = dataChars.includes('unstructured');
  const hasHistory   = dataChars.includes('history');
  const hasRT        = dataChars.includes('realtime');
  const hasMultiModel= dataChars.includes('multimodel');
  const hasGlobal    = dataChars.includes('global');
  const hasLargeVol  = dataChars.includes('largevolume');
  const hasSession   = dataChars.includes('session');
  const hasAudit     = dataChars.includes('audit');
  const hasKB        = dataChars.includes('knowledge-base');
  const hasPII       = dataChars.includes('pii');
  const hasHIPAA     = dataChars.includes('hipaa');
  const hasParallel        = capabilities.includes('parallel');
  const hasMemory          = capabilities.includes('memory');
  const hasSelfHeal        = capabilities.includes('selfheal');
  const hasCtxCache        = capabilities.includes('ctx-cache');
  const hasMultiAgentCollab= capabilities.includes('multiagent');
  const hasRAG             = capabilities.includes('rag');

  let orchScore = 0;
  if (psizeIdx >= 2) orchScore += 30;
  if (psizeIdx >= 3) orchScore += 20;
  if (decisionIdx >= 3) orchScore += 25;
  if (hasParallel) orchScore += 20;
  if (sysCount >= 4) orchScore += 15;
  if (f.human === 'approval' || f.human === 'review') orchScore += 10;
  if (hasMultiAgentCollab) orchScore += 15;

  let superScore = 0;
  if (psizeIdx >= 2) superScore += 25;
  if (sysCount >= 3) superScore += 20;
  if (decisionIdx >= 2) superScore += 20;
  if (hasLLM) superScore += 25;
  if (hasSelfHeal) superScore += 15;
  if (isCritical) superScore += 15;
  if (hasMultiAgentCollab) superScore += 10;

  let utilScore = 10;
  if (sysCount >= 2) utilScore += 40;
  if (psizeIdx >= 2) utilScore += 20;
  if (hasAudit) utilScore += 15;
  if (hasRT)    utilScore += 10;

  const toAgentStatus = (s: number): Status => s >= 50 ? 'needed' : s >= 30 ? 'optional' : 'skip';
  const orchStatus  = toAgentStatus(orchScore);
  const superStatus = toAgentStatus(superScore);
  const utilStatus  = (utilScore >= 50 ? 'needed' : 'optional') as Status;

  let vectorScore = 0;
  if (hasSemantic) vectorScore += 50; if (hasRAG)      vectorScore += 50;
  if (hasUnstruct) vectorScore += 30; if (hasKB)       vectorScore += 30;
  if (hasLLM)      vectorScore += 20; if (hasHistory)  vectorScore += 15;

  let cosmosScore = 0;
  if (hasMultiModel) cosmosScore += 40; if (hasGlobal)   cosmosScore += 40;
  if (hasLargeVol)   cosmosScore += 30; if (hasRT)       cosmosScore += 20;
  if (sysCount >= 5) cosmosScore += 20;

  let redisScore = 0;
  if (hasSession)  redisScore += 50; if (hasCtxCache) redisScore += 50;
  if (hasRT)       redisScore += 30; if (hasParallel) redisScore += 20;
  if (hasMemory)   redisScore += 30;

  let sbScore = 0;
  if (hasKafka)      sbScore += 60; if (hasRT)       sbScore += 40;
  if (hasParallel)   sbScore += 30; if (psizeIdx >= 3) sbScore += 20;

  let blobScore = 0;
  if (hasUnstruct)   blobScore += 40; if (hasHistory)  blobScore += 30;
  if (hasAudit)      blobScore += 20; if (sysCount >= 4) blobScore += 10;

  let mongoScore = 0;
  if (hasMongo)                                   mongoScore += 80;
  if (hasHistory || hasMultiModel || hasAudit)    mongoScore += 35;

  const toStoreStatus = (s: number): Status => s >= 50 ? 'needed' : s >= 30 ? 'optional' : 'skip';
  const vectorStatus = toStoreStatus(vectorScore);
  const cosmosStatus = toStoreStatus(cosmosScore);
  const redisStatus  = toStoreStatus(redisScore);
  const sbStatus     = toStoreStatus(sbScore);
  const blobStatus   = toStoreStatus(blobScore);
  const mongoStatus  = toStoreStatus(mongoScore);

  const agentDays =
    (orchStatus  !== 'skip' ? 8  : 0) +
    (superStatus !== 'skip' ? 12 : 0) +
    (utilStatus  !== 'skip' ? 6 * Math.max(1, Math.floor(sysCount / 2)) : 0) +
    sysCount * 3 + (hasLLM ? 10 : 0) + (hasMultiAgentCollab ? 8 : 0);

  const mongoNew = mongoStatus !== 'skip' && !hasMongo;
  const dataDays =
    (vectorStatus !== 'skip' ? 10 : 0) + (cosmosStatus !== 'skip' ? 12 : 0) +
    (redisStatus  !== 'skip' ?  6 : 0) + (blobStatus   !== 'skip' ?  4 : 0) +
    (mongoNew ? 4 : 0) +                 (sbStatus     !== 'skip' ?  8 : 0);

  const govDays = (hasPII || hasHIPAA ? 10 : 4) + (hasAudit ? 4 : 0);
  const secDays = 8 + (isCritical ? 6 : 0) + (hasPII ? 4 : 0);
  const depDays = 10 + (psizeIdx >= 3 ? 8 : 0) + (isCritical ? 6 : 0);
  const obsDays = 8 + (hasLLM ? 4 : 0);

  const totalDays = Math.round((agentDays + dataDays + govDays + secDays + depDays + obsDays) * 1.3);
  const sprints   = Math.ceil(totalDays / 10);
  const calMonths = Math.ceil(sprints / 2);
  const teamSize  = (['2–3', '3–5', '5–8', '8–12'] as const)[psizeIdx] ?? '3–5';

  let pattern = 'Single-layer';
  if (orchStatus !== 'skip' && superStatus !== 'skip') pattern = 'Hierarchical multi-agent';
  else if (orchStatus !== 'skip')                      pattern = 'Orchestrator + utilities';
  else if (superStatus !== 'skip')                     pattern = 'Domain specialist';

  return {
    orchScore, orchStatus, superScore, superStatus, utilScore, utilStatus,
    vectorScore, vectorStatus, cosmosScore, cosmosStatus,
    redisScore, redisStatus, sbScore, sbStatus, blobScore, blobStatus, mongoScore, mongoStatus,
    agentDays, dataDays, govDays, secDays, depDays, obsDays,
    totalDays, sprints, calMonths, teamSize, pattern, sysCount,
    isAzure, isCritical, hasLLM, hasMongo, hasKafka,
    hasSemantic, hasUnstruct, hasHistory, hasRT, hasMultiModel,
    hasGlobal, hasLargeVol, hasSession, hasAudit, hasKB, hasPII, hasHIPAA,
    hasParallel, hasMemory, hasSelfHeal, hasCtxCache, hasMultiAgentCollab, hasRAG,
  };
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

type CardStatus = Status | 'required';

function StatusPill({ status }: { status: CardStatus }) {
  const map: Record<CardStatus, { cls: string; label: string }> = {
    needed:   { cls: 'bg-green-100 text-green-800', label: 'Recommended' },
    optional: { cls: 'bg-amber-100 text-amber-800', label: 'Optional'    },
    skip:     { cls: 'bg-gray-100  text-gray-500',  label: 'Not needed'  },
    required: { cls: 'bg-red-100   text-red-700',   label: 'Required'    },
  };
  const { cls, label } = map[status] ?? map.skip;
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function ConfidenceBar({ value, status }: { value: number; status: CardStatus }) {
  const bar =
    status === 'needed' || status === 'required' ? 'bg-green-500' :
    status === 'optional'                         ? 'bg-amber-400' : 'bg-gray-300';
  return (
    <div className="mt-3">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-400">Confidence</span>
        <span className="text-xs text-gray-500 font-medium">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all ${bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RecCard({
  title, status, effort, confidence, why, bullets,
}: {
  title: string; status: CardStatus; effort: number; confidence: number;
  why: string; bullets: string[];
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="font-semibold text-gray-800 text-sm leading-snug">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {effort > 0 && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {effort}d
            </span>
          )}
          <StatusPill status={status} />
        </div>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed mb-2">{why}</p>
      {bullets.length > 0 && (
        <ul className="space-y-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-500">
              <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <ConfidenceBar value={confidence} status={status} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{children}</p>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-6 first:mt-0">
      {children}
    </p>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SelectField({
  label, value, onChange, children,
}: {
  label: string; value: string | number;
  onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
      >
        {children}
      </select>
    </div>
  );
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={[
        'px-3 py-1 rounded-full text-xs border transition-all select-none',
        active
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
          : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ─── Tab 1: Context ───────────────────────────────────────────────────────────

function ContextTab({
  form, setForm, onAnalyze, onAnalyzeWith,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onAnalyze: () => void;
  onAnalyzeWith: (f: FormData) => void;
}) {
  const toggle = (field: 'integrations' | 'dataChars' | 'capabilities', id: string) =>
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter(x => x !== id)
        : [...prev[field], id],
    }));

  const loadPreset = (preset: Preset, andAnalyze = false) => {
    setForm(preset.form);
    if (andAnalyze) onAnalyzeWith(preset.form);
  };

  return (
    <div className="space-y-6">

      {/* ── Quick-start preset bar ── */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-3">
          Quick start — load a project preset
        </p>
        <div className="flex flex-col gap-3">
          {PRESETS.map(preset => (
            <div key={preset.id}
              className="flex items-center justify-between bg-white rounded-lg border border-indigo-100 px-4 py-3 gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">{preset.label}</p>
                <p className="text-xs text-gray-400 truncate">{preset.description}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => loadPreset(preset, false)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset(preset, true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors font-medium"
                >
                  Load &amp; Analyze
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-indigo-400 mt-3">
          Loading a preset overwrites the current form. You can edit any field before running Analyze.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Project name</label>
        <input
          type="text" value={form.projectName}
          onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))}
          placeholder="e.g. HCSC Claims AIOps Platform"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Project objective</label>
        <textarea
          rows={3} value={form.objective}
          onChange={e => setForm(p => ({ ...p, objective: e.target.value }))}
          placeholder="Describe what the AI agent system should achieve..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Domain" value={form.domain} onChange={v => setForm(p => ({ ...p, domain: v }))}>
          {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
        </SelectField>
        <SelectField label="Program size" value={form.psizeIdx} onChange={v => setForm(p => ({ ...p, psizeIdx: +v }))}>
          {PSIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectField>
        <SelectField label="Time horizon" value={form.horizon} onChange={v => setForm(p => ({ ...p, horizon: v }))}>
          {HORIZON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectField>
        <SelectField label="Human involvement" value={form.human} onChange={v => setForm(p => ({ ...p, human: v }))}>
          {HUMAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectField>
        <SelectField label="Failure tolerance" value={form.failure} onChange={v => setForm(p => ({ ...p, failure: v }))}>
          {FAILURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectField>
        <SelectField label="Decision complexity" value={form.decisionIdx} onChange={v => setForm(p => ({ ...p, decisionIdx: +v }))}>
          {DECISION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectField>
        <div className="col-span-2">
          <SelectField label="Target environment" value={form.environment} onChange={v => setForm(p => ({ ...p, environment: v }))}>
            {ENV_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectField>
        </div>
      </div>

      <div>
        <SectionLabel>Systems / Integrations</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {INTEGRATION_CHIPS.map(c => (
            <ToggleChip key={c.id} label={c.label}
              active={form.integrations.includes(c.id)}
              onClick={() => toggle('integrations', c.id)} />
          ))}
        </div>
        {form.integrations.length > 0 && (
          <p className="text-xs text-indigo-500 mt-2">{form.integrations.length} selected</p>
        )}
      </div>

      <div>
        <SectionLabel>Data Characteristics</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {DATA_CHAR_CHIPS.map(c => (
            <ToggleChip key={c.id} label={c.label}
              active={form.dataChars.includes(c.id)}
              onClick={() => toggle('dataChars', c.id)} />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Agent Capabilities</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {CAPABILITY_CHIPS.map(c => (
            <ToggleChip key={c.id} label={c.label}
              active={form.capabilities.includes(c.id)}
              onClick={() => toggle('capabilities', c.id)} />
          ))}
        </div>
      </div>

      <button
        type="button" onClick={onAnalyze}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm transition-colors"
      >
        Analyze and generate enterprise recommendation
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function ResultsSummaryBar({ r }: { r: Results }) {
  const pill = (label: string, status: Status) => {
    const cls = status === 'needed' ? 'bg-green-100 text-green-700'
              : status === 'optional' ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-400';
    return <span key={label} className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
  };
  return (
    <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-3">Analysis snapshot</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {pill('Orchestrator', r.orchStatus)}   {pill('Super agents', r.superStatus)}
        {pill('Utility agents', r.utilStatus)} {pill('Vector DB', r.vectorStatus)}
        {pill('Cosmos DB', r.cosmosStatus)}    {pill('Redis', r.redisStatus)}
        {pill('Service Bus', r.sbStatus)}      {pill('Blob Storage', r.blobStatus)}
        {pill('MongoDB', r.mongoStatus)}
      </div>
      <div className="flex gap-6 text-xs text-indigo-600 font-medium">
        <span>{r.totalDays}d total</span>
        <span>{r.sprints} sprints</span>
        <span>~{r.calMonths} months</span>
        <span>{r.teamSize} engineers</span>
      </div>
    </div>
  );
}

// ─── Tab 2: Architecture ──────────────────────────────────────────────────────

function ArchitectureTab({ form, r }: { form: FormData; r: Results }) {
  const layerChips = [
    r.orchStatus  !== 'skip' && { label: 'Orchestrator',   color: 'bg-purple-100 text-purple-700' },
    r.superStatus !== 'skip' && { label: 'Super agents',   color: 'bg-blue-100 text-blue-700'     },
    r.utilStatus  !== 'skip' && { label: 'Utility agents', color: 'bg-teal-100 text-teal-700'     },
    { label: 'Tools', color: 'bg-gray-100 text-gray-700' },
  ].filter(Boolean) as { label: string; color: string }[];

  const storeChips = [
    r.vectorStatus !== 'skip' && { label: 'Vector DB',    color: 'bg-amber-100 text-amber-700'   },
    r.cosmosStatus !== 'skip' && { label: 'Cosmos DB',    color: 'bg-orange-100 text-orange-700' },
    r.redisStatus  !== 'skip' && { label: 'Redis',        color: 'bg-purple-100 text-purple-700' },
    r.sbStatus     !== 'skip' && { label: 'Service Bus',  color: 'bg-teal-100 text-teal-700'     },
    r.blobStatus   !== 'skip' && { label: 'Blob Storage', color: 'bg-green-100 text-green-700'   },
    r.mongoStatus  !== 'skip' && { label: 'MongoDB',      color: 'bg-amber-100 text-amber-700'   },
  ].filter(Boolean) as { label: string; color: string }[];

  const orchBullets = [
    form.psizeIdx >= 2 ? `${PSIZE_OPTIONS[form.psizeIdx].label} scale requires coordinated task delegation` : '',
    form.decisionIdx >= 3 ? 'Adaptive decision-making needs a centralised plan-and-dispatch loop' : '',
    r.hasParallel ? 'Parallel execution benefits from a central fan-out coordinator' : '',
    r.sysCount >= 4 ? `${r.sysCount} integration points warrant a single coordination hub` : '',
    r.hasMultiAgentCollab ? 'Multi-agent collaboration requires a broker/registry layer' : '',
  ].filter(Boolean) as string[];
  if (orchBullets.length === 0) orchBullets.push('Scope does not yet justify a dedicated orchestration tier');

  const superBullets = [
    r.hasLLM ? 'LLM integration suits a reasoning-capable super-agent tier' : '',
    r.hasSelfHeal ? 'Self-healing logic isolates well at the domain-specialist layer' : '',
    r.isCritical ? 'Zero-tolerance profile calls for supervised agent delegation' : '',
    r.sysCount >= 3 ? `${r.sysCount} systems benefit from domain-partitioned super agents` : '',
  ].filter(Boolean) as string[];
  if (superBullets.length === 0) superBullets.push('Decision complexity does not yet warrant a specialist tier');

  const utilBullets = [
    r.sysCount >= 2 ? `${r.sysCount} integrations — one utility agent per system` : '',
    r.hasMemory ? 'Session-memory wrapper is a natural reusable utility agent' : '',
    r.hasAudit ? 'Audit-logger utility ensures consistent event schema across tiers' : '',
    r.hasMultiAgentCollab ? 'Shared tool wrappers reduce duplication across domain agents' : '',
  ].filter(Boolean) as string[];

  const selectedIntegLabels = INTEGRATION_CHIPS
    .filter(c => form.integrations.includes(c.id)).slice(0, 4).map(c => c.label);

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
        <span className="text-2xl">🏗️</span>
        <div>
          <p className="font-semibold text-indigo-800">{r.pattern}</p>
          <p className="text-xs text-indigo-500 mt-0.5">
            {form.domain} · {PSIZE_OPTIONS[form.psizeIdx].label} · {DECISION_OPTIONS[form.decisionIdx].label}
          </p>
        </div>
      </div>

      <div>
        <SectionHeader>Architecture stack</SectionHeader>
        <div className="flex flex-wrap gap-2">
          {[...layerChips, ...storeChips].map(c => (
            <span key={c.label} className={`px-3 py-1 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>
          ))}
        </div>
      </div>

      <SectionHeader>Agent layer recommendations</SectionHeader>

      <RecCard
        title="Orchestrator agent" status={r.orchStatus}
        effort={r.orchStatus !== 'skip' ? 8 : 0}
        confidence={Math.min(100, r.orchScore)}
        why={r.orchStatus === 'skip'
          ? 'Program scope does not require a dedicated orchestration layer; utility agents can be called directly.'
          : 'A top-level orchestrator is justified for this program scale and integration complexity.'}
        bullets={orchBullets}
      />
      <RecCard
        title="Super agent(s) — domain specialists" status={r.superStatus}
        effort={r.superStatus !== 'skip' ? 12 : 0}
        confidence={Math.min(100, r.superScore)}
        why={r.superStatus === 'skip'
          ? 'Decision complexity and LLM usage do not yet justify a specialist super-agent tier.'
          : 'Domain-specific super agents improve LLM reasoning quality and failure isolation.'}
        bullets={superBullets}
      />
      <RecCard
        title="Utility agents — tool wrappers" status={r.utilStatus}
        effort={r.utilStatus !== 'skip' ? 6 * Math.max(1, Math.floor(r.sysCount / 2)) : 0}
        confidence={Math.min(100, r.utilScore)}
        why="Utility agents encapsulate each integration with retry logic, auth, circuit-breaking, and error handling."
        bullets={utilBullets}
      />
      <RecCard
        title="Tools / function library" status="needed"
        effort={r.sysCount * 3}
        confidence={95}
        why={`${r.sysCount > 0 ? r.sysCount : 'All'} integration(s) each require a typed tool function with input schema, output schema, and error enum.`}
        bullets={[
          'Define JSON Schema for every tool call input/output',
          'Implement retry + idempotency decorator per tool',
          selectedIntegLabels.length > 0
            ? `Prioritise first: ${selectedIntegLabels.join(', ')}`
            : 'Add integrations in the Context tab for specific guidance',
        ]}
      />
    </div>
  );
}

// ─── Tab 3: Data Stores ───────────────────────────────────────────────────────

function DataStoresTab({ form, r }: { form: FormData; r: Results }) {
  return (
    <div className="space-y-4">
      <RecCard
        title={r.isAzure ? 'Vector DB — Azure AI Search' : 'Vector DB'}
        status={r.vectorStatus}
        effort={r.vectorStatus !== 'skip' ? 10 : 0}
        confidence={Math.min(100, r.vectorScore)}
        why="Semantic search, RAG pipelines, and knowledge-base retrieval require dense vector indices."
        bullets={[
          r.isAzure ? 'Azure AI Search — enable hybrid BM25 + cosine scoring on vector fields' : 'Pinecone or Weaviate with HNSW index',
          'Chunk strategy: 512 tokens, 10% overlap, embed metadata fields separately',
          'Per-document embeddings via text-embedding-3-small or ada-002',
          r.hasPII ? 'Encrypt PII content at field level before indexing' : '',
        ].filter(Boolean) as string[]}
      />
      <RecCard
        title="Cosmos DB (NoSQL)"
        status={r.cosmosStatus}
        effort={r.cosmosStatus !== 'skip' ? 12 : 0}
        confidence={Math.min(100, r.cosmosScore)}
        why="Multi-model, globally distributed, or large-volume workloads need schema-flexible storage with provisioned throughput."
        bullets={[
          'Partition key: /tenantId or /agentId for even RU distribution',
          r.hasPII ? 'Enable CMK (Customer Managed Key) encryption for PII fields' : 'Standard server-side encryption at rest',
          r.isAzure ? 'Serverless tier for POC; switch to provisioned RU/s at production scale' : '',
          'Enable change feed to trigger utility agents on document mutations',
        ].filter(Boolean) as string[]}
      />
      <RecCard
        title={r.isAzure ? 'Redis — Azure Cache for Redis' : 'Redis'}
        status={r.redisStatus}
        effort={r.redisStatus !== 'skip' ? 6 : 0}
        confidence={Math.min(100, r.redisScore)}
        why="Session state, context cache, and real-time agent coordination need sub-millisecond read latency."
        bullets={[
          r.isAzure ? 'Premium tier for persistence + geo-replication; active-geo cluster for critical workloads' : 'Redis Enterprise with RDB snapshots + AOF',
          'TTL: 15 min agent context, 24 hr user session, no-expiry for shared config',
          'Separate logical databases: db0=orchestrator ctx, db1=session, db2=util cache',
          'Eviction policy: allkeys-lru; maxmemory at 80% of node RAM',
        ]}
      />
      <RecCard
        title={r.isAzure ? 'Service Bus / Event Hub' : 'Service Bus / Kafka'}
        status={r.sbStatus}
        effort={r.sbStatus !== 'skip' ? 8 : 0}
        confidence={Math.min(100, r.sbScore)}
        why="Async messaging decouples agent producers and consumers, enabling durable ordered delivery."
        bullets={[
          'Topic/subscription pattern: one topic per agent domain, filter-based subscriptions per consumer',
          'Dead-letter queue with 10-retry max; alert on DLQ depth > 0',
          r.isAzure ? 'Service Bus Premium for VNet integration; Event Hub if >1 M events/day' : 'Kafka at-least-once delivery; 7-day retention',
          'Message envelope: include correlationId, causationId, agentId, schemaVersion',
        ]}
      />
      <RecCard
        title={r.isAzure ? 'Blob Storage — Azure Blob' : 'Object Storage'}
        status={r.blobStatus}
        effort={r.blobStatus !== 'skip' ? 4 : 0}
        confidence={Math.min(100, r.blobScore)}
        why="Unstructured documents, audit logs, and historical snapshots need cost-effective object storage."
        bullets={[
          r.isAzure ? 'Lifecycle policy: Hot (0–30d) → Cool (31–90d) → Archive (90d+)' : 'S3 Intelligent-Tiering for automatic cost optimisation',
          r.hasHIPAA ? 'WORM containers for HIPAA 7-year retention requirement' : 'Immutable storage policy for audit trail containers',
          'Hierarchical namespace (ADLS Gen2) for Spark/analytics compatibility',
          r.hasAudit ? 'Dedicated audit-log container: append-only access, no delete permissions' : '',
        ].filter(Boolean) as string[]}
      />
      <RecCard
        title={r.hasMongo ? 'MongoDB (existing)' : 'MongoDB'}
        status={r.mongoStatus}
        effort={r.mongoStatus !== 'skip' && !r.hasMongo ? 4 : 0}
        confidence={Math.min(100, r.mongoScore)}
        why={r.hasMongo
          ? 'Existing MongoDB — leverage change streams for event-driven agent triggers; add FLE for regulated fields.'
          : 'Multi-model document workloads can use MongoDB as a flexible operational store alongside Cosmos.'}
        bullets={[
          'Change streams → trigger utility agents on document insert / update',
          'Compound index: { tenantId: 1, createdAt: -1 } for agent query patterns',
          r.hasPII || r.hasHIPAA ? 'Field Level Encryption (FLE) for all PII/PHI fields at the driver level' : '',
          r.mongoStatus !== 'skip' && !r.hasMongo ? 'Enable $jsonSchema validation before promoting to production' : '',
        ].filter(Boolean) as string[]}
      />
    </div>
  );
}

// ─── Tab 4: Security & Governance ─────────────────────────────────────────────

function SecurityTab({ form, r }: { form: FormData; r: Results }) {
  const netStatus: Status = r.isCritical || r.hasPII ? 'needed' : 'optional';

  return (
    <div className="space-y-4">
      <SectionHeader>Security architecture</SectionHeader>
      <RecCard
        title="Identity & access (IAM)" status="required" effort={4} confidence={100}
        why="Every agent tier requires a distinct identity; shared credentials are the #1 agent security failure mode."
        bullets={[
          r.isAzure ? 'Managed Identity per agent pod — no service principal secrets in env vars' : 'OIDC workload identity per service',
          'Service principal per agent tier (orchestrator, super, utility) with scoped RBAC',
          'Deny by default at subscription level; explicit allow per resource group',
          'Rotate all credentials on a 90-day schedule; use Entra PIM for privileged roles',
        ]}
      />
      <RecCard
        title="Secrets management" status="required" effort={2} confidence={100}
        why="Hardcoded credentials in agent code or environment variables create critical supply-chain exposure."
        bullets={[
          r.isAzure ? 'Azure Key Vault — one vault per environment (dev / staging / prod)' : 'HashiCorp Vault or cloud-native secrets manager',
          'Reference secrets by URI only; never pass as plain env vars into agent runtime',
          'Enable soft-delete + purge protection on Key Vault',
          'Automated secret rotation via Entra ID (Azure) or Lambda (AWS)',
        ]}
      />
      <RecCard
        title="Network isolation" status={netStatus}
        effort={netStatus === 'needed' ? 6 : 3}
        confidence={netStatus === 'needed' ? 90 : 60}
        why={r.isCritical || r.hasPII
          ? 'Critical / PII workloads must block all public-internet access to agent services.'
          : 'Network isolation is recommended for production agent workloads.'}
        bullets={[
          r.isAzure ? 'Private endpoints for Key Vault, Cosmos DB, Redis, Service Bus' : 'VPC private subnets for all agent workloads',
          'NSG rules: deny all inbound; allow only agent-to-agent within VNet',
          r.isCritical ? 'Azure Firewall Premium with TLS inspection for egress' : 'Network security groups per subnet',
          'DDoS Standard on all public-facing ingress controllers',
        ]}
      />
      <RecCard
        title="RBAC & least privilege" status="required" effort={3} confidence={100}
        why="Each agent tier must have only the permissions it needs — nothing more."
        bullets={[
          'Role matrix: Orchestrator=read+trigger, Super=read+write domain, Utility=scoped CRUD per system',
          r.isAzure ? 'Azure PIM just-in-time access for all privileged operations' : 'Temporary credentials with short expiry for elevated operations',
          'Quarterly access review — remove all unused role assignments',
          'Deny assignments for privileged actions (delete resource group, modify IAM policy)',
        ]}
      />

      <SectionHeader>Governance framework</SectionHeader>
      <RecCard
        title="Data governance & compliance"
        status={r.hasHIPAA || r.hasPII ? 'required' : 'optional'}
        effort={r.hasHIPAA ? 10 : r.hasPII ? 6 : 3}
        confidence={r.hasHIPAA ? 95 : r.hasPII ? 85 : 55}
        why={r.hasHIPAA
          ? 'HIPAA requires a formal BAA, PHI data classification, and 7-year retention.'
          : r.hasPII
          ? 'PII requires classification, right-to-erasure workflow, and breach-notification process.'
          : 'Data governance baseline is recommended for any production agent system.'}
        bullets={[
          r.hasHIPAA ? 'Execute HIPAA BAA with all vendors handling PHI (cloud provider, LLM API, etc.)' : '',
          r.hasPII ? 'Data classification: apply sensitivity labels to all PII fields at ingestion' : '',
          r.hasPII ? 'Right-to-erasure: agent must support field deletion within 30 days of request' : '',
          r.hasHIPAA
            ? 'Retention: 7 years for all healthcare records; immutable blob storage with WORM policy'
            : 'Define data retention policy per classification level',
        ].filter(Boolean) as string[]}
      />
      <RecCard
        title="Audit & traceability" status="required"
        effort={r.hasAudit ? 6 : 4} confidence={90}
        why="All agent actions must be traceable for debugging, compliance, and post-incident review."
        bullets={[
          'Event schema: { correlationId, causationId, agentId, action, timestamp, outcome, durationMs }',
          'Append-only audit store — no update or delete operations permitted on audit records',
          'Structured logging with consistent schema across all agent tiers',
          r.isAzure ? 'Azure Monitor Logs + Log Analytics; 90-day hot retention, 1-year archive' : 'OpenSearch / ELK stack with ILM retention policy',
        ]}
      />
      {r.hasLLM && (
        <RecCard
          title="LLM / AI model governance" status="required" effort={4} confidence={88}
          why="LLM outputs can be incorrect, biased, or policy-violating without versioning controls and guardrails."
          bullets={[
            'Prompt versioning: all system prompts in source control with semantic versioning',
            'Output validation: JSON schema check + toxicity / PII scan on every LLM response',
            r.isAzure ? 'Azure AI Content Safety for all user-facing and agent-routed responses' : 'Guardrails AI or LlamaGuard for content filtering',
            'Token cost budget: per-agent monthly limit; alert at 80%, hard-stop at 100%',
          ]}
        />
      )}
    </div>
  );
}

// ─── Tab 5: Deployment ────────────────────────────────────────────────────────

function DeploymentTab({ form, r }: { form: FormData; r: Results }) {
  return (
    <div className="space-y-4">
      <SectionHeader>Deployment architecture</SectionHeader>
      <RecCard
        title={r.isAzure ? (form.psizeIdx >= 2 ? 'AKS — Azure Kubernetes Service' : 'Azure Container Apps') : 'Container orchestration'}
        status={form.psizeIdx >= 1 ? 'needed' : 'optional'}
        effort={form.psizeIdx >= 2 ? 10 : 6}
        confidence={form.psizeIdx >= 2 ? 90 : 72}
        why={form.psizeIdx >= 2
          ? 'Large / enterprise programs need Kubernetes for KEDA autoscaling, advanced scheduling, and network policies.'
          : 'ACA provides serverless containers with built-in Dapr sidecars for agent-to-agent communication.'}
        bullets={[
          r.isAzure && form.psizeIdx >= 2 ? 'AKS with KEDA: event-driven autoscaling per agent pod; separate node pools per tier' : '',
          r.isAzure && form.psizeIdx < 2  ? 'Azure Container Apps with Dapr; use Service Bus trigger for scale-to-zero' : '',
          'One container image per agent tier; shared base layer for common dependencies',
          r.isCritical ? 'Multi-zone node pools; Pod Disruption Budgets for zero-downtime rolling updates' : 'Liveness + readiness probes per agent container',
        ].filter(Boolean) as string[]}
      />
      <RecCard
        title="CI/CD pipeline" status="needed" effort={5} confidence={100}
        why="Automated pipelines are non-negotiable for any production agent system with multiple integration points."
        bullets={[
          'Stages: lint → unit test → security scan (Trivy/SAST) → build → staging deploy → smoke test → prod',
          'Automated rollback: revert to last stable image if smoke test fails; keep last 3 good images',
          r.isAzure ? 'Azure DevOps pipelines or GitHub Actions with environment approval gates' : 'GitLab CI / GitHub Actions with environment protection rules',
          'Agent config changes require PR review + staging validation before prod promotion',
        ]}
      />
      <RecCard
        title="Infrastructure as code" status="needed" effort={5} confidence={100}
        why="All infrastructure must be reproducible, version-controlled, and policy-compliant from day one."
        bullets={[
          r.isAzure ? 'Bicep or Terraform azurerm; remote state in Azure Storage Account' : 'Terraform with remote state in S3 or GCS',
          'Policy-as-code: Azure Policy or OPA/Rego to enforce tagging, allowed SKUs, network rules',
          'Separate state files per environment (dev / staging / prod)',
          'Drift detection: scheduled terraform plan in CI; alert on unexpected resource changes',
        ]}
      />

      <SectionHeader>Observability stack</SectionHeader>
      <RecCard
        title="Application performance monitoring" status="needed" effort={4} confidence={95}
        why="Agent systems need custom metrics beyond standard APM — latency per agent, tool success rate, queue depth."
        bullets={[
          r.isAzure ? 'Azure Application Insights with custom metric namespaces per agent tier' : 'Datadog or New Relic with custom dimension cardinality',
          'Instrument: agent invocations, tool calls, LLM latency, retry counts, queue wait time',
          'Custom dashboards: one per agent tier + one global health overview',
          'SLO targets: p99 latency per tier, error rate < 0.1%, tool success rate > 99%',
        ]}
      />
      <RecCard
        title="Distributed tracing"
        status={form.psizeIdx >= 1 ? 'needed' : 'optional'}
        effort={3}
        confidence={form.psizeIdx >= 1 ? 88 : 55}
        why="Cross-agent calls need end-to-end trace correlation to diagnose failures and latency spikes."
        bullets={[
          'OpenTelemetry SDK: inject TraceId/SpanId into all agent-to-agent calls and tool invocations',
          r.isAzure ? 'Export traces via OTLP exporter to Azure Monitor / Application Insights' : 'Jaeger or Tempo for trace storage; Grafana for visualisation',
          'Propagate correlationId from inbound request through all downstream tool calls',
          'Sampling: 100% for errors, adaptive 5–10% for successful traces in production',
        ]}
      />
      <RecCard
        title="Alerting & runbooks" status="needed" effort={3} confidence={90}
        why="Every alert must have a linked runbook — on-call engineers should never debug blind."
        bullets={[
          'P1 (system down) → PagerDuty immediate; P2 (degraded) → Teams channel; P3 → email digest',
          'Runbook per alert: diagnosis steps, rollback procedure, escalation path, expected resolution time',
          r.isAzure ? 'Azure Monitor Action Groups + Logic App for automated first-response remediation' : 'Alertmanager + PagerDuty integration',
          'Weekly alert review: tune thresholds, retire noise, add new baselines after each incident',
        ]}
      />
      {r.hasLLM && (
        <RecCard
          title="LLM cost & quality monitoring" status="needed" effort={4} confidence={85}
          why="Token costs and output quality can drift silently without a dedicated monitoring layer."
          bullets={[
            'Token dashboard: daily spend broken down by agent, model, and environment',
            'Output quality scoring: thumbs-up/down + automated coherence / hallucination checks',
            'Fallback model routing: if primary model p99 > 5 s, route to smaller/faster model',
            r.isAzure ? 'Azure OpenAI usage metrics + budget alerts via Azure Monitor' : 'LangSmith or custom logging table for LLM call traces',
          ]}
        />
      )}
      {r.isCritical && (
        <RecCard
          title="BCDR — Business continuity & disaster recovery" status="needed" effort={6} confidence={92}
          why="Zero-tolerance failure profile requires a tested DR plan with contractual RTO/RPO targets."
          bullets={[
            'RTO < 1 hour, RPO < 15 minutes for all critical agent workflows',
            r.isAzure ? 'Geo-redundant deployment across 2 paired Azure regions; Traffic Manager failover' : 'Multi-region active-passive with Route 53 health-check failover',
            'Automated failover: health check → DNS cutover → smoke test within 10 minutes',
            'Quarterly DR drill: simulate full region failure, measure actual RTO vs. target',
          ]}
        />
      )}
    </div>
  );
}

// ─── Tab 6: Estimation ────────────────────────────────────────────────────────

function EstimationTab({ form, r }: { form: FormData; r: Results }) {
  const rawSum    = r.agentDays + r.dataDays + r.govDays + r.secDays + r.depDays + r.obsDays;
  const bufferDays= r.totalDays - rawSum;

  const bars = [
    { label: 'Agent layers',            days: r.agentDays, color: 'bg-indigo-500' },
    { label: 'Data stores',             days: r.dataDays,  color: 'bg-teal-500'   },
    { label: 'Security / IAM',          days: r.secDays,   color: 'bg-red-400'    },
    { label: 'Governance / compliance', days: r.govDays,   color: 'bg-amber-400'  },
    { label: 'Deployment / IaC',        days: r.depDays,   color: 'bg-blue-400'   },
    { label: 'Observability',           days: r.obsDays,   color: 'bg-purple-400' },
    { label: 'Buffer (30%)',            days: bufferDays,  color: 'bg-gray-300'   },
  ];
  const maxDays = Math.max(...bars.map(b => b.days), 1);

  // Sprint plan — sequential, conditional
  const items: string[] = [];
  items.push('Foundation — IaC scaffolding, CI/CD pipeline, Key Vault, security baseline');
  const storeItems = [
    r.vectorStatus !== 'skip' && (r.isAzure ? 'Azure AI Search' : 'Vector DB'),
    r.cosmosStatus !== 'skip' && 'Cosmos DB',
    r.blobStatus   !== 'skip' && 'Blob Storage',
    r.mongoStatus  !== 'skip' && (r.hasMongo ? 'MongoDB (configure)' : 'MongoDB'),
  ].filter(Boolean) as string[];
  if (storeItems.length) items.push(`Data layer — ${storeItems.join(', ')}`);
  const msgItems = [
    r.sbStatus    !== 'skip' && (r.isAzure ? 'Service Bus' : 'Kafka'),
    r.redisStatus !== 'skip' && (r.isAzure ? 'Azure Cache Redis' : 'Redis'),
  ].filter(Boolean) as string[];
  if (msgItems.length) items.push(`Messaging & cache — ${msgItems.join(', ')}`);
  items.push('Core agents — tool wrappers, utility agent skeletons, integration tests');
  if (r.orchStatus !== 'skip') items.push('Orchestrator — planning loop, task dispatch, multi-agent protocol');
  if (r.superStatus !== 'skip' || r.hasLLM) items.push('Super agents + LLM integration — domain reasoning, prompt versioning');
  items.push('Observability — APM, distributed tracing, alerting, audit pipeline');
  if (r.hasPII || r.hasHIPAA) items.push('Compliance hardening — data classification, encryption, HIPAA audit controls');
  items.push('Integration + load testing + UAT');
  if (form.horizon === 'production' || form.horizon === 'program')
    items.push('Production hardening — runbooks, DR drill, chaos testing, perf tuning');

  // Cost signals
  const costRows = [
    r.hasLLM && { svc: 'Azure OpenAI', range: '$500–$3,000/mo', note: 'based on token volume' },
    (r.vectorStatus !== 'skip' && r.isAzure) && { svc: 'Azure AI Search', range: '$250–$1,500/mo', note: 'Basic → Standard S2' },
    r.cosmosStatus !== 'skip' && { svc: 'Cosmos DB', range: '$200–$2,000/mo', note: 'serverless vs. provisioned' },
    r.redisStatus  !== 'skip' && { svc: r.isAzure ? 'Azure Cache Redis' : 'Redis', range: '$150–$800/mo', note: 'C1 Basic → P1 Premium' },
    { svc: form.psizeIdx >= 2 ? 'AKS compute' : 'Container Apps', range: form.psizeIdx >= 2 ? '$600–$3,000/mo' : '$150–$600/mo', note: PSIZE_OPTIONS[form.psizeIdx].label },
    r.sbStatus   !== 'skip' && { svc: r.isAzure ? 'Service Bus' : 'Kafka/Event Hub', range: '$50–$400/mo', note: 'Standard vs. Premium' },
    r.blobStatus !== 'skip' && { svc: r.isAzure ? 'Blob Storage' : 'Object Storage', range: '$20–$200/mo', note: 'Hot + Cool tiers' },
    { svc: 'Monitoring / logs', range: '$100–$500/mo', note: 'Log Analytics ingestion' },
  ].filter(Boolean) as { svc: string; range: string; note: string }[];

  return (
    <div className="space-y-6">
      {/* Headline metrics */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { label: 'Total effort',    value: `${r.totalDays}d`, sub: 'incl. 30% buffer' },
          { label: 'Sprints',         value: String(r.sprints), sub: '2-week sprints'   },
          { label: 'Cal. months',     value: `~${r.calMonths}`, sub: 'est. duration'    },
          { label: 'Team size',       value: r.teamSize,        sub: 'engineers'        },
        ] as { label: string; value: string; sub: string }[]).map(m => (
          <div key={m.label} className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-gray-800">{m.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div>
        <SectionHeader>Effort breakdown</SectionHeader>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          {bars.map(b => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-44 shrink-0 text-right">{b.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full ${b.color} transition-all`}
                  style={{ width: `${Math.round((b.days / maxDays) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 w-8 shrink-0">{b.days}d</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sprint plan */}
      <div>
        <SectionHeader>Sprint plan</SectionHeader>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2.5">
          {items.map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="shrink-0 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded mt-0.5">
                S{i + 1}
              </span>
              <span className="text-sm text-gray-700 leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost signals */}
      <div>
        <SectionHeader>Infrastructure cost signals (monthly)</SectionHeader>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Est. range</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {costRows.map(row => (
                <tr key={row.svc}>
                  <td className="px-4 py-2.5 font-medium text-gray-700">{row.svc}</td>
                  <td className="px-4 py-2.5 text-gray-600">{row.range}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 7: Risk & Readiness ──────────────────────────────────────────────────

function RiskTab({ form, r }: { form: FormData; r: Results }) {
  const risks = [
    {
      label: 'Integration complexity',
      score: Math.min(100, r.sysCount * 10 + (r.isCritical ? 20 : 0)),
      note: `${r.sysCount} integration(s) — each adds auth surface, schema drift risk, and retry logic`,
    },
    {
      label: 'Compliance / regulatory',
      score: r.hasHIPAA ? 75 : r.hasPII ? 55 : 25,
      note: r.hasHIPAA
        ? 'HIPAA requires formal BAA, PHI classification, and 7-year retention'
        : r.hasPII
        ? 'PII handling adds data classification and right-to-erasure obligations'
        : 'Standard compliance risk for this domain',
    },
    {
      label: 'LLM reliability',
      score: r.hasLLM ? (r.isCritical ? 70 : 50) : 15,
      note: r.hasLLM
        ? 'Output variability and latency spikes require validation + fallback routing'
        : 'No LLM in scope — low inherent risk',
    },
    {
      label: 'Data readiness',
      score: r.hasUnstruct || r.hasLargeVol ? 65 : 35,
      note: r.hasUnstruct
        ? 'Unstructured data needs ETL / chunking pipeline before agents can consume it'
        : 'Structured data — lower ingestion preparation risk',
    },
    {
      label: 'Scope / architecture complexity',
      score: Math.min(100, Math.round(r.orchScore / 2 + r.superScore / 4 + 20)),
      note: `${r.pattern} with ${PSIZE_OPTIONS[form.psizeIdx].label}`,
    },
    {
      label: 'Deployment complexity',
      score: r.isCritical || form.psizeIdx >= 2 ? 65 : 40,
      note: r.isCritical
        ? 'Zero-tolerance profile requires multi-region BCDR and quarterly DR drills'
        : 'Standard deployment complexity for this scale',
    },
  ];

  const riskBarColor  = (s: number) => s >= 70 ? 'bg-red-500'  : s >= 45 ? 'bg-amber-400' : 'bg-green-400';
  const riskPillColor = (s: number) => s >= 70 ? 'bg-red-50 text-red-600' : s >= 45 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600';
  const riskLabel     = (s: number) => s >= 70 ? 'High' : s >= 45 ? 'Medium' : 'Low';

  const dataReady = Math.max(10, 100 - (r.hasUnstruct ? 20 : 0) - (r.hasLargeVol ? 15 : 0) - (r.hasPII ? 10 : 0));
  const teamReady = Math.max(10, 100 - form.psizeIdx * 10 - (r.hasLLM ? 10 : 0) - (r.isCritical ? 10 : 0));
  const archReady = Math.min(100, Math.round(r.orchScore / 2 + 40));
  const govReady  = Math.max(10, 100 - (r.hasHIPAA ? 30 : 0) - (r.hasPII ? 15 : 0) - (!r.hasAudit ? 15 : 0));

  const readiness = [
    { label: 'Data readiness',         score: dataReady, note: dataReady >= 80 ? 'Well-structured data landscape'         : 'ETL / classification prep work needed before agent ingestion' },
    { label: 'Team readiness',         score: teamReady, note: teamReady >= 70 ? 'Achievable with current team composition' : 'Consider upskilling on LLM and multi-agent patterns' },
    { label: 'Architecture readiness', score: archReady, note: archReady >= 70 ? 'Clear architecture path forward'          : 'Architecture spike recommended in Sprint 1' },
    { label: 'Governance readiness',   score: govReady,  note: govReady  >= 70 ? 'Governance baseline is in place'         : 'Governance controls must be established before prod launch' },
  ];

  const scoreRing  = (s: number) =>
    s >= 70 ? 'ring-1 ring-green-200 bg-green-50'
    : s >= 50 ? 'ring-1 ring-amber-200 bg-amber-50'
    : 'ring-1 ring-red-200 bg-red-50';
  const scoreColor = (s: number) =>
    s >= 70 ? 'text-green-600' : s >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader>Risk assessment</SectionHeader>
        <div className="space-y-3">
          {risks.map(risk => (
            <div key={risk.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{risk.label}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskPillColor(risk.score)}`}>
                  {riskLabel(risk.score)}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-2 rounded-full transition-all ${riskBarColor(risk.score)}`}
                  style={{ width: `${risk.score}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{risk.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader>Readiness assessment</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          {readiness.map(item => (
            <div key={item.label} className={`rounded-xl p-4 ${scoreRing(item.score)}`}>
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className={`text-3xl font-bold ${scoreColor(item.score)}`}>{item.score}%</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 8: Project Charter ───────────────────────────────────────────────────

function CharterTab({ form, r }: { form: FormData; r: Results }) {
  const activeStores = [
    r.vectorStatus !== 'skip' && 'Vector DB',
    r.cosmosStatus !== 'skip' && 'Cosmos DB',
    r.redisStatus  !== 'skip' && 'Redis',
    r.sbStatus     !== 'skip' && 'Service Bus',
    r.blobStatus   !== 'skip' && 'Blob Storage',
    r.mongoStatus  !== 'skip' && 'MongoDB',
  ].filter(Boolean) as string[];

  const agentFlow = [
    r.orchStatus  !== 'skip' && 'Orchestrator',
    r.superStatus !== 'skip' && 'Super agents',
    'Utility agents',
    'Tools',
  ].filter(Boolean) as string[];

  const highRisks = [
    r.sysCount >= 6 && 'Integration complexity',
    (r.hasPII || r.hasHIPAA) && 'Compliance / regulatory',
    (r.hasLLM && r.isCritical) && 'LLM reliability',
  ].filter(Boolean) as string[];

  const successCriteria = [
    r.hasRT    ? 'Real-time agent response latency < 2 s at p99' : '',
    r.hasAudit ? '100% of agent actions captured in immutable audit trail' : '',
    r.hasLLM   ? 'LLM output quality score ≥ 85% on held-out evaluation set' : '',
    'Zero unplanned outages in first 30 days post-launch',
    'End-to-end CI/CD pipeline deploys to production in < 60 min from merge',
  ].filter(Boolean) as string[];

  const integrationLabels = INTEGRATION_CHIPS
    .filter(c => form.integrations.includes(c.id)).map(c => c.label);

  const envLabel     = ENV_OPTIONS.find(o => o.value === form.environment)?.label ?? form.environment;
  const horizonLabel = HORIZON_OPTIONS.find(o => o.value === form.horizon)?.label ?? form.horizon;
  const humanLabel   = HUMAN_OPTIONS.find(o => o.value === form.human)?.label ?? form.human;

  function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex gap-4 py-3 border-b border-gray-50 last:border-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-40 shrink-0 pt-0.5">
          {label}
        </span>
        <div className="flex-1 text-sm text-gray-700">{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-1">
          {form.projectName || 'Unnamed project'}
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          {form.objective || 'No objective entered.'}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 divide-y divide-gray-50">
        <Row label="Architecture">
          <span className="font-medium">{r.pattern}</span>
          <span className="text-gray-400"> · {form.domain} · {envLabel}</span>
        </Row>
        <Row label="Effort estimate">
          <span className="font-medium">{r.totalDays} days</span>
          <span className="text-gray-400"> · {r.sprints} sprints · ~{r.calMonths} months · {r.teamSize} engineers</span>
        </Row>
        <Row label="Programme scope">
          {PSIZE_OPTIONS[form.psizeIdx].label} · {horizonLabel} · {humanLabel}
        </Row>
        <Row label="Agent layers">
          <div className="flex flex-wrap items-center gap-1">
            {agentFlow.map((a, i) => (
              <React.Fragment key={a}>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded">{a}</span>
                {i < agentFlow.length - 1 && <span className="text-gray-300 text-xs">→</span>}
              </React.Fragment>
            ))}
          </div>
        </Row>
        <Row label="Data stores">
          {activeStores.length > 0 ? activeStores.join(', ') : 'No stores recommended'}
        </Row>
        <Row label="Integrations">
          {integrationLabels.length > 0 ? integrationLabels.join(', ') : 'None selected'}
        </Row>
        <Row label="Security">
          Managed Identity · Key Vault · RBAC per agent tier
          {(r.hasPII || r.hasHIPAA) && ' · CMK encryption'}
          {r.isCritical && ' · Private endpoints · BCDR'}
        </Row>
        <Row label="Deployment">
          {r.isAzure ? (form.psizeIdx >= 2 ? 'AKS' : 'Azure Container Apps') : 'Kubernetes'}
          {' · CI/CD · Bicep/Terraform · OpenTelemetry'}
        </Row>
        {highRisks.length > 0 && (
          <Row label="Key risks">
            <div className="flex flex-wrap gap-1.5">
              {highRisks.map(risk => (
                <span key={risk} className="bg-red-50 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {risk}
                </span>
              ))}
            </div>
          </Row>
        )}
        <Row label="Success criteria">
          <ul className="space-y-1">
            {successCriteria.map(c => (
              <li key={c} className="flex gap-2 text-xs text-gray-600">
                <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </Row>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgenticPlanner() {
  const [activeTab, setActiveTab] = useState<TabName>('Context');
  const [form, setForm]           = useState<FormData>(DEFAULT_FORM);
  const [results, setResults]     = useState<Results | null>(null);

  const analyzed = results !== null;
  const isLocked = (tab: TabName) => tab !== 'Context' && !analyzed;

  const handleAnalyze = () => {
    setResults(computeResults(form));
    setActiveTab('Architecture');
  };

  const handleAnalyzeWith = (f: FormData) => {
    setResults(computeResults(f));
    setActiveTab('Architecture');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <BrainCircuit className="w-6 h-6 text-indigo-600" />
        <div>
          <h1 className="text-lg font-bold text-gray-800">AI Project Planner</h1>
          <p className="text-xs text-gray-400">Enterprise agentic AI sizing, architecture &amp; estimation</p>
        </div>
        {analyzed && (
          <span className="ml-auto bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
            Analysis complete
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 shrink-0 overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => !isLocked(tab) && setActiveTab(tab)}
              className={[
                'px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600 font-medium'
                  : isLocked(tab)
                  ? 'border-transparent text-gray-300 cursor-not-allowed'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {activeTab === 'Context' && (
            <>
              <ContextTab
                form={form} setForm={setForm}
                onAnalyze={handleAnalyze} onAnalyzeWith={handleAnalyzeWith}
              />
              {results && <ResultsSummaryBar r={results} />}
            </>
          )}
          {activeTab === 'Architecture'         && results && <ArchitectureTab form={form} r={results} />}
          {activeTab === 'Data Stores'          && results && <DataStoresTab   form={form} r={results} />}
          {activeTab === 'Security & Governance'&& results && <SecurityTab     form={form} r={results} />}
          {activeTab === 'Deployment'           && results && <DeploymentTab   form={form} r={results} />}
          {activeTab === 'Estimation'           && results && <EstimationTab   form={form} r={results} />}
          {activeTab === 'Risk & Readiness'     && results && <RiskTab         form={form} r={results} />}
          {activeTab === 'Project Charter'      && results && <CharterTab      form={form} r={results} />}
        </div>
      </div>
    </div>
  );
}
