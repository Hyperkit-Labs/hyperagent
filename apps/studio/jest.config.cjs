/* CommonJS Jest config: use .cjs so ESLint (no-require-imports) does not apply. */
const path = require("path");
const { loadEnvConfig } = require("@next/env");

const studioDir = __dirname;
const monorepoRoot = path.join(studioDir, "../..");

// Match next/jest: load root .env files for tests (NEXT_PUBLIC_* used in config tests).
loadEnvConfig(monorepoRoot);

const nextPkgDir = path.dirname(require.resolve("next/package.json"));
// Keep in sync with next.config.ts `transpilePackages` (ESM deps that Jest must compile).
const transpiled = ["msw", "until-async"].join("|");
const transpiledPathRegex = transpiled.replace(/\//g, "[\\\\/]");

/** @type {import("jest").Config} */
module.exports = {
  rootDir: studioDir,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  // `next build` can leave `.next/standalone/**/package.json` with the same `name` as this app,
  // which triggers haste-map collisions and pollutes module resolution.
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  watchPathIgnorePatterns: ["<rootDir>/.next/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@hyperagent/config$": "<rootDir>/../../packages/config/dist/index.js",
    "^react$": "<rootDir>/node_modules/react",
    "^react-dom$": "<rootDir>/node_modules/react-dom",
    "^react/jsx-runtime$": "<rootDir>/node_modules/react/jsx-runtime.js",
    "^react/jsx-dev-runtime$":
      "<rootDir>/node_modules/react/jsx-dev-runtime.js",
    "^.+\\.module\\.(css|sass|scss)$": path.join(
      nextPkgDir,
      "dist/build/jest/object-proxy.js",
    ),
    "^.+\\.(css|sass|scss)$": path.join(
      nextPkgDir,
      "dist/build/jest/__mocks__/styleMock.js",
    ),
    "^.+\\.(png|jpg|jpeg|gif|webp|avif|ico|bmp)$": path.join(
      nextPkgDir,
      "dist/build/jest/__mocks__/fileMock.js",
    ),
    "^.+\\.(svg)$": path.join(
      nextPkgDir,
      "dist/build/jest/__mocks__/fileMock.js",
    ),
    "@next/font/(.*)": path.join(
      nextPkgDir,
      "dist/build/jest/__mocks__/nextFontMock.js",
    ),
    "next/font/(.*)": path.join(
      nextPkgDir,
      "dist/build/jest/__mocks__/nextFontMock.js",
    ),
    "^server-only$": path.join(
      nextPkgDir,
      "dist/build/jest/__mocks__/empty.js",
    ),
  },
  transform: {
    "^.+\\.(js|jsx|ts|tsx|mjs)$": ["babel-jest", { presets: ["next/babel"] }],
  },
  transformIgnorePatterns: [
    `/node_modules/(?!.pnpm)(?!(${transpiled})/)`,
    `/node_modules[\\\\/]\\.pnpm[\\\\/](?!(${transpiled.replace(/\//g, "\\+")})@)(?!.*node_modules[\\\\/](${transpiledPathRegex})[\\\\/])`,
    "^.+\\.module\\.(css|sass|scss)$",
  ],
  collectCoverageFrom: [
    "app/**/*.{js,jsx,ts,tsx}",
    "components/**/*.{js,jsx,ts,tsx}",
    "lib/**/*.{js,jsx,ts,tsx}",
    "hooks/**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/.next/**",
  ],
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/tests/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
  passWithNoTests: true,
};
