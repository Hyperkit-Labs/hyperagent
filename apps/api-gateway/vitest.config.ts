import { defineConfig } from "vitest/config";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const dir = dirname(fileURLToPath(import.meta.url));

/**
 * Pin root and cacheDir to this package so Vitest/Vite never writes under the editor install
 * (e.g. C:\\Program Files\\Cursor\\...) which causes EPERM on Windows.
 */
export default defineConfig({
  root: dir,
  cacheDir: resolve(dir, ".vitest-cache"),
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    pool: "forks",
  },
  resolve: {
    alias: {
      "@": resolve(dir, "src"),
    },
  },
});
