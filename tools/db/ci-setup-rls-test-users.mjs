#!/usr/bin/env node
/**
 * Applies supabase/scripts/ci-rls-test-users.sql using DATABASE_URL.
 * This tracked copy avoids the ignored repo-root scripts/ directory.
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
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

const sqlPath = join(root, "supabase", "scripts", "ci-rls-test-users.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: useSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  await client.connect();
  try {
    await client.query(sql);
    console.log("ci-setup-rls-test-users: ok");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
