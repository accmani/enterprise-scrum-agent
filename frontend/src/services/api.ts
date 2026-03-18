import axios from 'axios';
import type { Sprint, Story, Message } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export const chatApi = {
  send: async (message: string, history: Message[] = []): Promise<string> => {
    const { data } = await client.post('/chat/', {
      message,
      history: history.map(m => ({ role: m.role, content: m.content })),
    });
    return data.reply;
  },
};

export const sprintApi = {
  list: async (): Promise<Sprint[]> => {
    const { data } = await client.get('/sprints/');
    return data.sprints;
  },
  create: async (sprint: Partial<Sprint>): Promise<Sprint> => {
    const { data } = await client.post('/sprints/', sprint);
    return data;
  },
  update: async (id: number, updates: Partial<Sprint>): Promise<Sprint> => {
    const { data } = await client.patch(`/sprints/${id}`, updates);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await client.delete(`/sprints/${id}`);
  },
};

export const storyApi = {
  list: async (sprintId?: number): Promise<Story[]> => {
    const params = sprintId ? { sprint_id: sprintId } : {};
    const { data } = await client.get('/stories/', { params });
    return data.stories;
  },
  create: async (story: Partial<Story>): Promise<Story> => {
    const { data } = await client.post('/stories/', story);
    return data;
  },
  update: async (id: number, updates: Partial<Story>): Promise<Story> => {
    const { data } = await client.patch(`/stories/${id}`, updates);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await client.delete(`/stories/${id}`);
  },
};
