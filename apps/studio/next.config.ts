import type { NextConfig } from "next";
import { config as dotenvConfig } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ESM-safe: Jest/next compile next.config to ESM where `__dirname` is undefined.
const configDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(configDir, "../..");

// Vercel injects env before `next build`; loading repo `.env` / `.env.production` here can overwrite
// dashboard values if those files exist in the clone (e.g. CI artifact) or if tooling merges env oddly.
// Skip file-based dotenv on Vercel unless explicitly opted in (local `vercel build` debugging).
const isVercelBuild = Boolean(process.env.VERCEL);
const loadRepoDotenv =
  !isVercelBuild || process.env.ALLOW_REPO_DOTENV_ON_VERCEL === "1";

if (loadRepoDotenv) {
  dotenvConfig({ path: path.join(root, ".env") });
  dotenvConfig({
    path: path.join(
      root,
      process.env.NODE_ENV === "production"
        ? ".env.production"
        : ".env.development",
    ),
  });
  dotenvConfig({ path: path.join(configDir, ".env") });
}

const isProduction = process.env.NODE_ENV === "production";
const isStaging = (process.env.NODE_ENV as string) === "staging";

const assetPrefixRaw = process.env.NEXT_PUBLIC_ASSET_PREFIX?.trim() ?? "";
const assetPrefix =
  assetPrefixRaw.length > 0 ? assetPrefixRaw.replace(/\/$/, "") : undefined;

// Guard fires on ANY production build (Vercel, CI, Docker, local next build).
// The earlier guard was Vercel-only, which meant a local/CI `next build` with a
// localhost value loaded from repo `.env` would silently bundle that address.
function assertNextPublicApiUrlSafeForProduction(): void {
  if (!isProduction) return;
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return;
  let u: URL;
  try {
    u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return;
  }
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]") {
    const where = isVercelBuild
      ? "Vercel production"
      : "production build (CI / Docker / local next build)";
    throw new Error(
      `NEXT_PUBLIC_API_URL must not be loopback in ${where}. ` +
        "Remove the localhost value from your repo .env file and set the " +
        "correct URL for the target environment, then redeploy without build cache.",
    );
  }
}
assertNextPublicApiUrlSafeForProduction();

// Validate required environment variables in production (fail build if missing)
if (isProduction || isStaging) {
  const requiredVars = [
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_THIRDWEB_CLIENT_ID",
  ];
  const missing = requiredVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    const msg = `Missing required environment variables in ${process.env.NODE_ENV}: ${missing.join(", ")}. Set them before building or deploying.`;
    if (isProduction) {
      throw new Error(msg);
    }
    console.warn(`Warning: ${msg}`);
  }
}

const nextConfig: NextConfig = {
  ...(assetPrefix ? { assetPrefix } : {}),

  // Datadog tracer + Vercel AI SDK: keep Node-native / instrumented deps out of the server bundle.
  serverExternalPackages: ["dd-trace", "ai"],

  // MSW (tests) pulls in pure-ESM packages; Next/Jest only transpiles listed packages.
  transpilePackages: ["msw", "until-async"],

  // Faster dev: only bundle used modules from large packages (faster first compile and HMR)
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@headlessui/react",
      "@heroicons/react",
      "framer-motion",
      "@tanstack/react-query",
      "sonner",
      "@ai-sdk/react",
    ],
  },

  typescript: {
    // In production, fail on type errors; in development, allow for faster iteration
    ignoreBuildErrors: !isProduction,
  },

  // Force dynamic rendering for the current Studio runtime path.
  output: "standalone",

  // Production optimizations
  compress: true,
  poweredByHeader: false,

  // Ensure API calls work correctly
  async rewrites() {
    return [];
  },

  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // thirdweb pulls pino's optional pretty-printer through walletconnect logging.
      // Studio never uses that server-only formatter in the browser/runtime bundle.
      "pino-pretty": false,
    };
    return config;
  },

  // CSP and connect-src live in proxy.ts (Edge, per-request nonce). Keep lightweight headers here
  // for routes that skip the proxy matcher (e.g. some static assets).
  async headers() {
    // CSP is set per-request in proxy.ts (nonce + strict-dynamic). A static CSP here
    // duplicated the policy and broke script execution when it disagreed with the middleware nonce.
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },

  // Make environment variables from root .env available to the client
  // Next.js only exposes variables prefixed with NEXT_PUBLIC_ to the browser.
  // Single source of truth: SUPABASE_* are used here so Studio does not duplicate env.
  env: {
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID:
      process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
    // Never bundle a localhost value in production. If the env var is not set
    // or resolves to a loopback string (e.g. loaded from repo .env), default to
    // empty string so the required-var check above fails fast with a clear message.
    NEXT_PUBLIC_API_URL: isProduction
      ? (() => {
          const v = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
          try {
            const h = new URL(
              v.startsWith("http") ? v : `https://${v}`,
            ).hostname.toLowerCase();
            if (
              h === "localhost" ||
              h === "127.0.0.1" ||
              h === "::1" ||
              h === "[::1]"
            )
              return "";
          } catch {
            // non-parseable → fall through and let required-var check handle it
          }
          return v;
        })()
      : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"),
    NEXT_PUBLIC_X402_VERIFIER_URL: isProduction
      ? (process.env.NEXT_PUBLIC_X402_VERIFIER_URL?.trim() ?? "")
      : process.env.NEXT_PUBLIC_X402_VERIFIER_URL || "http://localhost:3001",
    NEXT_PUBLIC_ENV:
      process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || "development",
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "",
    NEXT_PUBLIC_DD_RUM_APPLICATION_ID:
      process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID ?? "",
    NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN:
      process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN ?? "",
    NEXT_PUBLIC_DD_SITE: process.env.NEXT_PUBLIC_DD_SITE ?? "us5.datadoghq.com",
    NEXT_PUBLIC_DD_SERVICE_NAME:
      process.env.NEXT_PUBLIC_DD_SERVICE_NAME ?? "hyperagent-studio",
    NEXT_PUBLIC_DD_ENV: process.env.NEXT_PUBLIC_DD_ENV ?? "",
    NEXT_PUBLIC_DD_VERSION: process.env.NEXT_PUBLIC_DD_VERSION ?? "",
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? "",
    NEXT_PUBLIC_DD_SESSION_SAMPLE_RATE:
      process.env.NEXT_PUBLIC_DD_SESSION_SAMPLE_RATE ?? "",
    NEXT_PUBLIC_DD_SESSION_REPLAY_SAMPLE_RATE:
      process.env.NEXT_PUBLIC_DD_SESSION_REPLAY_SAMPLE_RATE ?? "",
    NEXT_PUBLIC_DD_RUM_DEBUG: process.env.NEXT_PUBLIC_DD_RUM_DEBUG ?? "",
  },
};

export default nextConfig;
