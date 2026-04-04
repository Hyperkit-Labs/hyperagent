/**
 * Run Playwright with PLAYWRIGHT_REAL_SERVER=1 so config does not start a second Next dev
 * (Next.js refuses two `next dev` processes in the same app directory).
 *
 * Base URL: set PLAYWRIGHT_BASE_URL or PORT to match your running server. If neither is set,
 * Playwright defaults to http://localhost:3300 (see playwright.config.mjs). Use PORT=3000 if
 * your `next dev` listens on 3000.
 *
 * Usage: node ./scripts/playwright-real-server.mjs playwright test [...]
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const studioRoot = path.join(__dirname, '..');
const rest = process.argv.slice(2);
if (rest.length === 0) {
  console.error(
    'Usage: node ./scripts/playwright-real-server.mjs playwright test [args...]',
  );
  process.exit(1);
}

function probeUrlFromEnv() {
  const base = (process.env.PLAYWRIGHT_BASE_URL || '').trim();
  if (base) return base.replace(/\/$/, '');
  const port = (process.env.PORT || '').trim() || '3300';
  return `http://127.0.0.1:${port}`;
}

async function assertDevServerReachable() {
  const url = probeUrlFromEnv();
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const res = await fetch(url, { signal: ac.signal, redirect: 'manual' });
    clearTimeout(t);
    if (res.status >= 500) {
      console.warn(
        `[playwright-real-server] ${url} returned ${res.status}; continuing.`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[playwright-real-server] Cannot reach ${url} (${msg}).\n` +
        `Start Studio from apps/studio: pnpm dev\n` +
        `If your app uses another port: PORT=3000 pnpm run test:e2e:surfaces:reuse\n` +
        `Or: PLAYWRIGHT_BASE_URL=http://localhost:YOUR_PORT pnpm run test:e2e:surfaces:reuse`,
    );
    process.exit(1);
  }
}

await assertDevServerReachable();

const child = spawn(
  'node',
  [path.join(__dirname, 'playwright-env.mjs'), 'exec', ...rest],
  {
    stdio: 'inherit',
    cwd: studioRoot,
    shell: true,
    env: { ...process.env, PLAYWRIGHT_REAL_SERVER: '1' },
  },
);
child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
