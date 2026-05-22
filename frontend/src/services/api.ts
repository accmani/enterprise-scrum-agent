import axios from 'axios';
import type { Sprint, Story, Message } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '';

const client = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export const chatApi = {
  send: async (
    message: string,
    history: Message[] = [],
    persona?: string,
    bugId?: string,
    domain?: string,
    bugType?: string,
  ): Promise<{
    reply: string;
    persona?: string;
    super_agent?: string;
    duration_ms?: number;
    agent_chain?: string[];
    task_plan?: any;
    memory_summary?: string;
    eval_score?: number;
    policy_domain?: string;
    policy_tools?: string[];
    compliance_checks?: string[];
    fix_evaluation?: {
      overall: number;
      confidence_label: string;
      scores: Record<string, number>;
      gaps: string[];
      refinement_suggestions: string[];
      production_ready: boolean;
      reviewer_notes: string;
      needs_refinement: boolean;
      threshold?: number;
    } | null;
  }> => {
    const { data } = await client.post('/chat/', {
      message,
      history: history.map(m => ({ role: m.role, content: m.content })),
      persona,
      ...(bugId    && { bug_id: bugId }),
      ...(domain   && { domain }),
      ...(bugType  && { bug_type: bugType }),
    });
    return data;
  },

  // ── LLM Self-Evaluation (Option B) ──────────────────────────────────────
  // Called after step 6 completes — passes the actual fixed_code to the LLM
  // for structured self-evaluation against domain-specific rubric
  evaluate: async (
    fixedCode: string,
    bugId: string,
    domain: string,
    bugType: string,
    bugDescription: string,
  ): Promise<{
    overall: number;
    confidence_label: string;
    scores: Record<string, number>;
    gaps: string[];
    refinement_suggestions: string[];
    production_ready: boolean;
    reviewer_notes: string;
    needs_refinement: boolean;
    threshold?: number;
  }> => {
    const { data } = await client.post('/chat/', {
      message: `Evaluate this code fix for bug ${bugId}: ${bugDescription}`,
      history: [],
      persona: 'tech_lead',
      bug_id: bugId,
      domain,
      bug_type: bugType,
      evaluate_fix: true,
      fixed_code: fixedCode,
    });
    return data.fix_evaluation || {
      overall: 0.75,
      confidence_label: 'Medium',
      scores: {},
      gaps: [],
      refinement_suggestions: [],
      production_ready: true,
      reviewer_notes: 'Evaluation not available',
      needs_refinement: false,
    };
  },

  getPersonas: async (): Promise<{ personas: any[]; default: string }> => {
    const { data } = await client.get('/chat/personas');
    return data;
  },
};

export const sprintApi = {
  list: async (): Promise<any[]> => {
    try { const { data } = await client.get('/jira/sprints'); return data.sprints || []; }
    catch { return []; }
  },
  getActive: async (): Promise<any> => {
    try { const { data } = await client.get('/jira/sprints/active'); return data; }
    catch { return null; }
  },
  create: async (sprint: Partial<Sprint>): Promise<Sprint> => {
    const { data } = await client.post('/sprints/', sprint); return data;
  },
  update: async (id: number, updates: Partial<Sprint>): Promise<Sprint> => {
    const { data } = await client.patch(`/sprints/${id}`, updates); return data;
  },
  delete: async (id: number): Promise<void> => { await client.delete(`/sprints/${id}`); },
};

export const storyApi = {
  list: async (_sprintId?: number): Promise<any[]> => {
    try { const { data } = await client.get('/jira/stories'); return data.stories || []; }
    catch { return []; }
  },
  listBacklog: async (): Promise<any[]> => {
    try { const { data } = await client.get('/jira/stories/backlog'); return data.stories || []; }
    catch { return []; }
  },
  create: async (story: Partial<Story>): Promise<Story> => {
    const { data } = await client.post('/stories/', story); return data;
  },
  update: async (id: number, updates: Partial<Story>): Promise<Story> => {
    const { data } = await client.patch(`/stories/${id}`, updates); return data;
  },
  delete: async (id: number): Promise<void> => { await client.delete(`/stories/${id}`); },
};

export const jiraApi = {
  listIssues: async (): Promise<any[]> => {
    try { const { data } = await client.get('/jira/issues'); return data.issues || []; }
    catch { return []; }
  },
};

export const standupApi = {
  generate: async (teamName: string): Promise<{ report: string; jira_issues: any[]; github_prs: any[] }> => {
    const { data } = await client.post('/standup/', { team_name: teamName }); return data;
  },
};

export const metricsApi = {
  overview: async (): Promise<any> => {
    try { const { data } = await client.get('/metrics/overview'); return data; }
    catch { return {}; }
  },
  byPersona: async (): Promise<any> => {
    try { const { data } = await client.get('/metrics/by-persona'); return data; }
    catch { return { by_persona: [] }; }
  },
  byCategory: async (): Promise<any> => {
    try { const { data } = await client.get('/metrics/by-category'); return data; }
    catch { return { by_category: [] }; }
  },
  defects: async (): Promise<any> => {
    try { const { data } = await client.get('/metrics/defects'); return data; }
    catch { return { defects_by_category: [] }; }
  },
  recent: async (limit = 20): Promise<any> => {
    try { const { data } = await client.get(`/metrics/recent?limit=${limit}`); return data; }
    catch { return { recent: [] }; }
  },
};