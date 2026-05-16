#!/usr/bin/env node
/**
 * Verifies security remediation against DATABASE_URL.
 * This tracked copy avoids the ignored repo-root scripts/ directory.
 */

import { config } from "dotenv";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

config({ path: join(root, ".env") });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL.");
  process.exit(1);
}

function useSsl(url) {
  return /supabase\.(com|co)\b/i.test(url) || url.includes("sslmode=require");
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: useSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  await client.connect();
  try {
    const hyperagent = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'hyperagent') AS exists`,
    );
    if (hyperagent.rows[0]?.exists === true) {
      console.error(
        "FAIL: hyperagent schema still exists (expected dropped by 20260409120000)",
      );
      process.exitCode = 1;
      return;
    }
    console.log("OK: no hyperagent schema");

    const fn = await client.query(
      `SELECT p.proname
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('set_updated_at','update_spending_controls_updated_at','update_updated_at_column')
         AND (
           p.proconfig IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM unnest(p.proconfig) AS cfg(cfg) WHERE cfg::text LIKE '%search_path%'
           )
         )`,
    );
    if (fn.rows.length > 0) {
      console.error(
        "FAIL: functions without pinned search_path:",
        fn.rows.map((r) => r.proname).join(", "),
      );
      process.exitCode = 1;
      return;
    }
    console.log("OK: trigger helper search_path pinned (or functions absent)");
    console.log("verify-supabase-security: PASS");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
