/**
 * Store for gateway session (our JWT). Supabase Auth is not used for API auth.
 * Persists to localStorage so session survives refresh.
 */

const STORAGE_KEY = "hyperagent_session";
const SESSION_COOKIE_NAME = "hyperagent_has_session";
const SESSION_COOKIE_MAX_AGE_SEC = 86400; // 1 day

function setSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE_NAME}=1; path=/; max-age=${SESSION_COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

export const SESSION_CHANGE_EVENT = "hyperagent_session_change";

/** Fired when BYOK (LLM keys) are saved or removed so onboarding and other UI can refetch. */
export const BYOK_UPDATED_EVENT = "hyperagent_byok_updated";

/** Fired when session-only (pass-through) LLM key is set or cleared. Chat page uses it for X-LLM-* headers. */
export const SESSION_LLM_PASS_THROUGH_UPDATED_EVENT = "hyperagent_session_llm_pass_through_updated";

const SESSION_LLM_PASS_THROUGH_STORAGE_KEY = "hyperagent_llm_pass_through";

export type SessionLLMProvider = "openai" | "google" | "anthropic";

export interface SessionOnlyLLMKey {
  provider: SessionLLMProvider;
  apiKey: string;
}

export function getSessionOnlyLLMKey(): SessionOnlyLLMKey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && "provider" in data && "apiKey" in data) {
      const provider = (data as { provider: string }).provider;
      const apiKey = (data as { apiKey: string }).apiKey;
      if (["openai", "google", "anthropic"].includes(provider) && typeof apiKey === "string" && apiKey.trim()) {
        return { provider: provider as SessionLLMProvider, apiKey: apiKey.trim() };
      }
    }
  } catch {
    sessionStorage.removeItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
  }
  return null;
}

export function setSessionOnlyLLMKey(payload: SessionOnlyLLMKey): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      SESSION_LLM_PASS_THROUGH_STORAGE_KEY,
      JSON.stringify({ provider: payload.provider, apiKey: payload.apiKey })
    );
    window.dispatchEvent(new Event(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

export function clearSessionOnlyLLMKey(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
    window.dispatchEvent(new Event(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

export function notifyByokUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(BYOK_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

function notifySessionChange() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
  } catch {
    // ignore
  }
}

export interface StoredSession {
  access_token: string;
  expires_at: number;
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && "access_token" in data && "expires_at" in data) {
      const token = (data as { access_token: unknown }).access_token;
      const expiresAt = (data as { expires_at: unknown }).expires_at;
      if (typeof token === "string" && typeof expiresAt === "number") {
        if (expiresAt * 1000 <= Date.now()) {
          clearStoredSession();
          return null;
        }
        return { access_token: token, expires_at: expiresAt };
      }
    }
  } catch {
    clearStoredSession();
  }
  return null;
}

export function setStoredSession(access_token: string, expires_in: number): void {
  if (typeof window === "undefined") return;
  const expires_at = Math.floor(Date.now() / 1000) + expires_in;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token, expires_at }));
    setSessionCookie();
    notifySessionChange();
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    clearSessionCookie();
    notifySessionChange();
  } catch {
    // ignore
  }
}
