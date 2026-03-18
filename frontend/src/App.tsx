import React, { useState } from 'react';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { ChatInterface } from './components/Chat/ChatInterface';
import { SprintBoard } from './components/Sprint/SprintBoard';
import { StoryList } from './components/Story/StoryList';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-auto">
          {activeTab === 'chat' && <ChatInterface />}
          {activeTab === 'sprints' && <SprintBoard />}
          {activeTab === 'stories' && <StoryList />}
        </main>
      </div>
    </div>
  );
}
