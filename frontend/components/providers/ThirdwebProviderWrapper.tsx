'use client';

import { ThirdwebProvider } from 'thirdweb/react';
import { thirdwebClient } from '@/lib/thirdwebClient';

/**
 * Wrapper component for ThirdwebProvider
 * Always provides the provider, passing client only if configured
 * 
 * Note: ThirdwebProvider can work without explicit client prop
 * if NEXT_PUBLIC_THIRDWEB_CLIENT_ID is set in environment
 */
export function ThirdwebProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always provide ThirdwebProvider
  // If client is configured, pass it explicitly
  // Otherwise, provider will use environment variables if available
  if (thirdwebClient) {
    return (
      <ThirdwebProvider client={thirdwebClient}>
        {children}
      </ThirdwebProvider>
    );
  }

  // If client not configured, still provide provider
  // It may work if env var is set at runtime
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}

