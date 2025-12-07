'use client';

import { useState, useEffect } from 'react';
import { getWorkflow } from '@/lib/api';
import type { Workflow } from '@/lib/types';

export function useWorkflow(workflowId: string | null, pollInterval = 2000) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workflowId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    const fetchWorkflow = async () => {
      try {
        const data = await getWorkflow(workflowId);
        if (isMounted) {
          setWorkflow(data);
          setError(null);
          
          // Stop polling if workflow is completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch workflow');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchWorkflow();

    // Poll for updates if workflow is still active
    if (workflow?.status !== 'completed' && workflow?.status !== 'failed') {
      intervalId = setInterval(fetchWorkflow, pollInterval);
    }

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [workflowId, pollInterval]);

  return { workflow, loading, error };
}

