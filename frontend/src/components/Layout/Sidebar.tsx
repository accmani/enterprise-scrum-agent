import React from 'react';
import { MessageSquare, Layers, BookOpen } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'chat', label: 'Scrum Chat', icon: MessageSquare },
  { id: 'sprints', label: 'Sprints', icon: Layers },
  { id: 'stories', label: 'Stories', icon: BookOpen },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <nav className="w-56 bg-gray-900 text-white flex flex-col py-4 gap-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={clsx(
            'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg mx-2 transition-colors',
            activeTab === id
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          )}
        >
          <Icon className="w-5 h-5" />
          {label}
        </button>
      ))}
    </nav>
  );
}
