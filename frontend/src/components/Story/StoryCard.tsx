import React from 'react';
import clsx from 'clsx';
import { User, Hash } from 'lucide-react';
import type { Story } from '../../types';

const statusColor: Record<Story['status'], string> = {
  backlog: 'bg-gray-100 text-gray-600',
  todo: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
};

const sizeColor: Record<string, string> = {
  XS: 'text-green-600',
  S: 'text-green-500',
  M: 'text-yellow-600',
  L: 'text-orange-600',
  XL: 'text-red-600',
};

interface StoryCardProps {
  story: Story;
}

export function StoryCard({ story }: StoryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-800 leading-snug">{story.title}</p>
        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', statusColor[story.status])}>
          {story.status.replace('_', ' ')}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400 mt-3">
        {story.story_points != null && (
          <span className="flex items-center gap-1 font-semibold text-indigo-600">
            {story.story_points} pts
          </span>
        )}
        {story.size && (
          <span className={clsx('font-bold', sizeColor[story.size])}>{story.size}</span>
        )}
        {story.assignee && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />{story.assignee}
          </span>
        )}
        {story.jira_key && (
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />{story.jira_key}
          </span>
        )}
      </div>
    </div>
  );
}
