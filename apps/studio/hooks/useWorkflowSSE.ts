"use client";

import {
  useAgentDiscussion,
  type AgentDiscussionEvent,
} from "@/hooks/useAgentDiscussion";

/**
 * SSE-first workflow progress. Connects to the discussion stream for real-time step events.
 * Use with useWorkflowPolling as fallback when disconnected.
 */
export function useWorkflowSSE(workflowId: string | null) {
  const { events, streaming } = useAgentDiscussion(workflowId);
  return {
    events,
    sseConnected: streaming,
  };
}

export type { AgentDiscussionEvent };
