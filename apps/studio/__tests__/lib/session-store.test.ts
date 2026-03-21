/**
 * Unit tests: session-store. Session expiry, clear, LLM key encryption/decryption.
 */

import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
  getSessionTimeToExpiry,
  clearSessionOnlyLLMKey,
  getSessionOnlyLLMKey,
  getSessionOnlyLLMKeyAsync,
  setSessionOnlyLLMKey,
} from "@/lib/session-store";

describe("session-store", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearSessionOnlyLLMKey();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
  });

  describe("getStoredSession / setStoredSession", () => {
    it("returns null when no session", () => {
      expect(getStoredSession()).toBeNull();
    });

    it("stores and retrieves session", () => {
      setStoredSession("token-123", 3600);
      const s = getStoredSession();
      expect(s).not.toBeNull();
      expect(s?.access_token).toBe("token-123");
      expect(typeof s?.expires_at).toBe("number");
    });

    it("returns null when session expired", () => {
      const expiresAt = Math.floor(Date.now() / 1000) - 10;
      localStorage.setItem(
        "hyperagent_session",
        JSON.stringify({ access_token: "x", expires_at: expiresAt })
      );
      expect(getStoredSession()).toBeNull();
    });

    it("clears invalid JSON", () => {
      localStorage.setItem("hyperagent_session", "invalid");
      expect(getStoredSession()).toBeNull();
    });

    it("sets session cookies", () => {
      setStoredSession("tok", 3600);
      expect(document.cookie).toContain("hyperagent_has_session=1");
      expect(document.cookie).toContain("hyperagent_session_token=tok");
    });
  });

  describe("clearStoredSession", () => {
    it("clears stored session and cookies", () => {
      setStoredSession("token", 3600);
      clearStoredSession();
      expect(getStoredSession()).toBeNull();
      expect(document.cookie).not.toContain("hyperagent_has_session=1");
    });
  });

  describe("getSessionTimeToExpiry", () => {
    it("returns 0 when no session", () => {
      expect(getSessionTimeToExpiry()).toBe(0);
    });

    it("returns positive seconds when session valid", () => {
      setStoredSession("token", 3600);
      const ttl = getSessionTimeToExpiry();
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600);
    });
  });

  describe("session-only LLM key (encrypted)", () => {
    it("stores encrypted and retrieves via async", async () => {
      await setSessionOnlyLLMKey({ provider: "openai", apiKey: "sk-test-123" });
      const result = await getSessionOnlyLLMKeyAsync();
      expect(result).not.toBeNull();
      expect(result?.provider).toBe("openai");
      expect(result?.apiKey).toBe("sk-test-123");
    });

    it("sync getter returns from cache after async populate", async () => {
      await setSessionOnlyLLMKey({ provider: "anthropic", apiKey: "sk-ant-456" });
      // setSessionOnlyLLMKey populates _decryptedCache
      const syncResult = getSessionOnlyLLMKey();
      expect(syncResult).not.toBeNull();
      expect(syncResult?.provider).toBe("anthropic");
      expect(syncResult?.apiKey).toBe("sk-ant-456");
    });

    it("stores data as encrypted (not plaintext) in sessionStorage", async () => {
      await setSessionOnlyLLMKey({ provider: "openai", apiKey: "sk-secret" });
      const raw = sessionStorage.getItem("hyperagent_llm_pass_through");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.iv).toBeDefined();
      expect(parsed.salt).toBeDefined();
      expect(parsed.apiKey).not.toBe("sk-secret");
    });

    it("clears session-only key and cache", async () => {
      await setSessionOnlyLLMKey({ provider: "openai", apiKey: "sk-x" });
      clearSessionOnlyLLMKey();
      expect(getSessionOnlyLLMKey()).toBeNull();
      expect(await getSessionOnlyLLMKeyAsync()).toBeNull();
    });

    it("handles legacy plaintext gracefully", () => {
      sessionStorage.setItem(
        "hyperagent_llm_pass_through",
        JSON.stringify({ provider: "google", apiKey: "legacy-plain" })
      );
      const result = getSessionOnlyLLMKey();
      expect(result).not.toBeNull();
      expect(result?.provider).toBe("google");
      expect(result?.apiKey).toBe("legacy-plain");
    });
  });
});
