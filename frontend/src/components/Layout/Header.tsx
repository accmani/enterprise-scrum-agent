import React from 'react';
import { Cpu } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-indigo-700 text-white px-6 py-4 flex items-center gap-3 shadow-md">
      <Cpu className="w-7 h-7 text-yellow-300" />
      <div>
        <h1 className="text-xl font-bold tracking-tight">Agentic AI SDLC</h1>
        <p className="text-xs text-indigo-200">Agentic Intelligence Platform · HCSC / BCBS</p>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.04em' }}>
          Context Engine
        </span>
        <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.04em' }}>
          SDLC Orchestration
        </span>
        <span style={{ fontSize: '10px', background: '#FCD34D', color: '#92400E', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>
          LIVE DEMO
        </span>
      </div>
    </header>
  );
}
