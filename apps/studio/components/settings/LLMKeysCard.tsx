"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Key, Trash2, Loader2 } from "lucide-react";
import {
  getConfiguredLLMProviders,
  setLLMKeys,
  deleteLLMKeys,
  handleApiError,
  isAuthError,
  isByokStorageOrMigrationError,
  BYOK_SAVE_AGAIN_HINT,
} from "@/lib/api";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { useSignInWithWallet } from "@/hooks/useSignInWithWallet";
import { useActiveAccount } from "thirdweb/react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { useSession } from "@/hooks/useSession";
import {
  notifyByokUpdated,
  BYOK_UPDATED_EVENT,
  SESSION_CHANGE_EVENT,
  setSessionOnlyLLMKey,
  clearSessionOnlyLLMKey,
  getSessionOnlyLLMKey,
  SESSION_LLM_PASS_THROUGH_UPDATED_EVENT,
  type SessionLLMProvider,
} from "@/lib/session-store";

const BYOK_PROVIDERS = ["openai", "anthropic", "google", "together"] as const;

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google (Gemini)",
  together: "Together",
};

const PROVIDER_TAGS: Record<string, string> = {
  openai: "Recommended",
  anthropic: "Recommended",
  google: "Fastest",
  together: "",
};

const PROVIDER_KEY_URLS: Record<string, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/apikey",
  together: "https://api.together.xyz/settings/api-keys",
};

const CHAT_PROVIDER_MAP: Record<string, SessionLLMProvider> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
};

type StorageMode = "persisted" | "session";

export function LLMKeysCard() {
  const [configured, setConfigured] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>("persisted");
  const [keys, setKeys] = useState<Record<string, string>>({
    openai: "",
    anthropic: "",
    google: "",
    together: "",
  });
  const [keyValidated, setKeyValidated] = useState<string | null>(null);
  const [sessionOnlyKey, setSessionOnlyKey] = useState<{ provider: string; apiKey: string } | null>(null);
  const account = useActiveAccount();

  useEffect(() => {
    setSessionOnlyKey(getSessionOnlyLLMKey());
  }, []);
  useEffect(() => {
    const onUpdate = () => setSessionOnlyKey(getSessionOnlyLLMKey());
    window.addEventListener(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT, onUpdate);
  }, []);
  const supabase = getSupabaseBrowserClient();
  const { signIn, isLoading: isSigningIn, error: signInError } = useSignInWithWallet();
  const { hasSession } = useSession();

  const isUnauthorized = Boolean(error && isAuthError(error));

  const refetchKeys = useCallback(() => {
    setError(null);
    setLoading(true);
    getConfiguredLLMProviders()
      .then((res) => {
        setError(null);
        setConfigured(res.configured_providers || []);
      })
      .catch((e) => setError(handleApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getConfiguredLLMProviders()
      .then((res) => {
        if (!cancelled) {
          setError(null);
          setConfigured(res.configured_providers || []);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(handleApiError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const prevSessionRef = useRef(hasSession);
  useEffect(() => {
    if (hasSession && !prevSessionRef.current) refetchKeys();
    prevSessionRef.current = hasSession;
  }, [hasSession, refetchKeys]);

  useEffect(() => {
    const onByok = () => refetchKeys();
    const onSession = () => refetchKeys();
    window.addEventListener(BYOK_UPDATED_EVENT, onByok);
    window.addEventListener(SESSION_CHANGE_EVENT, onSession);
    return () => {
      window.removeEventListener(BYOK_UPDATED_EVENT, onByok);
      window.removeEventListener(SESSION_CHANGE_EVENT, onSession);
    };
  }, [refetchKeys]);

  useEffect(() => {
    const onFocus = () => {
      if (hasSession) refetchKeys();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hasSession, refetchKeys]);

  const handleSaveKeys = () => {
    const toSend = Object.fromEntries(
      Object.entries(keys).filter(([, v]) => v && String(v).trim())
    );
    if (Object.keys(toSend).length === 0) return;
    if (!hasSession) {
      setError("Sign in with your wallet before saving LLM keys.");
      return;
    }
    setSaving(true);
    setError(null);
    setLLMKeys(toSend)
      .then((res) => {
        const order: (keyof typeof keys)[] = ["openai", "anthropic", "google"];
        for (const p of order) {
          const value = toSend[p]?.trim();
          if (value) {
            const chatProvider = CHAT_PROVIDER_MAP[p];
            if (chatProvider) {
              setSessionOnlyLLMKey({ provider: chatProvider, apiKey: value });
              break;
            }
          }
        }
        setConfigured(res.configured_providers || []);
        setKeys({ openai: "", anthropic: "", google: "", together: "" });
        notifyByokUpdated();
      })
      .catch((e) => setError(handleApiError(e)))
      .finally(() => setSaving(false));
  };

  const handleRemoveAll = () => {
    if (!hasSession) {
      setError("Sign in with your wallet before removing LLM keys.");
      return;
    }
    setRemoving(true);
    setError(null);
    deleteLLMKeys()
      .then(() => {
        setConfigured([]);
        notifyByokUpdated();
      })
      .catch((e) => setError(handleApiError(e)))
      .finally(() => setRemoving(false));
  };

  const handleUseSessionOnly = () => {
    const order: (keyof typeof keys)[] = ["openai", "anthropic", "google"];
    for (const p of order) {
      const value = keys[p]?.trim();
      if (value) {
        const chatProvider = CHAT_PROVIDER_MAP[p];
        if (chatProvider) {
          setSessionOnlyLLMKey({ provider: chatProvider, apiKey: value });
          setError(null);
        }
        return;
      }
    }
    setError("Enter at least one key (OpenAI, Anthropic, or Google) to use for this session only.");
  };

  const handleClearSessionOnly = () => {
    clearSessionOnlyLLMKey();
  };

  const handleSignInWithWallet = async () => {
    const ok = await signIn();
    if (ok) refetchKeys();
  };

  const looksLikeValidKey = (val: string): boolean => {
    const trimmed = val?.trim() ?? "";
    return trimmed.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
  };

  const handleKeyChange = (provider: string, value: string) => {
    setKeys((prev) => ({ ...prev, [provider]: value }));
    if (looksLikeValidKey(value)) {
      setKeyValidated(provider);
      setTimeout(() => setKeyValidated(null), 2000);
    } else {
      setKeyValidated(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Key className="w-5 h-5 text-[var(--color-text-muted)]" />
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">LLM API keys (BYOK)</h2>
      </div>
      <p className="text-[var(--color-text-tertiary)] text-sm">
        Add API keys to use models in the Build chat. Save keys to store them encrypted on the server, or use for this session only (key sent per request, never stored).
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : (!hasSession && supabase) || (isUnauthorized && supabase) ? (
        <div
          className="rounded-xl border border-[var(--color-semantic-error)]/30 bg-[var(--color-semantic-error)]/10 px-4 py-4 space-y-3"
          role="alert"
        >
          <p className="text-sm text-[var(--color-semantic-error)]">
            Session expired or not signed in. Sign in again to manage LLM keys.
          </p>
          {!account && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Connect your wallet in the header, then sign in with wallet below.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {account && (
              <button
                type="button"
                onClick={handleSignInWithWallet}
                disabled={isSigningIn}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)] disabled:opacity-50"
              >
                {isSigningIn ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isSigningIn ? "Signing in..." : "Sign in with wallet"}
              </button>
            )}
            <button
              type="button"
              onClick={refetchKeys}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-semantic-error)]/50 bg-[var(--color-semantic-error)]/20 text-[var(--color-semantic-error)] text-sm font-medium hover:bg-[var(--color-semantic-error)]/30"
            >
              Retry
            </button>
          </div>
          {signInError && (
            <p className="text-xs text-[var(--color-semantic-error)]">{signInError}</p>
          )}
        </div>
      ) : error ? (
        <div className="space-y-2">
          <ApiErrorBanner error={error} onRetry={refetchKeys} />
          {isByokStorageOrMigrationError(error) && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {BYOK_SAVE_AGAIN_HINT}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">Storage mode</span>
            <div className="inline-flex rounded-full bg-[var(--color-bg-elevated)] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setStorageMode("persisted")}
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  storageMode === "persisted" ? "bg-[var(--color-bg-panel)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                Persisted
              </button>
              <button
                type="button"
                onClick={() => setStorageMode("session")}
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  storageMode === "session" ? "bg-[var(--color-bg-panel)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                Session only
              </button>
            </div>
          </div>

          {configured.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {configured.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]"
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-4 max-w-md">
            {BYOK_PROVIDERS.map((provider) => (
              <div key={provider}>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor={`key-${provider}-card`}
                    className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5"
                  >
                    {PROVIDER_LABELS[provider] ?? provider}
                    {PROVIDER_TAGS[provider] && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary-alpha-20)] text-[var(--color-primary-light)]">
                        {PROVIDER_TAGS[provider]}
                      </span>
                    )}
                  </label>
                  {PROVIDER_KEY_URLS[provider] && (
                    <a
                      href={PROVIDER_KEY_URLS[provider]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[var(--color-primary-light)] hover:underline"
                    >
                      Get API key
                    </a>
                  )}
                </div>
                <div>
                  <input
                    id={`key-${provider}-card`}
                    type="password"
                    value={keys[provider] ?? ""}
                    onChange={(e) => handleKeyChange(provider, e.target.value)}
                    placeholder={configured.includes(provider) ? "Set new key to replace" : "API key"}
                    className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-default)] focus:outline-none"
                    autoComplete="off"
                  />
                  {keyValidated === provider && (
                    <span className="mt-1 block text-[11px] text-emerald-400">Key looks valid</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {sessionOnlyKey && (
            <div className="rounded-lg border border-[var(--color-primary-alpha-20)] bg-[var(--color-primary-alpha-10)] px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--color-text-secondary)]">
                Session-only (pass-through): <span className="font-medium capitalize">{sessionOnlyKey.provider}</span>. Key is not stored on the server.
              </span>
              <button
                type="button"
                onClick={handleClearSessionOnly}
                className="text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                Clear
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-subtle)]">
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Keys are encrypted at rest. Only the last 4 characters are shown.
            </p>
            <div className="flex items-center gap-2">
              {storageMode === "persisted" ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveKeys}
                    disabled={saving || !Object.values(keys).some((v) => v && String(v).trim())}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)] text-white text-xs font-medium shadow-lg shadow-[var(--color-primary)]/40 hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    Save keys
                  </button>
                  {configured.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRemoveAll}
                      disabled={removing}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-panel)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                    >
                      {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Remove all
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleUseSessionOnly}
                  disabled={!Object.keys(CHAT_PROVIDER_MAP).some((p) => keys[p as keyof typeof keys]?.trim())}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)] text-white text-xs font-medium shadow-lg shadow-[var(--color-primary)]/40 hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Use for this session only
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
