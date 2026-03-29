import { mkdirSync } from "fs";
import { defineConfig } from "vitest/config";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const dir = dirname(fileURLToPath(import.meta.url));
const tempDir = resolve(dir, ".vitest-temp");
try {
  mkdirSync(tempDir, { recursive: true });
} catch {
  /* ignore */
}
process.env.TEMP = tempDir;
process.env.TMP = tempDir;
process.env.TMPDIR = tempDir;

/**
 * Pin root and cacheDir to this package. Vitest <2.2 ignored cacheDir when the dependency
 * optimizer ran and tried to mkdir next to Cursor's bundled Node (EPERM under Program Files).
 * Use vitest ^3.2.x (see package.json) so optimizer respects cacheDir (vitest#6910).
 * TEMP/TMPDIR above steer any stray mkdir away from Program Files on Windows.
 */
export default defineConfig({
  root: dir,
  cacheDir: resolve(dir, ".vitest-cache"),
  publicDir: false,
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    pool: "forks",
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@": resolve(dir, "src"),
    },
  },
});
