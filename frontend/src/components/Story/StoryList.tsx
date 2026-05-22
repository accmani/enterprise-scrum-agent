import React, { useEffect, useState } from 'react';
import { storyApi } from '../../services/api';

const STATUS_COLORS: Record<string, string> = {
  'To Do': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  'In Review': 'bg-purple-100 text-purple-700',
  'Done': 'bg-green-100 text-green-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  Highest: 'text-red-600',
  High: 'text-orange-500',
  Medium: 'text-yellow-600',
  Low: 'text-blue-500',
  Lowest: 'text-gray-400',
};

export function StoryList() {
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const data = await storyApi.list();
      setStories(data || []);
    } catch {
      setError('Failed to load stories from Jira.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all'
    ? stories
    : stories.filter((s: any) => s.status === filter);

  const statuses = ['all', ...Array.from(new Set(stories.map((s: any) => s.status)))];

  if (loading) return <div className="p-8 text-center text-gray-400">Loading stories from Jira...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">User Stories</h2>
          <p className="text-sm text-gray-400 mt-1">{stories.length} issues from Jira project {import.meta.env.VITE_JIRA_PROJECT || 'KAN'}</p>
        </div>
        <button
          onClick={load}
          className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          title="Refresh from Jira"
        >
          🔄
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {statuses.map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              filter === status
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? `All (${stories.length})` : `${status} (${stories.filter((s: any) => s.status === status).length})`}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((story: any) => (
            <div key={story.key} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-mono text-indigo-600 font-medium">{story.key}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[story.status] || 'bg-gray-100 text-gray-600'}`}>
                  {story.status}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-800 leading-snug mb-3">{story.title}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {story.story_points && (
                  <span className="font-semibold text-indigo-600">{story.story_points} pts</span>
                )}
                {story.priority && (
                  <span className={`font-medium ${PRIORITY_COLORS[story.priority] || 'text-gray-400'}`}>
                    {story.priority}
                  </span>
                )}
                {story.assignee && story.assignee !== 'Unassigned' && (
                  <span className="flex items-center gap-1">
                    👤 {story.assignee.split(' ')[0]}
                  </span>
                )}
                {story.type && (
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">{story.type}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-lg font-medium text-gray-500 mb-2">No stories found</p>
          <p className="text-sm">Ask the Scrum Agent to create stories, or add them in Jira directly.</p>
        </div>
      )}
    </div>
  );
}
