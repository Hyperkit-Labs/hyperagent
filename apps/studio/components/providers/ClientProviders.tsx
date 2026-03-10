'use client';

import { ApiAuthProvider } from '@/components/providers/ApiAuthProvider';
import { ConfigProvider } from '@/components/providers/ConfigProvider';
import { LayoutProvider } from '@/components/providers/LayoutProvider';
import { NetworksProvider } from '@/components/providers/NetworksProvider';
import { PipelineStateProvider } from '@/components/providers/PipelineStateProvider';
import { ThirdwebProviderWrapper } from '@/components/providers/ThirdwebProviderWrapper';
import { LayoutSwitcher } from '@/components/layout/LayoutSwitcher';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';

/**
 * Single client boundary for all providers. Ensures ThirdwebProvider wraps
 * the entire app so useActiveAccount and other thirdweb hooks work everywhere.
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProviderWrapper>
      <ConfigProvider>
        <ApiAuthProvider>
          <NetworksProvider>
            <PipelineStateProvider>
              <LayoutProvider>
                <LayoutSwitcher>{children}</LayoutSwitcher>
              </LayoutProvider>
            </PipelineStateProvider>
          </NetworksProvider>
          <Toaster position="top-right" richColors />
          <Analytics />
        </ApiAuthProvider>
      </ConfigProvider>
    </ThirdwebProviderWrapper>
  );
}
