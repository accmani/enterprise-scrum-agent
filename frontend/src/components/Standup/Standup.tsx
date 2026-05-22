import React, { useState } from 'react';
import { standupApi } from '../../services/api';

export function Standup() {
  const [teamName, setTeamName] = useState('Engineering');
  const [report, setReport] = useState('');
  const [jiraIssues, setJiraIssues] = useState<any[]>([]);
  const [githubPrs, setGithubPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await standupApi.generate(teamName);
      setReport(data.report);
      setJiraIssues(data.jira_issues || []);
      setGithubPrs(data.github_prs || []);
    } catch (e: any) {
      setError(`Failed to generate standup report: ${e.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(report);
  };

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Standup Report</h2>
      <p className="text-sm text-gray-400 mb-6">Pulls live data from Jira and GitHub to generate today's standup</p>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">Team Name</label>
        <div className="flex gap-3">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="e.g. Engineering, Platform, Mobile"
          />
          <button
            onClick={generate}
            disabled={loading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generating...' : '⚡ Generate Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {report && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Today's Standup</span>
              <button onClick={copyToClipboard} className="text-xs text-indigo-600 hover:underline">
                Copy to clipboard
              </button>
            </div>
            <pre className="p-4 text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
              {report}
            </pre>
          </div>

          <div className="space-y-4">
            {jiraIssues.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Jira Issues ({jiraIssues.length})
                </h3>
                <div className="space-y-2">
                  {jiraIssues.slice(0, 8).map(issue => (
                    <div key={issue.key} className="text-xs">
                      <span className="font-mono text-indigo-600">{issue.key}</span>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                        issue.status === 'Done' ? 'bg-green-100 text-green-700' :
                        issue.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{issue.status}</span>
                      <p className="text-gray-600 mt-0.5 truncate">{issue.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {githubPrs.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Open PRs ({githubPrs.length})
                </h3>
                <div className="space-y-2">
                  {githubPrs.map(pr => (
                    <div key={pr.number} className="text-xs">
                      <a href={pr.url} target="_blank" rel="noreferrer"
                        className="text-indigo-600 hover:underline font-mono">
                        #{pr.number}
                      </a>
                      <p className="text-gray-600 mt-0.5 truncate">{pr.title}</p>
                      <p className="text-gray-400">@{pr.author}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="text-center text-gray-400 py-16">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-lg font-medium text-gray-500 mb-2">Ready to generate your standup</p>
          <p className="text-sm">Pulls active sprint items from Jira and open PRs from GitHub</p>
        </div>
      )}
    </div>
  );
}
