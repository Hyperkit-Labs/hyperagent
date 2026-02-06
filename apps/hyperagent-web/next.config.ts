import type { NextConfig } from "next";
import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// Load environment variables from root .env file
// This makes the root .env the single source of truth for the entire monorepo
dotenvConfig({ path: path.resolve(__dirname, '../.env') });

const nextConfig: NextConfig = {
  /* config options here */
  // Configure server external packages for Turbopack compatibility
  // These packages will not be bundled and will be treated as external modules
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream', 'pino-abstract-transport', 'sonic-boom'],
  typescript: {
    ignoreBuildErrors: true,
  },
  // Force dynamic rendering to avoid SSG issues with pino
  output: 'standalone',
  // Ensure API calls work correctly
  async rewrites() {
    return [];
  },
  // Make environment variables from root .env available to the client
  // Next.js only exposes variables prefixed with NEXT_PUBLIC_ to the browser
  env: {
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
    NEXT_PUBLIC_X402_VERIFIER_URL: process.env.NEXT_PUBLIC_X402_VERIFIER_URL || 'http://localhost:3001',
  },
};

export default nextConfig;
