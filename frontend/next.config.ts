import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Configure server external packages for Turbopack compatibility
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
  // Ensure API calls work correctly
  async rewrites() {
    return [];
  },
};

export default nextConfig;
