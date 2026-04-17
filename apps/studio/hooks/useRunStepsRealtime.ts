"use client";

/**
 * Supabase Realtime broadcast subscription for live pipeline step events.
 *
 * Backend publishes to channel `run:{runId}` event `step_update` after each
 * insert_step / update_step call in db.py via the Realtime REST broadcast API
 * (service-role bearer, bypasses RLS).
 *
 * This hook subscribes to that channel so the frontend receives push events
 * without polling. No direct table reads — respects the "no direct Supabase
 * table access from the frontend" invariant.
 *
 * Usage:
 *   const { events, connected } = useRunStepsRealtime(workflowId);
 */

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { AgentDiscussionEvent } from "@/hooks/useAgentDiscussion";

function getRealtimeClient() {
  const url =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "";
  const anon =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : "";
  if (!url || !anon) return null;
  return createClient(url, anon, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

export function useRunStepsRealtime(runId: string | null): {
  events: AgentDiscussionEvent[];
  connected: boolean;
  supported: boolean;
} {
  const [events, setEvents] = useState<AgentDiscussionEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef(getRealtimeClient());

  const supported = Boolean(clientRef.current);

  useEffect(() => {
    const supabase = clientRef.current;
    if (!supabase || !runId) {
      setConnected(false);
      return;
    }

    setEvents([]);

    const channel = supabase
      .channel(`run:${runId}`)
      .on(
        "broadcast",
        { event: "step_update" },
        ({ payload }: { payload: AgentDiscussionEvent }) => {
          setEvents((prev) => [...prev, payload]);
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel).catch(() => void 0);
      channelRef.current = null;
      setConnected(false);
    };
  }, [runId]);

  return { events, connected, supported };
}
