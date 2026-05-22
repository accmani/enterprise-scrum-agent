import React, { useEffect, useState } from 'react';
import { jiraApi } from '../../services/api';

const COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];

const STATUS_COLORS: Record<string, string> = {
  'To Do': 'bg-gray-100 border-gray-300',
  'In Progress': 'bg-yellow-50 border-yellow-300',
  'Review': 'bg-blue-50 border-blue-300',
  'Done': 'bg-green-50 border-green-300',
};

interface Issue {
  key: string;
  summary: string;
  status: string;
  assignee: string;
}

export function Board() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    jiraApi.listIssues()
      .then(setIssues)
      .catch(() => setError('Failed to load Jira issues. Check your Jira configuration.'))
      .finally(() => setLoading(false));
  }, []);

  const getIssuesForColumn = (col: string) =>
    issues.filter(i => i.status.toLowerCase().includes(col.toLowerCase()) ||
      (col === 'To Do' && i.status.toLowerCase() === 'to do') ||
      (col === 'In Progress' && i.status.toLowerCase().includes('progress')) ||
      (col === 'Review' && (i.status.toLowerCase().includes('review') || i.status.toLowerCase().includes('testing'))) ||
      (col === 'Done' && i.status.toLowerCase() === 'done')
    );

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading Jira board...</div>
  );

  if (error) return (
    <div className="p-8 text-center text-red-500">{error}</div>
  );

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Kanban Board</h2>
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map(col => (
          <div key={col} className="flex flex-col">
            <div className={`rounded-t-lg px-3 py-2 border-b-2 font-semibold text-sm ${STATUS_COLORS[col]}`}>
              {col}
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({getIssuesForColumn(col).length})
              </span>
            </div>
            <div className={`flex-1 rounded-b-lg border p-2 min-h-64 space-y-2 ${STATUS_COLORS[col]}`}>
              {getIssuesForColumn(col).map(issue => (
                <div
                  key={issue.key}
                  className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <p className="text-xs font-mono text-indigo-600 mb-1">{issue.key}</p>
                  <p className="text-sm text-gray-800 leading-snug">{issue.summary}</p>
                  {issue.assignee && issue.assignee !== 'Unassigned' && (
                    <p className="text-xs text-gray-400 mt-2">👤 {issue.assignee}</p>
                  )}
                </div>
              ))}
              {getIssuesForColumn(col).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No items</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
