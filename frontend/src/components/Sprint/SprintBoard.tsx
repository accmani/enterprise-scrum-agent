import React, { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { SprintCard } from './SprintCard';
import { useSprints } from '../../hooks/useSprints';

export function SprintBoard() {
  const { sprints, loading, error, fetchSprints, createSprint, updateSprint } = useSprints();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createSprint({ name, goal });
    setName('');
    setGoal('');
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Sprints</h2>
        <div className="flex gap-2">
          <button onClick={fetchSprints} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Sprint
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <h3 className="font-medium text-gray-700 mb-3">Create Sprint</h3>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Sprint name (e.g. Sprint 5)"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Sprint goal"
            rows={2}
            value={goal}
            onChange={e => setGoal(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700">Create</button>
            <button onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      )}

      {loading && <p className="text-center text-gray-400 py-8">Loading sprints...</p>}
      {error && <p className="text-center text-red-500 py-4">{error}</p>}
      {!loading && sprints.length === 0 && (
        <p className="text-center text-gray-400 py-8">No sprints yet. Create your first sprint!</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sprints.map(s => (
          <SprintCard
            key={s.id}
            sprint={s}
            onActivate={id => updateSprint(id, { status: 'active' })}
          />
        ))}
      </div>
    </div>
  );
}
