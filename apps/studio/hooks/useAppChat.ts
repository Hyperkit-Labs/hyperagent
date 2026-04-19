"use client";

import { useChat } from "ai/react";
import { useCallback } from "react";
import { getDatadogRumSessionIdForRequest } from "@/lib/datadogRumSession";
import { getSessionOnlyLLMKey } from "@/lib/session-store";
import { getStoredSession } from "@/lib/session-store";

const DD_RUM_SESSION_HEADER = "x-datadog-rum-session-id";

export interface UseAppChatOptions {
  network?: string;
}

/**
 * Build BYOK + auth headers at the moment of the request (not at render time).
 * Reads directly from sessionStorage and localStorage so the value is always the
 * most recent one, regardless of React state/ref timing.
 */
function buildFreshHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (typeof window !== "undefined") {
    const session = getStoredSession();
    if (session?.access_token?.trim()) {
      headers.Authorization = `Bearer ${session.access_token.trim()}`;
    }

    const key = getSessionOnlyLLMKey();
    if (key?.provider && key?.apiKey?.trim()) {
      headers["X-LLM-Provider"] = key.provider;
      headers["X-LLM-Api-Key"] = key.apiKey.trim();
    }
  }

  return headers;
}

/**
 * Chat hook. Headers are injected at fetch-time from sessionStorage (source of
 * truth), not from React state or refs.  No props needed for accessToken or
 * llmPassThrough; the hook reads them fresh on every request.
 */
export function useAppChat(options: UseAppChatOptions = {}) {
  const { network } = options;

  const chatFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const byokHeaders = buildFreshHeaders();

      const existing: Record<string, string> = {};
      if (init?.headers) {
        new Headers(init.headers).forEach((v, k) => {
          existing[k] = v;
        });
      }

      const merged: Record<string, string> = { ...existing, ...byokHeaders };

      const ddSession = await getDatadogRumSessionIdForRequest();
      if (ddSession) {
        merged[DD_RUM_SESSION_HEADER] = ddSession;
      }

      let nextBody: BodyInit | null | undefined = init?.body;
      if (ddSession && typeof nextBody === "string" && nextBody.length > 0) {
        try {
          const parsed = JSON.parse(nextBody) as Record<string, unknown>;
          parsed.datadogRumSessionId = ddSession;
          nextBody = JSON.stringify(parsed);
        } catch {
          /* keep original body */
        }
      }

      if (process.env.NODE_ENV === "development") {
        console.debug("[useAppChat] sending headers", {
          hasAuth: Boolean(merged.Authorization),
          provider: merged["X-LLM-Provider"] ?? "(none)",
          hasKey: Boolean(merged["X-LLM-Api-Key"]),
        });
      }

      const fetchInit: RequestInit = {
        ...init,
        headers: merged,
      };
      if (typeof nextBody !== "undefined") {
        fetchInit.body = nextBody;
      }

      const res = await fetch(input, fetchInit);

      if (res.ok) return res;

      let message = `Request failed: ${res.status}`;
      try {
        const clone = res.clone();
        const text = await clone.text();
        if (text) {
          try {
            const j = JSON.parse(text) as {
              error?: string;
              message?: string;
              detail?: string;
            };
            const parsed = j?.error || j?.message || j?.detail;
            if (typeof parsed === "string" && parsed.trim())
              message = parsed.trim();
          } catch {
            if (text.trim()) message = text.trim().slice(0, 300);
          }
        }
      } catch {
        // keep default
      }
      throw new Error(message);
    },
    [],
  );

  return useChat({
    api: "/api/chat",
    body: network ? { network } : undefined,
    fetch: chatFetch,
  });
}

export function hasActiveByokKey(): boolean {
  if (typeof window === "undefined") return false;
  const key = getSessionOnlyLLMKey();
  return Boolean(key?.provider && key?.apiKey?.trim());
}
