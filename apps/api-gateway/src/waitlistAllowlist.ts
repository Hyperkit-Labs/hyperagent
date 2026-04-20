/**
 * Optional beta allowlist: separate Supabase project with waitlist_entries
 * (see external waitlist schema: status confirmed, email_confirmed true, wallet_address).
 */
import { createClient } from "@supabase/supabase-js";
import { getGatewayEnv } from "@hyperagent/config";
import { log } from "./logger.js";

export type BetaAllowlistResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string };

function normalizeWallet(addr: string): string {
  return addr.trim().toLowerCase();
}

/**
 * When BETA_ALLOWLIST_ENFORCED is true, the wallet must exist on waitlist_entries with
 * status=confirmed and email_confirmed=true (case-insensitive wallet match).
 */
export async function assertBetaAllowlistWallet(
  walletAddress: string,
): Promise<BetaAllowlistResult> {
  const gw = getGatewayEnv();
  if (!gw.waitlist.allowlistEnforced) {
    return { ok: true };
  }

  const url = gw.waitlist.url;
  const key = gw.waitlist.serviceKey;
  if (!url || !key) {
    return {
      ok: false,
      status: 503,
      code: "BETA_ALLOWLIST_MISCONFIGURED",
      message:
        "Beta allowlist is enforced but WAITLIST_SUPABASE_URL or WAITLIST_SUPABASE_SERVICE_KEY is missing.",
    };
  }

  const w = normalizeWallet(walletAddress);
  if (!w.startsWith("0x") || w.length < 10) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_WALLET_ADDRESS",
      message: "Wallet address is invalid.",
    };
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client
    .from("waitlist_entries")
    .select("id")
    .ilike("wallet_address", w)
    .eq("status", "confirmed")
    .eq("email_confirmed", true)
    .maybeSingle();

  if (error) {
    log.error(
      { msg: error.message, code: (error as { code?: string }).code },
      "waitlist allowlist lookup failed",
    );
    return {
      ok: false,
      status: 503,
      code: "WAITLIST_LOOKUP_FAILED",
      message: "Could not verify beta access. Try again later.",
    };
  }

  if (!data?.id) {
    return {
      ok: false,
      status: 403,
      code: "NOT_ON_BETA_ALLOWLIST",
      message:
        "This wallet is not on the confirmed beta allowlist. Complete waitlist confirmation with the same wallet address.",
    };
  }

  return { ok: true };
}
