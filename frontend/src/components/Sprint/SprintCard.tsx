import React from 'react';
import clsx from 'clsx';
import { Calendar, Zap } from 'lucide-react';
import type { Sprint } from '../../types';

const statusColor: Record<Sprint['status'], string> = {
  planning: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  review: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-600',
};

interface SprintCardProps {
  sprint: Sprint;
  onActivate?: (id: number) => void;
}

export function SprintCard({ sprint, onActivate }: SprintCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-800">{sprint.name}</h3>
        <span className={clsx('text-xs font-medium px-2.5 py-1 rounded-full', statusColor[sprint.status])}>
          {sprint.status}
        </span>
      </div>
      {sprint.goal && <p className="text-sm text-gray-500 mb-3">{sprint.goal}</p>}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        {sprint.start_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(sprint.start_date).toLocaleDateString()}
          </span>
        )}
        {sprint.velocity != null && (
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-400" />
            {sprint.velocity} pts
          </span>
        )}
      </div>
      {sprint.status === 'planning' && onActivate && (
        <button
          onClick={() => onActivate(sprint.id)}
          className="mt-3 w-full text-sm text-indigo-600 border border-indigo-300 rounded-lg py-1.5 hover:bg-indigo-50 transition-colors"
        >
          Activate Sprint
        </button>
      )}
    </div>
  );
}
