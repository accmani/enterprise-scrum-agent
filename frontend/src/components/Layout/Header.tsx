import React from 'react';
import { Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-indigo-700 text-white px-6 py-4 flex items-center gap-3 shadow-md">
      <Zap className="w-7 h-7 text-yellow-300" />
      <div>
        <h1 className="text-xl font-bold tracking-tight">Enterprise Scrum Agent</h1>
        <p className="text-xs text-indigo-200">AI-powered Agile management</p>
      </div>
    </header>
  );
}
