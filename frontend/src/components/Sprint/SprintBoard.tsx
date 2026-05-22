import React, { useEffect, useState } from 'react';
import { sprintApi } from '../../services/api';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-300',
  future: 'bg-blue-100 text-blue-800 border-blue-300',
  closed: 'bg-gray-100 text-gray-600 border-gray-300',
};

export function SprintBoard() {
  const [sprints, setSprints] = useState<any[]>([]);
  const [activeSprint, setActiveSprint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [allSprints, active] = await Promise.allSettled([
          sprintApi.list(),
          sprintApi.getActive(),
        ]);
        if (allSprints.status === 'fulfilled') setSprints(allSprints.value || []);
        if (active.status === 'fulfilled') setActiveSprint(active.value);
      } catch {
        setError('Failed to load sprints from Jira.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading sprints from Jira...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  const activeSprintData = activeSprint?.active_sprint;
  const activeIssues = activeSprint?.issues || [];

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Sprints</h2>

      {/* Active Sprint */}
      {activeSprintData && (
        <div className="bg-white rounded-xl border-2 border-green-300 p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700 mr-2">ACTIVE</span>
              <span className="text-lg font-bold text-gray-800">{activeSprintData.name}</span>
            </div>
            <div className="text-xs text-gray-400">
              {activeSprintData.start_date && new Date(activeSprintData.start_date).toLocaleDateString()}
              {activeSprintData.end_date && ` → ${new Date(activeSprintData.end_date).toLocaleDateString()}`}
            </div>
          </div>
          {activeSprintData.goal && (
            <p className="text-sm text-gray-600 mb-4 italic">Goal: {activeSprintData.goal}</p>
          )}
          {activeIssues.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Sprint Issues ({activeIssues.length})</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeIssues.map((issue: any) => (
                  <div key={issue.key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <span className="text-xs font-mono text-indigo-600 w-16 flex-shrink-0">{issue.key}</span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{issue.summary}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      issue.status === 'Done' ? 'bg-green-100 text-green-700' :
                      issue.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{issue.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All Sprints */}
      {sprints.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sprints.map((sprint: any) => (
            <div key={sprint.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-800">{sprint.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full border capitalize ${STATUS_COLORS[sprint.state] || STATUS_COLORS.future}`}>
                  {sprint.state}
                </span>
              </div>
              {sprint.goal && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{sprint.goal}</p>}
              <div className="text-xs text-gray-400">
                {sprint.start_date && <span>{new Date(sprint.start_date).toLocaleDateString()}</span>}
                {sprint.end_date && <span> → {new Date(sprint.end_date).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-lg font-medium text-gray-500 mb-2">No sprints found in Jira</p>
          <p className="text-sm">Ask the Scrum Agent to create a sprint, or create one in Jira directly.</p>
        </div>
      )}
    </div>
  );
}
