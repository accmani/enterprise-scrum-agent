import React from 'react';
import {
  MessageSquare, LayoutDashboard,
  GitBranch, Play, Activity, Network, Cpu, BrainCircuit,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const SECTIONS = [
  {
    label: 'DEMO',
    tabs: [
      { id: 'demo',     label: 'HCSC Demo',       icon: Play,           highlight: true },
      { id: 'pipeline', label: 'SDLC Pipeline',   icon: GitBranch },
      { id: 'context',  label: 'Context Engine',  icon: Cpu,            badge: 'New' },
    ],
  },
  {
    label: 'AGENTS',
    tabs: [
      { id: 'agents',  label: 'Agent Hierarchy', icon: Network },
      { id: 'chat',    label: 'Agent Chat',      icon: MessageSquare },
      { id: 'metrics', label: 'Agent Metrics',   icon: Activity,       badge: 'Live' },
    ],
  },
  {
    label: 'TOOLS',
    tabs: [
      { id: 'planner', label: 'AI Project Planner', icon: BrainCircuit, badge: 'New' },
    ],
  },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside style={{ width: '224px', background: '#111827', display: 'flex', flexDirection: 'column', padding: '8px 0', flexShrink: 0 }}>
      {SECTIONS.map(section => (
        <div key={section.label}>
          <p style={{ padding: '16px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            {section.label}
          </p>
          {section.tabs.map(({ id, label, icon: Icon, highlight, badge }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 16px', width: '100%', border: 'none', cursor: 'pointer',
                fontSize: '13px', textAlign: 'left', transition: 'background 0.15s',
                background: activeTab === id ? '#4F46E5' : 'transparent',
                color: activeTab === id ? 'white' : highlight ? '#818CF8' : '#9CA3AF',
              }}
              onMouseEnter={e => { if (activeTab !== id) (e.currentTarget as HTMLElement).style.background = '#1F2937'; }}
              onMouseLeave={e => { if (activeTab !== id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Icon style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{label}</span>
              {highlight && activeTab !== id && (
                <span style={{ fontSize: '10px', background: '#312E81', color: '#A5B4FC', padding: '2px 6px', borderRadius: '4px' }}>Demo</span>
              )}
              {badge && activeTab !== id && badge === 'Live' && (
                <span style={{ fontSize: '10px', background: '#064E3B', color: '#6EE7B7', padding: '2px 6px', borderRadius: '4px' }}>Live</span>
              )}
              {badge && activeTab !== id && badge === 'New' && (
                <span style={{ fontSize: '10px', background: '#2E1065', color: '#C4B5FD', padding: '2px 6px', borderRadius: '4px' }}>New</span>
              )}
            </button>
          ))}
        </div>
      ))}

      {/* Agent hierarchy mini-map */}
      <div style={{ marginTop: 'auto', padding: '16px', paddingTop: '24px' }}>
        <div style={{ background: '#1F2937', borderRadius: '10px', padding: '12px' }}>
          <p style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
            Agent Hierarchy
          </p>
          {[
            { icon: '🧠', label: 'Orchestrator', color: '#A5B4FC' },
            { icon: '🏃', label: 'Planning',     color: '#86EFAC' },
            { icon: '⚙️', label: 'Engineering',  color: '#93C5FD' },
            { icon: '🧪', label: 'QA',           color: '#FCA5A5' },
            { icon: '🚀', label: 'Delivery',     color: '#FCD34D' },
          ].map(a => (
            <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0' }}>
              <span style={{ fontSize: '11px' }}>{a.icon}</span>
              <span style={{ fontSize: '11px', color: a.color }}>{a.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
