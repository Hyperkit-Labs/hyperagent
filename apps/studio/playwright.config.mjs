/**
 * Playwright ESM config - use when playwright.config.ts fails with ESM/CJS conflicts.
 * Writable cache/temp dirs for Windows (fixes EPERM under Cursor).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(__dirname, '.playwright-cache');
const tmpDir = path.join(__dirname, '.playwright-tmp');
for (const dir of [cacheDir, tmpDir]) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
}
if (!process.env.PWTEST_CACHE_DIR) process.env.PWTEST_CACHE_DIR = cacheDir;
if (!process.env.TMP) process.env.TMP = tmpDir;
if (!process.env.TEMP) process.env.TEMP = tmpDir;

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PLAYWRIGHT_REAL_SERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
