import React, { useState } from 'react';
import { chatApi } from '../../services/api';

type HistoryItem = { role: 'user' | 'assistant'; content: string; id: string; timestamp: Date };

const PIPELINE_STAGES = [
  {
    id: 'planning',
    label: 'Planning',
    icon: '📋',
    color: 'bg-purple-100 border-purple-300 text-purple-800',
    activeColor: 'bg-purple-600 text-white border-purple-600',
    agent: 'sprint_manager',
    prompts: [
      'Create a new sprint for Q2 release',
      'List all active sprints',
      'What is our average velocity?',
    ],
  },
  {
    id: 'requirements',
    label: 'Requirements',
    icon: '📝',
    color: 'bg-blue-100 border-blue-300 text-blue-800',
    activeColor: 'bg-blue-600 text-white border-blue-600',
    agent: 'story_manager',
    prompts: [
      'Generate user stories for a payment gateway',
      'List all backlog stories',
      'Split this story into smaller tasks',
    ],
  },
  {
    id: 'design',
    label: 'Design',
    icon: '🎨',
    color: 'bg-teal-100 border-teal-300 text-teal-800',
    activeColor: 'bg-teal-600 text-white border-teal-600',
    agent: 'design_agent',
    prompts: [
      'Design the API for user authentication',
      'Create a data model for claims processing',
      'Suggest architecture for a microservices migration',
    ],
  },
  {
    id: 'development',
    label: 'Development',
    icon: '💻',
    color: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    activeColor: 'bg-yellow-600 text-white border-yellow-600',
    agent: 'github_integration',
    prompts: [
      'List open GitHub issues',
      'Show me open pull requests',
      'Review the latest PR',
    ],
  },
  {
    id: 'qa',
    label: 'QA / Testing',
    icon: '🧪',
    color: 'bg-orange-100 border-orange-300 text-orange-800',
    activeColor: 'bg-orange-600 text-white border-orange-600',
    agent: 'qa_agent',
    prompts: [
      'Generate test cases for user login via SSO',
      'Create BDD scenarios for payment processing',
      'What edge cases should we test for claim adjudication?',
    ],
  },
  {
    id: 'deployment',
    label: 'Deployment',
    icon: '🚀',
    color: 'bg-green-100 border-green-300 text-green-800',
    activeColor: 'bg-green-600 text-white border-green-600',
    agent: 'release_agent',
    prompts: [
      'Generate release notes for v1.0.0',
      'What is included in this release?',
      'Create a changelog from recent PRs',
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: '📊',
    color: 'bg-red-100 border-red-300 text-red-800',
    activeColor: 'bg-red-600 text-white border-red-600',
    agent: 'retro_agent',
    prompts: [
      'Run our sprint retrospective',
      'Generate today\'s standup report',
      'What went well this sprint?',
    ],
  },
];

export function Pipeline() {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const runPrompt = async (prompt: string) => {
    setActivePrompt(prompt);
    setLoading(true);
    setLoadingSeconds(0);
    setResponse(null);

    const timer = setInterval(() => setLoadingSeconds(s => s + 1), 1000);

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 90 seconds')), 90000)
      );
      const result = await Promise.race([chatApi.send(prompt, history), timeoutPromise]);
      setResponse(result.reply);
      setHistory(prev => [
        ...prev,
        { role: 'user' as const, content: prompt, id: Date.now().toString(), timestamp: new Date() },
        { role: 'assistant' as const, content: result.reply, id: (Date.now() + 1).toString(), timestamp: new Date() },
      ]);
    } catch (e: any) {
      setResponse(`Error: ${e.message || 'Failed to get response. Is the backend running?'}`);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  const activeStageData = PIPELINE_STAGES.find(s => s.id === activeStage);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-1">SDLC Pipeline</h2>
      <p className="text-sm text-gray-400 mb-6">Click a phase to interact with its AI agent</p>

      {/* Pipeline visualization */}
      <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage, idx) => (
          <React.Fragment key={stage.id}>
            <button
              onClick={() => {
                setActiveStage(stage.id);
                setResponse(null);
                setActivePrompt(null);
              }}
              className={`flex flex-col items-center px-4 py-3 rounded-xl border-2 min-w-[110px] transition-all ${
                activeStage === stage.id ? stage.activeColor : stage.color
              } hover:scale-105`}
            >
              <span className="text-2xl mb-1">{stage.icon}</span>
              <span className="text-xs font-semibold text-center leading-tight">{stage.label}</span>
            </button>
            {idx < PIPELINE_STAGES.length - 1 && (
              <div className="text-gray-300 text-xl px-1 flex-shrink-0">→</div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Stage interaction panel */}
      {activeStageData && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{activeStageData.icon}</span>
              <div>
                <h3 className="font-semibold text-gray-800">{activeStageData.label} Agent</h3>
                <p className="text-xs text-gray-400 font-mono">{activeStageData.agent}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">Quick actions for this phase:</p>
            <div className="space-y-2">
              {activeStageData.prompts.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => runPrompt(prompt)}
                  disabled={loading}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                    activePrompt === prompt
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-700'
                  } disabled:opacity-50`}
                >
                  {loading && activePrompt === prompt ? '⏳ ' : '▶ '}
                  {prompt}
                </button>
              ))}
            </div>

            {/* Custom prompt */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Or type your own:</p>
              <div className="flex gap-2">
                <input
                  id="custom-prompt"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={`Ask the ${activeStageData.label} agent...`}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        runPrompt(val);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('custom-prompt') as HTMLInputElement;
                    if (input?.value.trim()) {
                      runPrompt(input.value.trim());
                      input.value = '';
                    }
                  }}
                  disabled={loading}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Response panel */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Agent Response</h3>
            {loading && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Agent is thinking... ({loadingSeconds}s)</span>
                </div>
                <p className="text-xs text-gray-400">
                  {loadingSeconds < 10 ? 'Starting up...' :
                   loadingSeconds < 30 ? 'Calling tools...' :
                   loadingSeconds < 60 ? 'Processing response...' :
                   'Taking longer than usual, please wait...'}
                </p>
                <button
                  onClick={() => { setLoading(false); setResponse('Request cancelled.'); }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
            {response && !loading && (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {response}
                </pre>
              </div>
            )}
            {!response && !loading && (
              <div className="text-center text-gray-300 py-12">
                <p className="text-4xl mb-3">🤖</p>
                <p className="text-sm">Click a quick action or type a prompt to interact with the {activeStageData.label} agent</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!activeStage && (
        <div className="text-center text-gray-400 py-12">
          <p className="text-5xl mb-4">🔄</p>
          <p className="text-lg font-medium text-gray-500 mb-2">Select a phase to get started</p>
          <p className="text-sm">Each phase has a dedicated AI agent to help you through that part of the SDLC</p>
        </div>
      )}
    </div>
  );
}
