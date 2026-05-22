import React, { useEffect, useState } from 'react';
import { sprintApi, storyApi, jiraApi } from '../../services/api';

export function Stats() {
  const [sprints, setSprints] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [jiraIssues, setJiraIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      sprintApi.list(),
      storyApi.list(),
      jiraApi.listIssues(),
    ]).then(([sr, st, jr]) => {
      if (sr.status === 'fulfilled') setSprints(sr.value || []);
      if (st.status === 'fulfilled') setStories(st.value || []);
      if (jr.status === 'fulfilled') setJiraIssues(jr.value || []);
      setLoading(false);
    });
  }, []);

  const activeSprint = sprints.find((s: any) => s.status === 'active');
  const velocitySprints = sprints.filter((s: any) => s.velocity);
  const avgVelocity = velocitySprints.length
    ? Math.round(velocitySprints.reduce((sum: number, s: any) => sum + s.velocity, 0) / velocitySprints.length)
    : 0;
  const donePoints = stories.filter((s: any) => s.status === 'done').reduce((sum: number, s: any) => sum + (s.story_points || 0), 0);
  const totalPoints = stories.reduce((sum: number, s: any) => sum + (s.story_points || 0), 0);

  const jiraDone = jiraIssues.filter(i => i.status === 'Done').length;
  const jiraInProgress = jiraIssues.filter(i => i.status === 'In Progress').length;
  const jiraTodo = jiraIssues.filter(i => i.status === 'To Do').length;

  const statCards = [
    { label: 'Active Sprint', value: activeSprint?.name || 'None', sub: activeSprint?.goal || '', color: 'text-indigo-600' },
    { label: 'Jira Issues', value: jiraIssues.length || '—', sub: `${jiraDone} done · ${jiraInProgress} in progress`, color: 'text-green-600' },
    { label: 'Story Points', value: totalPoints || '—', sub: `${donePoints} completed`, color: 'text-yellow-600' },
    { label: 'Avg Velocity', value: avgVelocity || '—', sub: 'points/sprint', color: 'text-blue-600' },
    { label: 'Total Sprints', value: sprints.length || '—', sub: `${sprints.filter((s: any) => s.status === 'completed').length} completed`, color: 'text-purple-600' },
    { label: 'Total Stories', value: stories.length || jiraIssues.length || '—', sub: 'in backlog', color: 'text-pink-600' },
  ];

  const jiraStatusCounts = jiraIssues.reduce((acc: Record<string, number>, i: any) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) return <div className="p-8 text-center text-gray-400">Loading stats...</div>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Sprint Statistics</h2>
      <p className="text-sm text-gray-400 mb-6">
        {jiraIssues.length > 0 ? `${jiraIssues.length} Jira issues · ${stories.length} internal stories` : 'Internal data only — connect Jira for full stats'}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Jira Issues by Status</h3>
          {Object.keys(jiraStatusCounts).length > 0 ? (
            Object.entries(jiraStatusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3 mb-3">
                <span className="text-sm text-gray-600 w-28">{status}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-indigo-500 h-2 rounded-full"
                    style={{ width: `${((count as number) / jiraIssues.length) * 100}%` }} />
                </div>
                <span className="text-sm font-medium text-gray-700 w-6 text-right">{count as number}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">No Jira data. Check your Jira configuration.</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Sprint Velocity</h3>
          {velocitySprints.length > 0 ? (
            velocitySprints.map((sprint: any) => (
              <div key={sprint.id} className="flex items-center gap-3 mb-3">
                <span className="text-sm text-gray-600 w-20 truncate">{sprint.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${Math.min((sprint.velocity / 50) * 100, 100)}%` }} />
                </div>
                <span className="text-sm font-medium w-8 text-right">{sprint.velocity}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">No velocity data yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
