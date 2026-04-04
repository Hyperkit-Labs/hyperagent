/**
 * Hierarchical query keys for stable invalidation. Extend as you add resources.
 */
export const queryKeys = {
  root: ["hyperagent"] as const,

  workspaces: {
    all: () => [...queryKeys.root, "workspaces"] as const,
    detail: (workspaceId: string) =>
      [...queryKeys.workspaces.all(), workspaceId] as const,
  },

  runs: {
    all: (workspaceId: string) =>
      [...queryKeys.workspaces.detail(workspaceId), "runs"] as const,
    detail: (workspaceId: string, runId: string) =>
      [...queryKeys.runs.all(workspaceId), runId] as const,
  },

  session: {
    current: () => [...queryKeys.root, "session", "current"] as const,
  },

  billing: {
    summary: (workspaceId: string) =>
      [...queryKeys.workspaces.detail(workspaceId), "billing", "summary"] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
