import { useState, useCallback } from 'react';
import { chatApi } from '../services/api';
import type { Message } from '../types';

export function useChat(persona?: string) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hello! I'm your AI Enterprise SDLC Agent. Select a persona in the chat tab to get started — Scrum Master, Tech Lead, QA Lead, Release Manager, or DevOps. How can I help today?",
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
      const result = await chatApi.send(content, messages, persona);
      const reply = result.reply;
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setError('Failed to get response. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [messages, persona]);

  return { messages, loading, error, sendMessage };
}
