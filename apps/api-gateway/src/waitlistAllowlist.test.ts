/**
 * waitlistAllowlist: input validation. Wallet addresses must look like real
 * EVM addresses before we burn a Supabase round-trip on them.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetGatewayEnvForTests } from "@hyperagent/config";

async function callAssertWith(walletAddress: string) {
  const { assertBetaAllowlistWallet } = await import("./waitlistAllowlist.js");
  return assertBetaAllowlistWallet(walletAddress);
}

describe("assertBetaAllowlistWallet input validation", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalEnv.BETA_ALLOWLIST_ENFORCED = process.env.BETA_ALLOWLIST_ENFORCED;
    originalEnv.WAITLIST_SUPABASE_URL = process.env.WAITLIST_SUPABASE_URL;
    originalEnv.WAITLIST_SUPABASE_SERVICE_KEY =
      process.env.WAITLIST_SUPABASE_SERVICE_KEY;
    process.env.BETA_ALLOWLIST_ENFORCED = "true";
    process.env.WAITLIST_SUPABASE_URL = "https://example.supabase.co";
    process.env.WAITLIST_SUPABASE_SERVICE_KEY = "test-service-key";
    resetGatewayEnvForTests();
  });

  afterEach(() => {
    process.env.BETA_ALLOWLIST_ENFORCED = originalEnv.BETA_ALLOWLIST_ENFORCED;
    process.env.WAITLIST_SUPABASE_URL = originalEnv.WAITLIST_SUPABASE_URL;
    process.env.WAITLIST_SUPABASE_SERVICE_KEY =
      originalEnv.WAITLIST_SUPABASE_SERVICE_KEY;
    resetGatewayEnvForTests();
  });

  it.each([
    ["empty", ""],
    ["short", "0x1234"],
    ["wrong prefix", "1234567890123456789012345678901234567890ab"],
    ["non-hex chars", "0x" + "Z".repeat(40)],
    ["too long", "0x" + "a".repeat(41)],
    ["too short", "0x" + "a".repeat(39)],
  ])("rejects %s wallet with INVALID_WALLET_ADDRESS", async (_label, addr) => {
    const res = await callAssertWith(addr);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("INVALID_WALLET_ADDRESS");
      expect(res.status).toBe(400);
    }
  });

  it("returns ok:true when allowlist is not enforced regardless of address", async () => {
    process.env.BETA_ALLOWLIST_ENFORCED = "false";
    resetGatewayEnvForTests();
    const res = await callAssertWith("not-an-address");
    expect(res.ok).toBe(true);
  });
});
