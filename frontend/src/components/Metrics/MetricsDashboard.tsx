import React, { useEffect, useState } from 'react';
import { metricsApi } from '../../services/api';

const PERSONA_META: Record<string, { icon: string; color: string; label: string }> = {
  scrum_master:    { icon: '🏃', color: '#6366F1', label: 'Scrum Master'    },
  tech_lead:       { icon: '⚙️', color: '#3B82F6', label: 'Tech Lead'       },
  qa_lead:         { icon: '🧪', color: '#22C55E', label: 'QA Lead'         },
  release_manager: { icon: '🚀', color: '#A855F7', label: 'Release Manager' },
  devops_engineer: { icon: '🔧', color: '#F97316', label: 'DevOps Engineer' },
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F59E0B',
  medium:   '#3B82F6',
  low:      '#22C55E',
};

const CATEGORY_COLOR: Record<string, string> = {
  planning:    '#6366F1',
  engineering: '#3B82F6',
  qa:          '#22C55E',
  delivery:    '#A855F7',
  database:    '#06B6D4',
  metrics:     '#F97316',
  general:     '#9CA3AF',
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-sm text-gray-600 w-36 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-medium text-gray-700 w-10 text-right">{right ?? value}</span>
    </div>
  );
}

export function MetricsDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [byPersona, setByPersona] = useState<any[]>([]);
  const [byCategory, setByCategory] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      metricsApi.overview(),
      metricsApi.byPersona(),
      metricsApi.byCategory(),
      metricsApi.defects(),
      metricsApi.recent(15),
    ]).then(([ov, bp, bc, df, rc]) => {
      if (ov.status === 'fulfilled') setOverview(ov.value);
      if (bp.status === 'fulfilled') setByPersona(bp.value.by_persona || []);
      if (bc.status === 'fulfilled') setByCategory(bc.value.by_category || []);
      if (df.status === 'fulfilled') setDefects(df.value.defects_by_category || []);
      if (rc.status === 'fulfilled') setRecent(rc.value.recent || []);
      setLoading(false);
    });
  }, []);

  const maxPersonaInvocations = Math.max(...byPersona.map(p => p.invocations), 1);
  const maxCategoryInvocations = Math.max(...byCategory.map(c => c.invocations), 1);
  const maxDefectCount = Math.max(...defects.map(d => d.count), 1);

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading agent metrics...</div>;
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Agent Performance Metrics</h2>
        <p className="text-sm text-gray-400">
          Live analytics across all SDLC Super Agents — defects fixed, persona utilization, response times
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Invocations"
          value={overview?.total_invocations ?? '—'}
          sub={`${overview?.invocations_last_7_days ?? 0} this week`}
          color="#6366F1"
        />
        <StatCard
          label="Defects Fixed"
          value={overview?.defects_fixed ?? '—'}
          sub="via AI agent pipeline"
          color="#22C55E"
        />
        <StatCard
          label="Success Rate"
          value={`${overview?.success_rate_pct ?? 0}%`}
          sub={`${overview?.failed ?? 0} errors`}
          color="#3B82F6"
        />
        <StatCard
          label="Avg Response"
          value={overview?.avg_duration_ms ? `${(overview.avg_duration_ms / 1000).toFixed(1)}s` : '—'}
          sub="per agent invocation"
          color="#F97316"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Persona utilization */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-1">Super Agent Utilization</h3>
          <p className="text-xs text-gray-400 mb-4">Invocations per persona / role</p>
          {byPersona.length > 0 ? (
            byPersona.map(p => {
              const meta = PERSONA_META[p.persona] || { icon: '🤖', color: '#9CA3AF', label: p.persona };
              return (
                <BarRow
                  key={p.persona}
                  label={`${meta.icon} ${meta.label}`}
                  value={p.invocations}
                  max={maxPersonaInvocations}
                  color={meta.color}
                  right={`${p.invocations}`}
                />
              );
            })
          ) : (
            <p className="text-sm text-gray-400">No data yet — start chatting to generate metrics.</p>
          )}
        </div>

        {/* SDLC category breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-1">SDLC Stage Distribution</h3>
          <p className="text-xs text-gray-400 mb-4">Where AI effort is concentrated</p>
          {byCategory.length > 0 ? (
            byCategory.map(c => (
              <BarRow
                key={c.category}
                label={c.category}
                value={c.invocations}
                max={maxCategoryInvocations}
                color={CATEGORY_COLOR[c.category] || '#9CA3AF'}
                right={`${c.invocations} (${c.defect_fixes} fixes)`}
              />
            ))
          ) : (
            <p className="text-sm text-gray-400">No data yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Defect breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-1">Defects Fixed by Category</h3>
          <p className="text-xs text-gray-400 mb-4">Root cause categories resolved via AI pipeline</p>
          {defects.length > 0 ? (
            defects.map((d, i) => (
              <div key={i} className="flex items-center gap-3 mb-3">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: SEVERITY_COLOR[d.severity] + '22',
                    color: SEVERITY_COLOR[d.severity] || '#6B7280',
                  }}
                >
                  {d.severity}
                </span>
                <span className="text-sm text-gray-600 flex-1">{d.category}</span>
                <span className="text-sm font-bold text-gray-800">{d.count}</span>
                <span className="text-xs text-gray-400">
                  {d.avg_resolution_ms ? `${(d.avg_resolution_ms / 1000).toFixed(0)}s avg` : ''}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">
              No defect fix data yet. Run the Claims Demo to populate this.
            </p>
          )}

          {/* Bug scenario quick stats */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">
              Healthcare Scenarios
            </p>
            {[
              { id: 'BUG-001', label: 'NPE — Null Coverage',      color: '#EF4444' },
              { id: 'BUG-002', label: 'Deductible Off-by-one',    color: '#F59E0B' },
              { id: 'BUG-003', label: 'Batch Concurrency Crash',   color: '#EF4444' },
              { id: 'BUG-004', label: 'Wrong ER Copay',           color: '#F59E0B' },
              { id: 'BUG-005', label: 'Expired Coverage Approved', color: '#F59E0B' },
              { id: 'BUG-006', label: 'ICD-10 Allowlist Gap',     color: '#3B82F6' },
              { id: 'BUG-007', label: 'Missing Prior Auth',        color: '#F59E0B' },
              { id: 'BUG-008', label: 'Zero-Dollar Claim',        color: '#22C55E' },
            ].map(b => (
              <div key={b.id} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold" style={{ color: b.color }}>{b.id}</span>
                <span className="text-xs text-gray-500">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity feed */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-1">Recent Agent Activity</h3>
          <p className="text-xs text-gray-400 mb-4">Last 15 invocations</p>
          {recent.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recent.map(r => {
                const meta = PERSONA_META[r.persona] || { icon: '🤖', color: '#9CA3AF' };
                return (
                  <div key={r.id} className="flex items-start gap-2 py-2 border-b border-gray-50">
                    <span className="text-sm flex-shrink-0 mt-0.5">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{r.query_preview}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{r.query_category}</span>
                        {r.is_defect_fix && (
                          <span className="text-xs bg-red-50 text-red-600 px-1.5 rounded">fix</span>
                        )}
                        {r.defect_severity && (
                          <span
                            className="text-xs px-1.5 rounded"
                            style={{
                              background: (SEVERITY_COLOR[r.defect_severity] || '#9CA3AF') + '22',
                              color: SEVERITY_COLOR[r.defect_severity] || '#6B7280',
                            }}
                          >
                            {r.defect_severity}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-xs font-medium ${r.success ? 'text-green-600' : 'text-red-500'}`}>
                        {r.success ? '✓' : '✗'}
                      </span>
                      <p className="text-xs text-gray-400">
                        {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No activity yet.</p>
          )}
        </div>
      </div>

      {/* Agent hierarchy diagram */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">Agent Hierarchy</h3>
        <div className="flex flex-col items-center gap-3">
          <div className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-sm">
            🧠 SDLC Orchestrator
          </div>
          <div className="text-gray-300 text-lg">↓</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
            {[
              { name: 'Planning Super Agent',    icon: '🏃', color: '#6366F1', tools: 'sprint · story · estimation · retro', persona: 'Scrum Master' },
              { name: 'Engineering Super Agent', icon: '⚙️', color: '#3B82F6', tools: 'design · code review · GitHub · DB', persona: 'Tech Lead · DevOps' },
              { name: 'QA Super Agent',          icon: '🧪', color: '#22C55E', tools: 'qa agent · metrics · DB queries', persona: 'QA Lead' },
              { name: 'Delivery Super Agent',    icon: '🚀', color: '#A855F7', tools: 'release · retro · sprint closure', persona: 'Release Manager' },
            ].map(sa => (
              <div key={sa.name} className="border rounded-lg p-3 text-center" style={{ borderColor: sa.color + '44' }}>
                <div className="text-xl mb-1">{sa.icon}</div>
                <p className="text-xs font-semibold text-gray-700 mb-1">{sa.name}</p>
                <p className="text-xs text-gray-400 mb-2">{sa.tools}</p>
                <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: sa.color }}>
                  {sa.persona}
                </span>
              </div>
            ))}
          </div>
          <div className="text-gray-300 text-lg">↓</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { name: 'jira_integration', icon: '📋' },
              { name: 'github_integration', icon: '🐙' },
              { name: 'db_agent', icon: '🗄️' },
              { name: 'metrics_tool', icon: '📊' },
            ].map(u => (
              <div key={u.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200">
                <span className="text-sm">{u.icon}</span>
                <span className="text-xs text-gray-600 font-mono">{u.name}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">Utility Agents (shared across all Super Agents)</p>
        </div>
      </div>
    </div>
  );
}
