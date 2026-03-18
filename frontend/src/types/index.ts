export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Sprint {
  id: number;
  name: string;
  goal?: string;
  status: 'planning' | 'active' | 'review' | 'completed';
  start_date?: string;
  end_date?: string;
  velocity?: number;
}

export interface Story {
  id: number;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  story_points?: number;
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL';
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  assignee?: string;
  sprint_id?: number;
  jira_key?: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}
