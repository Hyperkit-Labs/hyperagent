/**
 * Supabase browser client — configuration check only.
 *
 * INVARIANT: The frontend MUST NOT query Supabase tables directly.
 * All user data access goes through the API gateway (service_role on backend).
 * RLS denies all anon/authenticated access; only service_role policies exist.
 *
 * This client exists solely so UI code (e.g. LLMKeysCard) can check whether
 * Supabase is configured. It must never call .from(), .rpc(), or .storage.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "";
const anon =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : "";

let client: SupabaseClient | null = null;

/**
 * Returns a Supabase client for configuration checks only (truthiness test).
 * Do NOT use .from(), .rpc(), or .storage — RLS will deny all access.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!url || !anon) return null;
  if (!client) {
    client = createClient(url, anon);
  }
  return client;
}

/**
 * Returns true when Supabase env vars are set (preferred over creating a client).
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anon);
}
