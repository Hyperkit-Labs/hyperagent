import type { NextConfig } from "next";
import { config as dotenvConfig } from 'dotenv';
import path from 'path';

const root = path.resolve(__dirname, '../..');
dotenvConfig({ path: path.join(root, '.env') });
dotenvConfig({ path: path.join(root, process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development') });
dotenvConfig({ path: path.resolve(__dirname, '../.env') });

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = (process.env.NODE_ENV as string) === 'staging';

// Validate required environment variables in production (fail build if missing)
if (isProduction || isStaging) {
  const requiredVars = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_THIRDWEB_CLIENT_ID'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    const msg = `Missing required environment variables in ${process.env.NODE_ENV}: ${missing.join(', ')}. Set them before building or deploying.`;
    if (isProduction) {
      throw new Error(msg);
    }
    console.warn(`Warning: ${msg}`);
  }
}

const nextConfig: NextConfig = {
  // Configure server external packages for Turbopack compatibility
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream', 'pino-abstract-transport', 'sonic-boom'],

  // Faster dev: only bundle used modules from large packages (faster first compile and HMR)
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@headlessui/react',
      '@heroicons/react',
      'framer-motion',
    ],
  },

  typescript: {
    // In production, fail on type errors; in development, allow for faster iteration
    ignoreBuildErrors: !isProduction,
  },
  
  // Force dynamic rendering to avoid SSG issues with pino
  output: 'standalone',
  
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Ensure API calls work correctly
  async rewrites() {
    return [];
  },

  // BYOK: strict CSP to limit XSS impact; only allow connections to gateway and known LLM providers
  async headers() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (isProduction ? '' : 'http://localhost:4000');
    let apiOrigin = '';
    try {
      if (apiUrl && apiUrl.startsWith('http')) apiOrigin = new URL(apiUrl).origin;
      else if (apiUrl) apiOrigin = apiUrl;
    } catch {
      apiOrigin = '';
    }
    const connectSrc = [
      "'self'",
      apiOrigin,
      'https://api.openai.com',
      'https://api.anthropic.com',
      'https://generativelanguage.googleapis.com',
      'https://api.together.xyz',
      'wss:',
      'https://*.thirdweb.com',
      'https://*.supabase.co',
    ].filter(Boolean).join(' ');
    const csp = [
      "default-src 'self'",
      `connect-src ${connectSrc}`,
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },

  // Make environment variables from root .env available to the client
  // Next.js only exposes variables prefixed with NEXT_PUBLIC_ to the browser.
  // Single source of truth: SUPABASE_* are used here so Studio does not duplicate env.
  env: {
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? (isProduction ? '' : 'http://localhost:4000'),
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || (isProduction ? '' : 'ws://localhost:4000'),
    NEXT_PUBLIC_X402_VERIFIER_URL: process.env.NEXT_PUBLIC_X402_VERIFIER_URL || (isProduction ? '' : 'http://localhost:3001'),
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  },
};

export default nextConfig;
