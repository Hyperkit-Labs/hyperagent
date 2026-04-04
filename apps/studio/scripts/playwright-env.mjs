/**
 * Set writable cache/temp dirs before Playwright CLI loads (fixes EPERM under Cursor on Windows
 * when transform cache tries to mkdir under Program Files).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const studioRoot = path.join(__dirname, '..');
const cache = path.join(studioRoot, '.playwright-cache');
const tmp = path.join(studioRoot, '.playwright-tmp');
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });
process.env.PWTEST_CACHE_DIR = process.env.PWTEST_CACHE_DIR || cache;
process.env.TMP = process.env.TMP || tmp;
process.env.TEMP = process.env.TEMP || tmp;

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/playwright-env.mjs exec playwright test [...]');
  process.exit(1);
}

const child = spawn('pnpm', args, {
  stdio: 'inherit',
  cwd: studioRoot,
  env: process.env,
  shell: true,
});
child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
