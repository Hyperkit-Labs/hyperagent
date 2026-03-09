/**
 * useTemplatesData
 *
 * Single batched fetch for Templates page. Replaces two parallel calls
 * (getTemplates, getBlueprints) with one Promise.all.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTemplates, getBlueprints, getErrorMessage } from '@/lib/api';
import type { TemplateItem } from '@/lib/api';

export interface UseTemplatesDataReturn {
  templates: TemplateItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTemplatesData(): UseTemplatesDataReturn {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tArr, bArr] = await Promise.all([
        getTemplates().catch(() => []),
        getBlueprints().catch(() => []),
      ]);
      const t = Array.isArray(tArr) ? tArr : [];
      const b = Array.isArray(bArr) ? bArr : [];
      const byId = new Map<string, TemplateItem>();
      t.forEach((x) => x.id && byId.set(x.id, x as TemplateItem));
      b.forEach((x: { id?: string; name?: string; description?: string }) =>
        x.id && !byId.has(x.id)
          ? byId.set(x.id, { id: x.id, name: x.name, description: x.description })
          : undefined
      );
      setTemplates(Array.from(byId.values()));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load templates'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { templates, loading, error, refetch: fetchAll };
}
