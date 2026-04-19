/**
 * Run the workspace Jest binary with a writable cache dir.
 * On Windows, `jest` on PATH can resolve to a Cursor shim next to Program Files,
 * which makes jest-haste-map try to persist under a non-writable path.
 */
const path = require("path");
const { spawnSync } = require("child_process");

const studioRoot = path.join(__dirname, "..");
const jestBin = require.resolve("jest/bin/jest", { paths: [studioRoot] });

process.env.JEST_CACHE_FOLDER = path.join(studioRoot, ".jest-cache");

const args = [
  jestBin,
  "--config",
  path.join(studioRoot, "jest.config.cjs"),
  ...process.argv.slice(2),
];

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  cwd: studioRoot,
  env: process.env,
});

process.exit(result.status ?? 1);
