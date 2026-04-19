"use client";

/**
 * Live pipeline event stream.
 *
 * Transport priority:
 *   1. Supabase Realtime broadcast (push-based, ~0ms latency, no polling)
 *      Requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.
 *   2. SSE / EventSource fallback when Realtime is unavailable or connection fails.
 *      The backend SSE endpoint polls Supabase every 250ms internally.
 */

import { useState, useEffect, useRef } from "react";
import { getAgentDiscussionStreamUrl } from "@/lib/api";
import { getStoredSession } from "@/lib/session-store";
import { useRunStepsRealtime } from "@/hooks/useRunStepsRealtime";

export interface AgentDiscussionEvent {
  stage?: string;
  message?: string;
  status?: string;
  done?: boolean;
  [key: string]: unknown;
}

function useSSEDiscussion(workflowId: string | null, enabled: boolean) {
  const [events, setEvents] = useState<AgentDiscussionEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!workflowId || !enabled) {
      setStreaming(false);
      return;
    }

    setEvents([]);

    const session = getStoredSession();
    const token = session?.access_token;
    const baseUrl = getAgentDiscussionStreamUrl(workflowId);
    const url = `${baseUrl}?token=${encodeURIComponent(token || "")}`;

    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;
    setStreaming(true);

    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as AgentDiscussionEvent;
        setEvents((prev) => [...prev, data]);
        if (data.done) {
          es.close();
          eventSourceRef.current = null;
          setStreaming(false);
        }
      } catch {
        // ignore malformed payloads
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setStreaming(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setStreaming(false);
    };
  }, [workflowId, enabled]);

  return { events, streaming };
}

export function useAgentDiscussion(workflowId: string | null) {
  const {
    events: rtEvents,
    connected: rtConnected,
    supported: rtSupported,
  } = useRunStepsRealtime(workflowId);

  // SSE is only used when Realtime is unavailable or disconnected.
  const useSse = !rtSupported || (!rtConnected && rtSupported);
  const { events: sseEvents, streaming: sseStreaming } = useSSEDiscussion(
    workflowId,
    useSse,
  );

  const events = rtSupported && rtConnected ? rtEvents : sseEvents;
  const streaming = rtSupported ? rtConnected : sseStreaming;

  return { events, streaming };
}
