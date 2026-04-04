import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryKeys } from "./query-keys.js";

/** Invalidate everything under a workspace (runs, billing, etc.). */
export function invalidateWorkspaceTree(
  client: QueryClient,
  workspaceId: string
): Promise<void> {
  return client.invalidateQueries({
    queryKey: queryKeys.workspaces.detail(workspaceId),
  });
}

export function invalidateRuns(
  client: QueryClient,
  workspaceId: string
): Promise<void> {
  return client.invalidateQueries({
    queryKey: queryKeys.runs.all(workspaceId),
  });
}

export function invalidateRun(
  client: QueryClient,
  workspaceId: string,
  runId: string
): Promise<void> {
  return client.invalidateQueries({
    queryKey: queryKeys.runs.detail(workspaceId, runId),
  });
}

export function invalidateSession(client: QueryClient): Promise<void> {
  return client.invalidateQueries({
    queryKey: queryKeys.session.current(),
  });
}

export function invalidateBilling(
  client: QueryClient,
  workspaceId: string
): Promise<void> {
  return client.invalidateQueries({
    queryKey: queryKeys.billing.summary(workspaceId),
  });
}

/**
 * After a mutation, refetch active queries only (avoids global refetch storms).
 */
export function refetchActiveByKey(
  client: QueryClient,
  queryKey: QueryKey
): Promise<void> {
  return client.refetchQueries({ queryKey, type: "active" });
}
