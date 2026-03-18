import { useState, useCallback } from 'react';
import { chatApi } from '../services/api';
import type { Message } from '../types';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hello! I\'m your AI Scrum Master. I can help you plan sprints, refine user stories, estimate effort, and answer Agile questions. How can I help today?',
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setError(null);
    try {
      const reply = await chatApi.send(content, messages);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      setError('Failed to get response. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [messages]);

  return { messages, loading, error, sendMessage };
}
