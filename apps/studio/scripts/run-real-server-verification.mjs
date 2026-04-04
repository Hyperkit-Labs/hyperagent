/**
 * Real-server verification pass.
 * 1. Check gateway + Studio health (env-driven URLs)
 * 2. Run Playwright E2E without route mocks (auth/session flows)
 * 3. Emit pass/fail report
 *
 * Loads env: repo-root `.env`, then `apps/studio/.env.local` (override).
 * Gateway URL: GATEWAY_BASE_URL, or origin of NEXT_PUBLIC_API_URL, else http://localhost:4000
 * Studio URL: STUDIO_BASE_URL / PLAYWRIGHT_BASE_URL, or if NEXT_PUBLIC_API_URL host is `api.*`,
 *   same scheme + host with `api.` stripped (e.g. api.hyperkitlabs.com → https://hyperkitlabs.com), else http://localhost:3000
 *
 * Env-driven config (supports Coolify-backed: local Studio, remote gateway):
 *   STUDIO_BASE_URL     - Overrides derived/default Studio (use when API host is not api.*)
 *   GATEWAY_BASE_URL    - Backend for health checks (optional if NEXT_PUBLIC_API_URL is set)
 *   ORCHESTRATOR_BASE_URL - Optional; direct orchestrator health if reachable
 *
 * Coolify / prod: NEXT_PUBLIC_API_URL=https://api.your-domain.com/api/v1 sets gateway + Studio (api. → apex) without extra vars.
 *
 * Usage: pnpm run test:e2e:real-server (from repo root or apps/studio)
 */
import { config as loadEnv } from 'dotenv';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const studioRoot = path.join(__dirname, '..');
const repoRoot = path.join(studioRoot, '..', '..');

loadEnv({ path: path.join(repoRoot, '.env'), quiet: true });
loadEnv({ path: path.join(studioRoot, '.env.local'), override: true, quiet: true });

/** @param {string | undefined} apiUrl e.g. http://localhost:4000/api/v1 */
function gatewayOriginFromNextPublicApiUrl(apiUrl) {
  const s = apiUrl?.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.origin;
  } catch {
    return null;
  }
}

/** If API is at https://api.example.com, assume Studio at https://example.com (skip for localhost). */
function studioUrlFromNextPublicApiUrl(apiUrl) {
  const origin = gatewayOriginFromNextPublicApiUrl(apiUrl);
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return null;
    if (u.hostname.startsWith('api.')) {
      u.hostname = u.hostname.slice(4);
      return u.origin;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const STUDIO_BASE_URL =
  process.env.STUDIO_BASE_URL?.trim() ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  studioUrlFromNextPublicApiUrl(process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:3000';
const GATEWAY_BASE_URL =
  process.env.GATEWAY_BASE_URL ||
  process.env.PLAYWRIGHT_GATEWAY_URL ||
  gatewayOriginFromNextPublicApiUrl(process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:4000';

async function fetchOk(url, label, timeoutMs = 15000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
    return res.ok;
  } catch (e) {
    console.error(`[verify] ${label} failed:`, e?.message || e);
    return false;
  }
}

async function main() {
  console.log('[verify] Real-server verification pass (env-driven)');
  console.log('[verify] Studio:', STUDIO_BASE_URL, '| Gateway:', GATEWAY_BASE_URL);

  const gatewayOrigin = GATEWAY_BASE_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  const gatewayOk = await fetchOk(`${gatewayOrigin}/health`, 'Gateway /health');
  const gatewayLive = await fetchOk(`${gatewayOrigin}/health/live`, 'Gateway /health/live');
  const studioTimeoutMs = STUDIO_BASE_URL.startsWith('https://') ? 35000 : 20000;
  const studioOk = await fetchOk(STUDIO_BASE_URL, 'Studio', studioTimeoutMs);

  if (!gatewayOk && !gatewayLive) {
    console.error(
      '[verify] Gateway unreachable at',
      gatewayOrigin + '.',
      'Start the API (make up / docker compose) or set NEXT_PUBLIC_API_URL or GATEWAY_BASE_URL in repo .env — see .env.example (Real-server verification).'
    );
    process.exit(1);
  }
  if (!studioOk) {
    console.error(
      '[verify] Studio unreachable at',
      STUDIO_BASE_URL + '.',
      'Run Next (make run-web, or pnpm dev in apps/studio) or set STUDIO_BASE_URL if it runs elsewhere.'
    );
    process.exit(1);
  }
  console.log('[verify] Gateway and Studio reachable.');

  if (GATEWAY_BASE_URL.startsWith('https://')) {
    console.log('[verify] Coolify-backed mode: ensure .env has NEXT_PUBLIC_API_URL pointing to this gateway.');
  }

  fs.mkdirSync(path.join(studioRoot, '.playwright-cache'), { recursive: true });
  fs.mkdirSync(path.join(studioRoot, '.playwright-tmp'), { recursive: true });

  const env = {
    ...process.env,
    PLAYWRIGHT_REAL_SERVER: '1',
    PLAYWRIGHT_BASE_URL: STUDIO_BASE_URL,
    PWTEST_CACHE_DIR: process.env.PWTEST_CACHE_DIR || path.join(studioRoot, '.playwright-cache'),
    TMP: process.env.TMP || path.join(studioRoot, '.playwright-tmp'),
    TEMP: process.env.TEMP || path.join(studioRoot, '.playwright-tmp'),
  };

  const args = [
    'exec', 'playwright', 'test',
    'e2e/auth-expiry-desync.spec.ts',
    'e2e/auth-redirect.spec.ts',
    'e2e/streaming-request-id.spec.ts',
    '--reporter=list',
  ];

  const child = spawn('pnpm', args, {
    stdio: 'inherit',
    cwd: studioRoot,
    env,
    shell: true,
  });

  return new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      if (code === 0) {
        console.log('[verify] Pass: all real-server E2E tests passed.');
      } else {
        console.error('[verify] Fail: E2E tests exited with code', code ?? signal);
      }
      resolve(code ?? 1);
    });
  }).then((code) => process.exit(code));
}

main().catch((err) => {
  console.error('[verify]', err);
  process.exit(1);
});
