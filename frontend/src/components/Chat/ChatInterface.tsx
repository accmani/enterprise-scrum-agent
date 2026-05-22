import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ChevronDown } from 'lucide-react';
import { chatApi } from '../../services/api';

// Keyword → persona routing (mirrors orchestrator._infer_category)
function detectPersonaFromText(text: string): string {
  const q = text.toLowerCase();
  if (/test|bdd|scenario|acceptance|qa|coverage|edge case|defect/.test(q)) return 'qa_lead';
  if (/release|deploy|changelog|version|rollout|close sprint/.test(q)) return 'release_manager';
  if (/ci\/cd|pipeline|monitor|docker|kubernetes|azure|infra|devops/.test(q)) return 'devops_engineer';
  if (/design|code|pr|pull request|github|branch|architecture|api|review/.test(q)) return 'tech_lead';
  if (/claim|patient|db|database|sql|query|deductible|copay|adjudic/.test(q)) return 'tech_lead';
  if (/sprint|backlog|story|estimate|velocity|standup|retro|planning/.test(q)) return 'scrum_master';
  return 'scrum_master';
}

const PERSONAS = [
  {
    id: 'auto',
    name: 'Auto (Agentic AI SDLC)',
    role: 'Intelligent Routing',
    icon: '🤖',
    color: '#6366F1',
    bg: '#EEF2FF',
    description: 'Agentic AI SDLC auto-routes to the right agent based on your question',
    suggestions: [
      'What is blocking the team this sprint?',
      'Review the latest PR for quality issues',
      'Generate BDD scenarios for claims adjudication',
      'What is our velocity trend?',
    ],
  },
  {
    id: 'scrum_master',
    name: 'Scrum Master',
    role: 'Planning & Ceremonies',
    icon: '🏃',
    color: '#6366F1',
    bg: '#EEF2FF',
    description: 'Sprint planning, velocity, retrospectives',
    suggestions: [
      'What is blocking the team this sprint?',
      'Help me plan our next sprint',
      'Generate a retrospective summary',
      'What is our velocity trend?',
    ],
  },
  {
    id: 'tech_lead',
    name: 'Tech Lead',
    role: 'Engineering & Architecture',
    icon: '⚙️',
    color: '#3B82F6',
    bg: '#EFF6FF',
    description: 'Code review, technical design, PRs',
    suggestions: [
      'Review the latest PR for quality issues',
      'Design the claims adjudication API',
      'What pattern should we use for batch processing?',
      'Create a technical design for the null-check fix',
    ],
  },
  {
    id: 'qa_lead',
    name: 'QA Lead',
    role: 'Quality & Testing',
    icon: '🧪',
    color: '#22C55E',
    bg: '#F0FDF4',
    description: 'BDD scenarios, test cases, defect analysis',
    suggestions: [
      'Generate test cases for the claims adjudication service',
      'Create BDD scenarios for deductible calculation',
      'What edge cases should we test for batch processing?',
      'Show me defect trends and quality metrics',
    ],
  },
  {
    id: 'release_manager',
    name: 'Release Manager',
    role: 'Delivery & Release',
    icon: '🚀',
    color: '#A855F7',
    bg: '#FAF5FF',
    description: 'Release notes, deployment, sprint closure',
    suggestions: [
      'Generate release notes for v1.1.0',
      'Create a deployment checklist for today',
      'Summarize what is going into this sprint',
      'Close the sprint and generate the retrospective',
    ],
  },
  {
    id: 'devops_engineer',
    name: 'DevOps Engineer',
    role: 'Infrastructure & CI/CD',
    icon: '🔧',
    color: '#F97316',
    bg: '#FFF7ED',
    description: 'CI/CD pipelines, deployment automation',
    suggestions: [
      'Set up a CI pipeline for the claims service',
      'Create a GitHub Actions workflow for our release',
      'What monitoring should we add to the claims processor?',
      'Design the Azure Container Apps deployment',
    ],
  },
];

interface TaskStep {
  step_id: string;
  agent: string;
  action: string;
  status: string;
  duration_s: number | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  persona?: string;
  super_agent?: string;
  duration_ms?: number;
  timestamp: Date;
  agent_chain?: string[];
  task_plan?: { steps: TaskStep[]; agents_used: string[] };
  memory_summary?: string;
  eval_score?: number;
}

function PersonaDropdown({
  active,
  onChange,
}: {
  active: typeof PERSONAS[0];
  onChange: (p: typeof PERSONAS[0]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
        style={{ background: active.bg, borderColor: active.color + '44', color: active.color }}
      >
        <span>{active.icon}</span>
        <span>{active.name}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Select Persona
          </p>
          {PERSONAS.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p); setOpen(false); }}
              className="flex items-start gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              style={active.id === p.id ? { background: p.bg } : {}}
            >
              <span className="text-xl mt-0.5">{p.icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-400">{p.role}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
              </div>
              {active.id === p.id && (
                <span className="ml-auto text-xs font-medium" style={{ color: p.color }}>Active</span>
              )}
            </button>
          ))}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Each persona activates a specialized Super Agent with focused tools.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePersona, setActivePersona] = useState(PERSONAS[0]);
  const [thinkingPersona, setThinkingPersona] = useState(PERSONAS[0]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Scroll to bottom only when a new message is added (not on every re-render)
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    // Resolve the actual persona to use — auto mode detects from question keywords
    const resolvedPersonaId =
      activePersona.id === 'auto' ? detectPersonaFromText(text) : activePersona.id;
    const resolved = PERSONAS.find(p => p.id === resolvedPersonaId) ?? PERSONAS[1];
    setThinkingPersona(resolved);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await chatApi.send(text, messages, resolvedPersonaId);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.reply,
        persona: result.persona,
        super_agent: result.super_agent,
        duration_ms: result.duration_ms,
        timestamp: new Date(),
        agent_chain: result.agent_chain,
        task_plan: result.task_plan,
        memory_summary: result.memory_summary,
        eval_score: result.eval_score,
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${e.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    // No fixed height — grows with content so `main` in App.tsx is the scroll container
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#F9FAFB' }}>

      {/* Persona bar — sticky at top of the scrolling main */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 16px',
        background: 'white', borderBottom: '1px solid #E5E7EB',
      }}>
        <PersonaDropdown active={activePersona} onChange={setActivePersona} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9CA3AF' }}>
          <span style={{ padding: '2px 8px', borderRadius: '999px', background: activePersona.color, color: 'white', fontSize: '11px', fontWeight: 500 }}>
            {activePersona.role}
          </span>
          <span>→</span>
          <span style={{ fontFamily: 'monospace', color: '#6B7280' }}>
            {activePersona.id === 'auto' ? 'agentic_sdlc_auto_router' :
             activePersona.id === 'scrum_master' ? 'planning_super_agent' :
             activePersona.id === 'tech_lead' ? 'engineering_super_agent' :
             activePersona.id === 'qa_lead' ? 'qa_super_agent' :
             activePersona.id === 'release_manager' ? 'delivery_super_agent' :
             'engineering_super_agent'}
          </span>
        </div>
      </div>

      {/* Message list — natural height, no overflow */}
      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '0' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '16px', background: activePersona.bg }}>
              {activePersona.icon}
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937', marginBottom: '4px' }}>{activePersona.name}</h3>
            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>{activePersona.role}</p>
            <p style={{ fontSize: '12px', color: '#9CA3AF', maxWidth: '240px' }}>{activePersona.description}</p>

            {/* Suggestion chips shown inline in empty state */}
            <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '480px' }}>
              {activePersona.suggestions.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '999px', border: `1px solid ${activePersona.color}44`, background: 'white', color: '#374151', cursor: 'pointer' }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = activePersona.color; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.color = '#374151'; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => {
          const msgPersona = PERSONAS.find(p => p.id === m.persona) ?? thinkingPersona;
          return (
          <div key={m.id} style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role === 'assistant' && (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0, background: msgPersona.bg }}>
                {msgPersona.icon}
              </div>
            )}
            <div style={{
              maxWidth: '640px', borderRadius: '16px', padding: '12px 16px', fontSize: '14px',
              background: m.role === 'user' ? '#4F46E5' : 'white',
              color: m.role === 'user' ? 'white' : '#1F2937',
              border: m.role === 'assistant' ? '1px solid #F3F4F6' : 'none',
              borderTopLeftRadius: m.role === 'assistant' ? '4px' : '16px',
              borderTopRightRadius: m.role === 'user' ? '4px' : '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.content}</p>
              {m.role === 'assistant' && m.super_agent && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F3F4F6' }}>
                  {m.agent_chain && m.agent_chain.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'monospace' }}>agents:</span>
                      {m.agent_chain.map((a, i) => (
                        <span key={i} style={{ fontSize: '11px', background: '#EEF2FF', color: '#4F46E5', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{a}</span>
                      ))}
                    </div>
                  )}
                  {m.task_plan && m.task_plan.steps.length > 1 && (
                    <div style={{ marginBottom: '4px' }}>
                      {m.task_plan.steps.map(s => (
                        <div key={s.step_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '1px 0' }}>
                          <span style={{ color: s.status === 'done' ? '#22C55E' : s.status === 'failed' ? '#EF4444' : '#D1D5DB' }}>
                            {s.status === 'done' ? '✓' : s.status === 'failed' ? '✗' : '○'}
                          </span>
                          <span style={{ fontFamily: 'monospace', color: '#9CA3AF' }}>{s.agent}</span>
                          <span style={{ color: '#9CA3AF' }}>{s.action}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#9CA3AF' }}>
                    {m.duration_ms && <span style={{ fontFamily: 'monospace' }}>{(m.duration_ms / 1000).toFixed(1)}s</span>}
                    {m.eval_score !== undefined && (
                      <span style={{ fontFamily: 'monospace', color: m.eval_score >= 0.8 ? '#22C55E' : m.eval_score >= 0.6 ? '#EAB308' : '#EF4444' }}>
                        quality {Math.round(m.eval_score * 100)}%
                      </span>
                    )}
                    {m.memory_summary && <span>· {m.memory_summary}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: thinkingPersona.bg }}>
              <Loader2 style={{ width: '16px', height: '16px', color: thinkingPersona.color, animation: 'spin 1s linear infinite' }} />
            </div>
            <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: '16px', borderTopLeftRadius: '4px', padding: '12px 16px', fontSize: '14px', color: '#9CA3AF', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {thinkingPersona.name} is thinking...
              {activePersona.id === 'auto' && (
                <span style={{ marginLeft: '6px', fontSize: '11px', color: '#C4B5FD' }}>· auto-routed</span>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height: '1px' }} />
      </div>

      {/* Input bar — sticky at bottom of the scrolling main */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 20,
        padding: '12px 16px',
        background: 'white', borderTop: '1px solid #E5E7EB',
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            style={{ flex: 1, border: '1px solid #D1D5DB', borderRadius: '12px', padding: '8px 16px', fontSize: '14px', outline: 'none' }}
            placeholder={`Ask your ${activePersona.name} anything...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            disabled={loading}
            onFocus={e => { e.currentTarget.style.borderColor = activePersona.color; e.currentTarget.style.boxShadow = `0 0 0 2px ${activePersona.color}22`; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{ background: activePersona.color, color: 'white', border: 'none', borderRadius: '12px', padding: '8px 16px', cursor: loading || !input.trim() ? 'default' : 'pointer', opacity: loading || !input.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center' }}
          >
            <Send style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
