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
const SESSION_NONCE_KEY = "hyperagent_session_nonce";
const SESSION_LLM_CRYPTO_ITERATIONS = 100000;
const SESSION_LLM_CRYPTO_ALGO = "AES-GCM";

/**
 * Returns true when `window.crypto.subtle` is available (HTTPS or localhost).
 * HTTP on non-localhost origins disables SubtleCrypto in all major browsers.
 */
export function hasCryptoSubtle(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.crypto?.subtle);
  } catch {
    return false;
  }
}

function getOrCreateSessionNonce(): string {
  if (typeof window === "undefined") return "";
  let nonce = sessionStorage.getItem(SESSION_NONCE_KEY);
  if (!nonce) {
    const buf = new Uint8Array(16);
    window.crypto.getRandomValues(buf);
    nonce = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(SESSION_NONCE_KEY, nonce);
  }
  return nonce;
}

function getTimestampBucket(): string {
  return String(Math.floor(Date.now() / (15 * 60 * 1000)));
}

function getJwtSub(): string {
  const session = getStoredSession();
  if (!session?.access_token) return "";
  try {
    const parts = session.access_token.split(".");
    if (parts.length !== 3 || !parts[1]) return "";
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : "";
  } catch {
    return "";
  }
}

async function deriveSessionEntropy(): Promise<Uint8Array> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API not available");
  }
  const sub = getJwtSub();
  const nonce = getOrCreateSessionNonce();
  const bucket = getTimestampBucket();
  const enc = new TextEncoder();
  const raw = enc.encode(`${sub}${nonce}${bucket}`);
  const hash = await window.crypto.subtle.digest("SHA-256", raw.buffer as ArrayBuffer);
  return new Uint8Array(hash);
}

function pbkdf2Salt(salt: Uint8Array): ArrayBuffer {
  return Uint8Array.from(salt).buffer as ArrayBuffer;
}

async function deriveSessionLlmCryptoKey(salt: Uint8Array): Promise<CryptoKey> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API not available");
  }
  const entropy = await deriveSessionEntropy();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    entropy.buffer as ArrayBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: pbkdf2Salt(salt),
      iterations: SESSION_LLM_CRYPTO_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: SESSION_LLM_CRYPTO_ALGO, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptSessionLlmApiKey(plainText: string): Promise<{ cipherText: string; iv: string; salt: string }> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API not available");
  }
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveSessionLlmCryptoKey(salt);
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: SESSION_LLM_CRYPTO_ALGO, iv: iv.buffer as ArrayBuffer },
    key,
    enc.encode(plainText)
  );
  const cipherArray = new Uint8Array(cipherBuffer);
  return {
    cipherText: btoa(String.fromCharCode(...cipherArray)),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

async function decryptSessionLlmApiKey(params: { cipherText: string; iv: string; salt: string }): Promise<string> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API not available");
  }
  const { cipherText, iv, salt } = params;
  const cipherBytes = Uint8Array.from(atob(cipherText), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  const key = await deriveSessionLlmCryptoKey(saltBytes);
  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: SESSION_LLM_CRYPTO_ALGO, iv: ivBytes.buffer as ArrayBuffer },
    key,
    cipherBytes.buffer as ArrayBuffer
  );
  const dec = new TextDecoder();
  return dec.decode(plainBuffer);
}

export type SessionLLMProvider = "openai" | "google" | "anthropic";

export interface SessionOnlyLLMKey {
  provider: SessionLLMProvider;
  apiKey: string;
}

let _decryptedCache: SessionOnlyLLMKey | null = null;

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const entropy = await deriveSessionEntropy();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    entropy.buffer as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: pbkdf2Salt(salt), iterations: 100000, hash: "SHA-256" },
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
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
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
  const ivArr = new Uint8Array(atob(iv).split("").map((c) => c.charCodeAt(0)));
  const cipherArr = new Uint8Array(atob(ciphertext).split("").map((c) => c.charCodeAt(0)));
  const dec = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivArr.buffer as ArrayBuffer },
    key,
    cipherArr.buffer as ArrayBuffer
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

/**
 * Synchronous accessor: returns the cached key if available, or legacy plaintext.
 * For encrypted keys that have not been decrypted yet, returns null.
 * Callers that need encrypted key support should use getSessionOnlyLLMKeyAsync().
 */
export function getSessionOnlyLLMKey(): SessionOnlyLLMKey | null {
  if (typeof window === "undefined") return null;
  if (_decryptedCache) return _decryptedCache;
  try {
    const raw = sessionStorage.getItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && "provider" in data) {
      const rec = data as Record<string, unknown>;
      const provider = rec.provider;
      const apiKeyField = rec.apiKey;
      if (
        typeof provider === "string" &&
        ["openai", "google", "anthropic"].includes(provider)
      ) {
        const ivRaw = rec.iv;
        const saltRaw = rec.salt;
        const isEncrypted =
          typeof apiKeyField === "string" &&
          typeof ivRaw === "string" &&
          typeof saltRaw === "string" &&
          ivRaw &&
          saltRaw;
        if (isEncrypted) {
          // Encrypted key: kick off async decrypt and populate cache for next call.
          void getSessionOnlyLLMKeyAsync();
          return null;
        }
        if (typeof apiKeyField === "string" && apiKeyField.trim()) {
          const result: SessionOnlyLLMKey = { provider: provider as SessionLLMProvider, apiKey: apiKeyField.trim() };
          _decryptedCache = result;
          return result;
        }
      }
    }
  } catch {
    sessionStorage.removeItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
  }
  return null;
}

/**
 * Async accessor: properly decrypts encrypted keys using Web Crypto.
 * Populates _decryptedCache so subsequent sync calls via getSessionOnlyLLMKey() work.
 */
export async function getSessionOnlyLLMKeyAsync(): Promise<SessionOnlyLLMKey | null> {
  if (typeof window === "undefined") return null;
  if (_decryptedCache) return _decryptedCache;
  try {
    const raw = sessionStorage.getItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && "provider" in data) {
      const rec = data as Record<string, unknown>;
      const provider = rec.provider;
      const apiKeyField = rec.apiKey;
      if (
        typeof provider === "string" &&
        ["openai", "google", "anthropic"].includes(provider)
      ) {
        let decryptedApiKey: string | null = null;
        const ivRaw = rec.iv;
        const saltRaw = rec.salt;
        if (
          typeof apiKeyField === "string" &&
          typeof ivRaw === "string" &&
          typeof saltRaw === "string" &&
          ivRaw &&
          saltRaw
        ) {
          try {
            decryptedApiKey = await decryptSessionLlmApiKey({
              cipherText: apiKeyField,
              iv: ivRaw,
              salt: saltRaw,
            });
          } catch {
            decryptedApiKey = null;
          }
        } else if (typeof apiKeyField === "string") {
          decryptedApiKey = apiKeyField;
        }
        if (typeof decryptedApiKey === "string" && decryptedApiKey.trim()) {
          const result: SessionOnlyLLMKey = { provider: provider as SessionLLMProvider, apiKey: decryptedApiKey.trim() };
          _decryptedCache = result;
          return result;
        }
      }
    }
  } catch {
    sessionStorage.removeItem(SESSION_LLM_PASS_THROUGH_STORAGE_KEY);
  }
  return null;
}

export async function setSessionOnlyLLMKey(payload: SessionOnlyLLMKey): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const encrypted = await encryptSessionLlmApiKey(payload.apiKey);
    sessionStorage.setItem(
      SESSION_LLM_PASS_THROUGH_STORAGE_KEY,
      JSON.stringify({
        provider: payload.provider,
        apiKey: encrypted.cipherText,
        iv: encrypted.iv,
        salt: encrypted.salt,
      })
    );
    _decryptedCache = { provider: payload.provider, apiKey: payload.apiKey };
    window.dispatchEvent(new Event(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT));
  } catch (err) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[session-store] setSessionOnlyLLMKey failed:", err);
    }
  }
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

const VALID_BROADCAST_TYPES = new Set(["session_cleared", "session_updated"]);

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!_broadcastChannel) {
    try {
      _broadcastChannel = new BroadcastChannel(SESSION_BROADCAST_CHANNEL);
      _broadcastChannel.onmessage = (event) => {
        const msgType = event.data?.type;
        if (typeof msgType !== "string" || !VALID_BROADCAST_TYPES.has(msgType)) return;
        if (msgType === "session_cleared") {
          _decryptedCache = null;
          localStorage.removeItem(STORAGE_KEY);
          clearSessionCookie();
          window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
        } else if (msgType === "session_updated") {
          window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
        }
      };
    } catch {
      return null;
    }
  }
  return _broadcastChannel;
}

const VISIBILITY_EVICTION_MS = 5 * 60 * 1000;
let _visibilityTimer: ReturnType<typeof setTimeout> | null = null;

function initVisibilityEviction(): void {
  if (typeof document === "undefined") return;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      _visibilityTimer = setTimeout(() => {
        _decryptedCache = null;
      }, VISIBILITY_EVICTION_MS);
    } else {
      if (_visibilityTimer) {
        clearTimeout(_visibilityTimer);
        _visibilityTimer = null;
      }
    }
  });
}

if (typeof window !== "undefined") {
  initVisibilityEviction();
  window.addEventListener(SESSION_CHANGE_EVENT, () => {
    _decryptedCache = null;
  });
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
  _decryptedCache = null;
  try {
    sessionStorage.removeItem(SESSION_NONCE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    clearSessionCookie();
    clearSessionOnlyLLMKey();
    notifySessionChange();
    getBroadcastChannel()?.postMessage({ type: "session_cleared" });
  } catch {
    // ignore
  }
}

/**
 * If localStorage holds a session whose expires_at is in the past, clears it and returns true.
 * Used on mount so expired sessions get toast + redirect without waiting for the next API 401.
 */
export function clearExpiredSessionIfNeeded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || !("expires_at" in data) || !("access_token" in data)) return false;
    const expiresAt = (data as { expires_at: unknown }).expires_at;
    const token = (data as { access_token: unknown }).access_token;
    if (typeof expiresAt !== "number" || typeof token !== "string") return false;
    if (expiresAt * 1000 <= Date.now()) {
      clearStoredSession();
      return true;
    }
  } catch {
    // malformed entries: leave for getStoredSession
  }
  return false;
}
