import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { StoryCard } from './StoryCard';
import { storyApi } from '../../services/api';
import type { Story } from '../../types';

export function StoryList() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');

  const fetchStories = async () => {
    setLoading(true);
    try {
      setStories(await storyApi.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStories(); }, []);

  const handleCreate = async () => {
    if (!title.trim()) return;
    const story = await storyApi.create({ title });
    setStories(prev => [story, ...prev]);
    setTitle('');
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">User Stories</h2>
        <div className="flex gap-2">
          <button onClick={fetchStories} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Story
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="As a [user], I want to [goal] so that [benefit]"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm">Create</button>
            <button onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      )}

      {loading && <p className="text-center text-gray-400 py-8">Loading stories...</p>}
      {!loading && stories.length === 0 && (
        <p className="text-center text-gray-400 py-8">No stories yet. Ask the Scrum Agent to generate some!</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {stories.map(s => <StoryCard key={s.id} story={s} />)}
      </div>
    </div>
  );
}
