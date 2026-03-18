/**
 * Store for gateway session (our JWT). Supabase Auth is not used for API auth.
 * Persists to localStorage so session survives refresh.
 */

const STORAGE_KEY = "hyperagent_session";
const SESSION_COOKIE_NAME = "hyperagent_has_session";
/** Unix timestamp (seconds) when session expires. Middleware uses this for expiry-aware checks. */
export const SESSION_EXPIRES_COOKIE_NAME = "hyperagent_session_expires";

const SESSION_TOKEN_COOKIE_NAME = "hyperagent_session_token";

function setSessionCookie(maxAgeSec: number, accessToken?: string) {
  if (typeof document === "undefined") return;
  const expiresAt = Math.floor(Date.now() / 1000) + maxAgeSec;
  const secure = typeof location !== "undefined" && location?.protocol === "https:";
  const secureAttr = secure ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE_NAME}=1; path=/; max-age=${maxAgeSec}; SameSite=Lax${secureAttr}`;
  document.cookie = `${SESSION_EXPIRES_COOKIE_NAME}=${expiresAt}; path=/; max-age=${maxAgeSec}; SameSite=Lax${secureAttr}`;
  // Carry the raw JWT so middleware can inspect exp without needing localStorage.
  if (accessToken) {
    document.cookie = `${SESSION_TOKEN_COOKIE_NAME}=${accessToken}; path=/; max-age=${maxAgeSec}; SameSite=Lax${secureAttr}`;
  }
}

function clearSessionCookie() {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location?.protocol === "https:";
  const secureAttr = secure ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${secureAttr}`;
  document.cookie = `${SESSION_EXPIRES_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${secureAttr}`;
  document.cookie = `${SESSION_TOKEN_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${secureAttr}`;
}

export const SESSION_CHANGE_EVENT = "hyperagent_session_change";

/** Fired when BYOK (LLM keys) are saved or removed so onboarding and other UI can refetch. */
export const BYOK_UPDATED_EVENT = "hyperagent_byok_updated";

/** Fired when session-only (pass-through) LLM key is set or cleared. Chat page uses it for X-LLM-* headers. */
export const SESSION_LLM_PASS_THROUGH_UPDATED_EVENT = "hyperagent_session_llm_pass_through_updated";

const SESSION_LLM_PASS_THROUGH_STORAGE_KEY = "hyperagent_llm_pass_through";
const ENCRYPTION_PASSPHRASE = "hyperagent-session-llm-v1";

export type SessionLLMProvider = "openai" | "google" | "anthropic";

export interface SessionOnlyLLMKey {
  provider: SessionLLMProvider;
  apiKey: string;
}

let _decryptedCache: SessionOnlyLLMKey | null = null;

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(ENCRYPTION_PASSPHRASE),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(plaintext: string): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

async function decrypt(ciphertext: string, iv: string, salt: string): Promise<string> {
  const key = await deriveKey(
    new Uint8Array(atob(salt).split("").map((c) => c.charCodeAt(0)))
  );
  const dec = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(atob(iv).split("").map((c) => c.charCodeAt(0))) },
    key,
    new Uint8Array(atob(ciphertext).split("").map((c) => c.charCodeAt(0)))
  );
  return new TextDecoder().decode(dec);
}

function notifySessionLLMUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

export function getSessionOnlyLLMKey(): SessionOnlyLLMKey | null {
  if (typeof window === "undefined") return null;
  if (_decryptedCache) return _decryptedCache;
  try {
    const raw = sessionStorage.getItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && "provider" in data) {
      const provider = (data as { provider: string }).provider;
      if (!["openai", "google", "anthropic"].includes(provider)) return null;
      const stored = data as { provider: string; apiKey?: string; iv?: string; salt?: string };
      if (typeof stored.apiKey === "string" && stored.iv && stored.salt) {
        decrypt(stored.apiKey, stored.iv, stored.salt)
          .then((apiKey) => {
            if (apiKey.trim()) {
              _decryptedCache = { provider: provider as SessionLLMProvider, apiKey: apiKey.trim() };
              notifySessionLLMUpdated();
            }
          })
          .catch(() => {
            sessionStorage.removeItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
            _decryptedCache = null;
          });
        return null;
      }
      if (typeof stored.apiKey === "string" && stored.apiKey.trim()) {
        sessionStorage.removeItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
        return { provider: provider as SessionLLMProvider, apiKey: stored.apiKey.trim() };
      }
    }
  } catch {
    sessionStorage.removeItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
  }
  return null;
}

export function setSessionOnlyLLMKey(payload: SessionOnlyLLMKey): void {
  if (typeof window === "undefined") return;
  _decryptedCache = payload;
  encrypt(payload.apiKey)
    .then(({ ciphertext, iv, salt }) => {
      sessionStorage.setItem(
        SESSION_LLM_PASS_THROUGH_STORAGE_KEY,
        JSON.stringify({ provider: payload.provider, apiKey: ciphertext, iv, salt })
      );
      notifySessionLLMUpdated();
    })
    .catch(() => {
      sessionStorage.removeItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
    });
}

export function clearSessionOnlyLLMKey(): void {
  if (typeof window === "undefined") return;
  _decryptedCache = null;
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

const SESSION_BROADCAST_CHANNEL = "hyperagent_session_sync";
let _broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!_broadcastChannel) {
    try {
      _broadcastChannel = new BroadcastChannel(SESSION_BROADCAST_CHANNEL);
      _broadcastChannel.onmessage = (event) => {
        if (event.data?.type === "session_cleared") {
          localStorage.removeItem(STORAGE_KEY);
          clearSessionCookie();
          window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
        } else if (event.data?.type === "session_updated") {
          window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
        }
      };
    } catch {
      return null;
    }
  }
  return _broadcastChannel;
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
    // Pass the token so middleware can verify exp from cookie without localStorage.
    setSessionCookie(expires_in, access_token);
    notifySessionChange();
    getBroadcastChannel()?.postMessage({ type: "session_updated" });
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Seconds until the stored session expires. Returns 0 if no session or already expired.
 * Used by ApiAuthProvider to schedule proactive redirect before expiry.
 */
export function getSessionTimeToExpiry(): number {
  const session = getStoredSession();
  if (!session) return 0;
  const remaining = session.expires_at - Math.floor(Date.now() / 1000);
  return remaining > 0 ? remaining : 0;
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    clearSessionCookie();
    notifySessionChange();
    getBroadcastChannel()?.postMessage({ type: "session_cleared" });
  } catch {
    // ignore
  }
}
