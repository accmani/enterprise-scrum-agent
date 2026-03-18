import { useState, useEffect, useCallback } from 'react';
import { sprintApi } from '../services/api';
import type { Sprint } from '../types';

export function useSprints() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSprints = useCallback(async () => {
    setLoading(true);
    try {
      const data = await sprintApi.list();
      setSprints(data);
    } catch {
      setError('Failed to load sprints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSprints(); }, [fetchSprints]);

  const createSprint = async (sprint: Partial<Sprint>) => {
    const created = await sprintApi.create(sprint);
    setSprints(prev => [created, ...prev]);
    return created;
  };

  const updateSprint = async (id: number, updates: Partial<Sprint>) => {
    const updated = await sprintApi.update(id, updates);
    setSprints(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  };

  return { sprints, loading, error, fetchSprints, createSprint, updateSprint };
}
