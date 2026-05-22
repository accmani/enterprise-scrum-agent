import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { ChatInterface } from './components/Chat/ChatInterface';
import { SprintBoard } from './components/Sprint/SprintBoard';
import { StoryList } from './components/Story/StoryList';
import { Board } from './components/Board/Board';
import { Standup } from './components/Standup/Standup';
import { Stats } from './components/Stats/Stats';
import { Pipeline } from './components/Pipeline/Pipeline';
import { Demo } from './components/Demo/Demo';
import { MetricsDashboard } from './components/Metrics/MetricsDashboard';
import { AgentHierarchy } from './components/Agents/AgentHierarchy';
import { ContextEngine } from './components/ContextEngine/ContextEngine';
import { AgenticPlanner } from './components/Planner/AgenticPlanner';

export default function App() {
  const [activeTab, setActiveTab] = useState('demo');
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top whenever the user switches tabs
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F9FAFB' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
        <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          {activeTab === 'demo' && <Demo scrollToTop={() => mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })} onTabChange={handleTabChange} />}
          {activeTab === 'pipeline' && <Pipeline />}
          {activeTab === 'context'  && <ContextEngine />}
          {activeTab === 'agents'   && <AgentHierarchy />}
          {activeTab === 'chat'     && <ChatInterface />}
          {activeTab === 'metrics'  && <MetricsDashboard />}
          {activeTab === 'board'    && <Board />}
          {activeTab === 'sprints'  && <SprintBoard />}
          {activeTab === 'stories'  && <StoryList />}
          {activeTab === 'standup'  && <Standup />}
          {activeTab === 'stats'    && <Stats />}
          {activeTab === 'planner'  && <AgenticPlanner />}
        </main>
      </div>
    </div>
  );
}
