"use client";

import { useState, useEffect } from "react";
import { getWorkflow } from "@/lib/api";
import type { Workflow } from "@/lib/types";

const INITIAL_FETCH_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Request timed out. Workflow may not exist or the server is slow.",
            ),
          ),
        ms,
      ),
    ),
  ]);
}

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
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchWorkflow = () => {
      getWorkflow(workflowId)
        .then((data) => {
          if (!isMounted) return;
          setWorkflow(data);
          setError(null);
          if (["completed", "failed", "cancelled"].includes(data.status)) {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        })
        .catch((err: unknown) => {
          if (!isMounted) return;
          const msg =
            err instanceof Error ? err.message : "Failed to fetch workflow";
          const ref =
            err && typeof err === "object" && "requestId" in err
              ? (err as { requestId?: string }).requestId
              : undefined;
          setError(ref ? `${msg} Reference: ${ref}` : msg);
        });
    };

    const initialFetch = withTimeout(
      getWorkflow(workflowId),
      INITIAL_FETCH_TIMEOUT_MS,
    );

    initialFetch
      .then((data) => {
        if (!isMounted) return;
        setWorkflow(data);
        setError(null);
        if (!["completed", "failed", "cancelled"].includes(data.status)) {
          intervalId = setInterval(fetchWorkflow, pollInterval);
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg =
          err instanceof Error ? err.message : "Failed to fetch workflow";
        const ref =
          err && typeof err === "object" && "requestId" in err
            ? (err as { requestId?: string }).requestId
            : undefined;
        setError(ref ? `${msg} Reference: ${ref}` : msg);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [workflowId, pollInterval]);

  const refetch = async () => {
    if (!workflowId) return;
    try {
      const data = await getWorkflow(workflowId);
      setWorkflow(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch workflow");
    }
  };

  return { workflow, loading, error, refetch };
}
