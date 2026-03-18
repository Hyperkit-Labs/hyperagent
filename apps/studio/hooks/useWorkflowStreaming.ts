/**
 * useWorkflowStreaming Hook
 * 
 * Custom hook wrapping Vercel AI SDK's useCompletion for workflow code generation streaming.
 * Handles streaming errors, reconnection, timeout/abort, and integrates with existing workflow state.
 */

'use client';

import { useCompletion } from 'ai/react';
import { useMemo, useEffect, useRef, useCallback } from 'react';
import { getStoredSession } from '@/lib/session-store';

export interface UseWorkflowStreamingOptions {
  workflowId: string | null;
  enabled?: boolean;
  timeout?: number;
  abortSignal?: AbortSignal;
  onFinish?: (completion: string) => void;
  onError?: (error: Error) => void;
  onTimeout?: () => void;
}

export interface UseWorkflowStreamingReturn {
  code: string;
  isLoading: boolean;
  error: Error | undefined;
  complete: boolean;
  stop: () => void;
  retry: () => void;
}

export function useWorkflowStreaming(
  options: UseWorkflowStreamingOptions
): UseWorkflowStreamingReturn {
  const { workflowId, enabled = true, timeout, abortSignal, onFinish, onError, onTimeout } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build streaming API URL (use Next.js API route as proxy)
  const apiUrl = useMemo(() => {
    if (!workflowId) return null;
    return `/api/streaming/workflows/${workflowId}/code`;
  }, [workflowId]);

  const streamingFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const session = getStoredSession();
    const headers = new Headers(init?.headers);
    if (session?.access_token?.trim()) {
      headers.set('Authorization', `Bearer ${session.access_token.trim()}`);
    }
    return fetch(input, { ...init, headers });
  }, []);

  // Use Vercel AI SDK's useCompletion hook with auth
  const {
    completion,
    isLoading,
    error,
    complete: completeCompletion,
    stop,
  } = useCompletion({
    api: apiUrl || undefined,
    fetch: streamingFetch,
    streamProtocol: 'data',
    body: abortSignal ? { signal: abortSignal } : undefined,
    onFinish: (completion) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (onFinish) {
        onFinish(completion);
      }
    },
    onError: (error) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      console.error('Workflow streaming error:', error);
      if (onError) {
        onError(error);
      }
    },
  });

  // Handle timeout
  useEffect(() => {
    if (timeout && enabled && apiUrl && isLoading) {
      timeoutRef.current = setTimeout(() => {
        stop();
        if (onTimeout) {
          onTimeout();
        }
        if (onError) {
          onError(new Error(`Streaming timeout after ${timeout}ms`));
        }
      }, timeout);
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }
  }, [timeout, enabled, apiUrl, isLoading, stop, onTimeout, onError]);

  // Handle abort signal
  useEffect(() => {
    if (abortSignal && enabled && apiUrl && isLoading) {
      const handleAbort = () => {
        stop();
        if (onError) {
          onError(new Error('Streaming aborted'));
        }
      };
      abortSignal.addEventListener('abort', handleAbort);
      return () => {
        abortSignal.removeEventListener('abort', handleAbort);
      };
    }
  }, [abortSignal, enabled, apiUrl, isLoading, stop, onError]);

  return {
    code: completion,
    isLoading,
    error: error as Error | undefined,
    complete: !isLoading,
    stop,
    retry: () => { completeCompletion(''); },
  };
}
