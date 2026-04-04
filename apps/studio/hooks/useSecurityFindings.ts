/**
 * useSecurityFindings Hook
 * Fetches security findings from GET /api/v1/security/findings.
 * Scoped by wallet_user_id via X-User-Id from session.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { getSecurityFindings, type SecurityFinding } from "@/lib/api";

export interface UseSecurityFindingsOptions {
  runId?: string;
  limit?: number;
}

export interface UseSecurityFindingsReturn {
  findings: SecurityFinding[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSecurityFindings(
  options?: UseSecurityFindingsOptions,
): UseSecurityFindingsReturn {
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFindings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { findings: data } = await getSecurityFindings({
        run_id: options?.runId,
        limit: options?.limit ?? 100,
      });
      setFindings(data ?? []);
    } catch (e) {
      setFindings([]);
      setError(
        e instanceof Error ? e.message : "Failed to load security findings",
      );
    } finally {
      setLoading(false);
    }
  }, [options?.runId, options?.limit]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  return { findings, loading, error, refetch: fetchFindings };
}
