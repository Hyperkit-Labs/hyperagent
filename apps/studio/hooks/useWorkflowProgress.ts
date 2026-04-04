"use client";

import { useWorkflowSSE } from "@/hooks/useWorkflowSSE";
import { useWorkflowPolling } from "@/hooks/useWorkflowPolling";
import { POLLING } from "@/constants/defaults";

/** SSE-first workflow progress: SSE primary, polling fallback when disconnected. */
const SSE_POLL_INTERVAL_MS = POLLING.WORKFLOW_POLL_MS * 3;
const FALLBACK_POLL_INTERVAL_MS = POLLING.WORKFLOW_POLL_MS;

/**
 * Combined workflow progress hook. Uses SSE (discussion stream) as primary for real-time
 * step events; falls back to more frequent polling when SSE is disconnected.
 */
export function useWorkflowProgress(workflowId: string | null) {
  const { events, sseConnected } = useWorkflowSSE(workflowId);
  const pollIntervalMs = sseConnected
    ? SSE_POLL_INTERVAL_MS
    : FALLBACK_POLL_INTERVAL_MS;
  const polling = useWorkflowPolling(workflowId, { pollIntervalMs });

  return {
    ...polling,
    discussionEvents: events,
    sseConnected,
  };
}
