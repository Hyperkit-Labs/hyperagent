/**
 * Unit tests: session-store. Session expiry, clear on failure.
 */

import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
  getSessionTimeToExpiry,
  clearSessionOnlyLLMKey,
  getSessionOnlyLLMKey,
  setSessionOnlyLLMKey,
} from "@/lib/session-store";

describe("session-store", () => {
  beforeEach(() => {
    localStorage.clear();
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
  });

  describe("clearStoredSession", () => {
    it("clears stored session", () => {
      setStoredSession("token", 3600);
      clearStoredSession();
      expect(getStoredSession()).toBeNull();
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

  describe("session-only LLM key", () => {
    it("stores and retrieves session-only key", () => {
      setSessionOnlyLLMKey({ provider: "openai", apiKey: "sk-x" });
      expect(getSessionOnlyLLMKey()).toEqual({ provider: "openai", apiKey: "sk-x" });
    });

    it("clears session-only key", () => {
      setSessionOnlyLLMKey({ provider: "openai", apiKey: "sk-x" });
      clearSessionOnlyLLMKey();
      expect(getSessionOnlyLLMKey()).toBeNull();
    });
  });
});
