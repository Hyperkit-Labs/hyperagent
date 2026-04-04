/**
 * Persists home-page workflow chat draft (prompt + network) across session expiry and retries.
 * Does not store secrets or auth payloads.
 */

const STORAGE_KEY = "hyperagent_home_workflow_draft_v1";

export interface HomeWorkflowDraft {
  input: string;
  networkId: string | null;
  updatedAt: number;
}

export function loadHomeWorkflowDraft(): HomeWorkflowDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HomeWorkflowDraft>;
    if (typeof parsed.input !== "string") return null;
    return {
      input: parsed.input,
      networkId: typeof parsed.networkId === "string" ? parsed.networkId : null,
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveHomeWorkflowDraft(
  draft: Pick<HomeWorkflowDraft, "input" | "networkId">,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: HomeWorkflowDraft = {
      input: draft.input,
      networkId: draft.networkId,
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota or private mode
  }
}

export function clearHomeWorkflowDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
