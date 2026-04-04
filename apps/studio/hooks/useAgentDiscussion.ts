"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAgentDiscussionStreamUrl } from "@/lib/api";
import { getStoredSession } from "@/lib/session-store";

export interface AgentDiscussionEvent {
  stage?: string;
  message?: string;
  status?: string;
  done?: boolean;
  [key: string]: unknown;
}

export function useAgentDiscussion(workflowId: string | null) {
  const [events, setEvents] = useState<AgentDiscussionEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!workflowId) return;

    const session = getStoredSession();
    const token = session?.access_token;
    const baseUrl = getAgentDiscussionStreamUrl(workflowId);
    const url = `${baseUrl}?token=${encodeURIComponent(token || "")}`;

    if (
      process.env.NODE_ENV === "development" &&
      typeof window !== "undefined" &&
      "console" in window
    ) {
      console.log("[ZSPS] Connecting to Discussion Stream:", baseUrl);
    }

    const es = new EventSource(url, { withCredentials: true });

    es.onopen = () => {
      if (
        process.env.NODE_ENV === "development" &&
        typeof window !== "undefined" &&
        "console" in window
      ) {
        console.log("[ZSPS] Discussion Stream Connected.");
      }
    };

    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as AgentDiscussionEvent;
        setEvents((prev) => [...prev, data]);
        if (data.done) {
          es.close();
          setStreaming(false);
        }
      } catch {
        // ignore malformed payloads
      }
    };

    es.onerror = () => {
      if (
        process.env.NODE_ENV === "development" &&
        typeof window !== "undefined" &&
        "console" in window
      ) {
        console.error(
          "[ZSPS] Discussion Stream Auth Failure or connection closed",
        );
      }
      es.close();
      setStreaming(false);
    };

    eventSourceRef.current = es;
    setStreaming(true);
  }, [workflowId]);

  useEffect(() => {
    if (workflowId) {
      setEvents([]);
      connect();
    }
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [workflowId, connect]);

  return { events, streaming };
}
