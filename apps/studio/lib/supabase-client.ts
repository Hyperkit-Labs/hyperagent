/**
 * Supabase browser client (DB / storage). Created when NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are set. API auth uses the session store (our JWT), not Supabase Auth.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "";
const anon = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : "";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!url || !anon) return null;
  if (!client) {
    client = createClient(url, anon);
  }
  return client;
}
