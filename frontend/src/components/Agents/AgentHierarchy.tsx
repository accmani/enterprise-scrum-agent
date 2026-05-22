import React, { useState } from 'react';

const _BUILD_V = 'agentic-ai-v2';

const ORCHESTRATOR_COMPONENTS = [
  { label: 'Memory', sublabel: 'session + persist', icon: '🧠', color: '#6366F1', bg: '#EEF2FF' },
  { label: 'Planning', sublabel: 'task decomposer', icon: '📋', color: '#6366F1', bg: '#EEF2FF' },
  { label: 'Feedback', sublabel: 'output evaluator', icon: '✅', color: '#6366F1', bg: '#EEF2FF' },
  { label: 'Multi-agent Protocol', sublabel: 'registry · broker · state', icon: '🔗', color: '#6366F1', bg: '#EEF2FF' },
];

const NAMED_AGENTS = [
  {
    id: 'coding_agent',
    name: 'Coding Agent',
    icon: '💻',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#93C5FD',
    persona: 'Tech Lead',
    description: 'Design, code review, PRs, architecture for the healthcare claims system.',
    tools: [
      { name: 'design_agent',       icon: '🏗️', type: 'domain' },
      { name: 'code_review_agent',  icon: '👁',  type: 'domain' },
      { name: 'github_integration', icon: '🐙', type: 'utility' },
      { name: 'estimation_tool',    icon: '🎯', type: 'domain' },
      { name: 'jira_integration',   icon: '🎫', type: 'utility' },
    ],
  },
  {
    id: 'retrieval_agent',
    name: 'Retrieval Agent',
    icon: '🔍',
    color: '#0891B2',
    bg: '#ECFEFF',
    border: '#67E8F9',
    persona: 'Scrum Master',
    description: 'Fetches and assembles context from Jira, GitHub, and the claims database.',
    tools: [
      { name: 'jira_integration',   icon: '🎫', type: 'utility' },
      { name: 'db_agent',           icon: '🗄️', type: 'utility' },
      { name: 'github_integration', icon: '🐙', type: 'utility' },
      { name: 'metrics_tool',       icon: '📊', type: 'utility' },
    ],
  },
  {
    id: 'citation_agent',
    name: 'Citation Agent',
    icon: '📎',
    color: '#9333EA',
    bg: '#FAF5FF',
    border: '#D8B4FE',
    persona: 'Release Manager',
    description: 'Generates structured reports with cited Jira/GitHub sources.',
    tools: [
      { name: 'release_agent',      icon: '🚀', type: 'domain' },
      { name: 'retro_agent',        icon: '🔄', type: 'domain' },
      { name: 'sprint_manager',     icon: '📅', type: 'domain' },
      { name: 'jira_integration',   icon: '🎫', type: 'utility' },
      { name: 'github_integration', icon: '🐙', type: 'utility' },
    ],
  },
  {
    id: 'planning_agent',
    name: 'Planning Agent',
    icon: '📋',
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#C4B5FD',
    persona: 'Scrum Master',
    description: 'Sprint planning, backlog management, velocity, and agile ceremonies.',
    tools: [
      { name: 'sprint_manager',    icon: '📅', type: 'domain' },
      { name: 'story_manager',     icon: '📝', type: 'domain' },
      { name: 'estimation_tool',   icon: '🎯', type: 'domain' },
      { name: 'retro_agent',       icon: '🔄', type: 'domain' },
      { name: 'jira_integration',  icon: '🎫', type: 'utility' },
      { name: 'metrics_tool',      icon: '📊', type: 'utility' },
    ],
  },
  {
    id: 'qa_agent',
    name: 'QA Agent',
    icon: '🧪',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#6EE7B7',
    persona: 'QA Lead',
    description: 'Test case generation, BDD scenarios, quality metrics, defect analysis.',
    tools: [
      { name: 'qa_agent',          icon: '🧪', type: 'domain' },
      { name: 'estimation_tool',   icon: '🎯', type: 'domain' },
      { name: 'jira_integration',  icon: '🎫', type: 'utility' },
      { name: 'metrics_tool',      icon: '📊', type: 'utility' },
      { name: 'db_agent',          icon: '🗄️', type: 'utility' },
    ],
  },
];

const PROTOCOL_STEPS = [
  { icon: '🔎', label: 'Discover Agent Capabilities', desc: 'AgentRegistry.discover() — keyword scoring across all agents' },
  { icon: '📤', label: 'Share Tasks', desc: 'TaskBroker.handoff() — injects cumulative results into next agent' },
  { icon: '🔄', label: 'Update Task Information', desc: 'TaskPlanState — tracks step status, timing, and results' },
];

export function AgentHierarchy() {
  const [expanded, setExpanded] = useState<string | null>('coding_agent');
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id);

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', fontFamily: 'inherit' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          Agentic AI Architecture
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Orchestrator LLM with Memory · Planning · Feedback · Multi-agent Protocol → Named Specialist Agents
        </p>
      </div>

      {/* ── Orchestrator LLM box ── */}
      <div style={{
        background: '#F8F7FF',
        border: '2px solid #6366F1',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '8px',
        boxShadow: '0 2px 16px rgba(99,102,241,0.10)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '24px' }}>🧠</span>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#4F46E5', margin: 0 }}>Orchestrator LLM</p>
            <p style={{ fontSize: '11px', color: '#6B7280', margin: 0 }}>SDLCOrchestrator — single entry point for all requests</p>
          </div>
        </div>

        {/* 4 components inside orchestrator */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {ORCHESTRATOR_COMPONENTS.map(c => (
            <div key={c.label} style={{
              background: 'white',
              border: '1px solid #C7D2FE',
              borderRadius: '10px',
              padding: '10px 12px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{c.icon}</div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#4F46E5', margin: '0 0 2px' }}>{c.label}</p>
              <p style={{ fontSize: '10px', color: '#9CA3AF', margin: 0 }}>{c.sublabel}</p>
            </div>
          ))}
        </div>

        {/* Multi-agent Protocol steps */}
        <div style={{ background: '#EEF2FF', borderRadius: '10px', padding: '12px 14px' }}>
          <p style={{ fontSize: '10px', fontWeight: 600, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
            Multi-agent Protocol
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {PROTOCOL_STEPS.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ fontSize: '14px', marginTop: '1px' }}>{s.icon}</span>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#4338CA', margin: '0 0 1px' }}>{s.label}</p>
                  <p style={{ fontSize: '10px', color: '#6B7280', margin: 0 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Connector */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0' }}>
        <div style={{ width: '2px', height: '20px', background: '#C7D2FE' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '90%', height: '2px', background: '#C7D2FE' }} />
      </div>

      {/* ── Named Agents ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '32px' }}>
        {NAMED_AGENTS.map(agent => (
          <div key={agent.id}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '2px', height: '18px', background: '#C7D2FE' }} />
            </div>

            <div
              onClick={() => toggle(agent.id)}
              style={{
                background: 'var(--color-background-primary)',
                border: expanded === agent.id ? `2px solid ${agent.color}` : `1px solid ${agent.border}`,
                borderRadius: '12px',
                padding: '12px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: expanded === agent.id ? `0 2px 12px ${agent.color}22` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '18px' }}>{agent.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: agent.color, margin: 0, lineHeight: 1.2 }}>
                    {agent.name}
                  </p>
                </div>
                <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
                  {expanded === agent.id ? '▲' : '▼'}
                </span>
              </div>

              <span style={{
                display: 'inline-block',
                fontSize: '9px',
                padding: '1px 6px',
                borderRadius: '20px',
                background: agent.bg,
                color: agent.color,
                fontWeight: 500,
                marginBottom: '4px',
                border: `1px solid ${agent.border}`,
              }}>
                {agent.persona}
              </span>

              <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
                {agent.description}
              </p>

              {expanded === agent.id && (
                <div style={{ marginTop: '10px', borderTop: `1px solid ${agent.border}`, paddingTop: '8px' }}>
                  <p style={{ fontSize: '9px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' }}>
                    Tools ({agent.tools.length})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {agent.tools.map(tool => (
                      <div
                        key={tool.name}
                        onMouseEnter={() => setHoveredTool(tool.name)}
                        onMouseLeave={() => setHoveredTool(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 6px',
                          borderRadius: '5px',
                          background: hoveredTool === tool.name
                            ? (tool.type === 'utility' ? '#FFF7ED' : agent.bg)
                            : 'var(--color-background-secondary)',
                          border: `1px solid ${tool.type === 'utility' ? '#FED7AA' : agent.border}`,
                          transition: 'background 0.1s',
                        }}
                      >
                        <span style={{ fontSize: '11px' }}>{tool.icon}</span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                          {tool.name}
                        </span>
                        {tool.type === 'utility' && (
                          <span style={{ marginLeft: 'auto', fontSize: '8px', color: '#EA580C', fontWeight: 600, textTransform: 'uppercase' }}>
                            shared
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Output box ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
        <div style={{
          background: '#F9FAFB',
          border: '1px dashed #D1D5DB',
          borderRadius: '10px',
          padding: '10px 28px',
          textAlign: 'center',
          minWidth: '200px',
        }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', margin: 0 }}>Output</p>
          <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '2px 0 0' }}>reply · agent_chain · task_plan · eval_score · memory_summary</p>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ borderTop: '1px dashed var(--color-border-secondary)', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#EFF6FF', border: '1px solid #93C5FD' }} />
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Domain tool (agent-specific)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#FFF7ED', border: '1px solid #FED7AA' }} />
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Utility tool (shared across agents)</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
          Click an agent card to expand its tools
        </div>
      </div>
    </div>
  );
}
