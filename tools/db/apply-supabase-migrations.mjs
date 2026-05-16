#!/usr/bin/env node
/**
 * Apply all SQL files under supabase/migrations/ in filename order against DATABASE_URL.
 *
 * This copy lives outside the ignored repo-root scripts/ directory so CI can
 * execute it from a clean checkout.
 */

import { config } from "dotenv";
import { readdirSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

config({ path: join(root, ".env") });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error(
    "Missing DATABASE_URL. Add Transaction pooler URI to .env or export it in the shell.",
  );
  process.exit(1);
}

const migrationsDir = join(root, "supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No .sql files in", migrationsDir);
  process.exit(1);
}

function useSsl(url) {
  return /supabase\.(com|co)\b/i.test(url) || url.includes("sslmode=require");
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: useSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

function migrationDbHost(url) {
  try {
    const normalized = url.replace(/^postgres(ql)?:/i, "http:");
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

async function main() {
  const host = migrationDbHost(databaseUrl);
  if (host) console.log("Database host:", host);
  await client.connect();
  try {
    console.log("Connected. Applying", files.length, "migration file(s)...");

    for (const name of files) {
      const full = join(migrationsDir, name);
      const sql = readFileSync(full, "utf8");
      process.stdout.write(`  ${name} ... `);
      try {
        await client.query(sql);
        console.log("ok");
      } catch (err) {
        console.log("FAILED");
        console.error(err.message);
        process.exitCode = 1;
        return;
      }
    }

    const check = await client.query(
      `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'wallet_users'
    ) AS ok`,
    );
    const ok = check.rows[0]?.ok === true;
    console.log(
      ok
        ? "\nwallet_users present. Bootstrap should work.\n"
        : "\nwallet_users still missing; check errors above.\n",
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  if (err && err.code === "ENOTFOUND") {
    const host = migrationDbHost(databaseUrl);
    console.error("DNS error (ENOTFOUND): hostname could not be resolved.");
    if (host) console.error("Host:", host);
    console.error(
      [
        "Fix checklist:",
        "1. Supabase Dashboard -> Settings -> Database -> copy Connection string again.",
        "2. If the project is paused, restore it.",
        "3. Prefer the transaction pooler URI if db.<ref>.supabase.co does not resolve.",
        "4. Disable VPN or switch DNS if lookups are blocked.",
        "5. From a terminal: nslookup <host> to confirm DNS.",
      ].join("\n"),
    );
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
