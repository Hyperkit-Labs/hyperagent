'use client';

import { ApiAuthProvider } from '@/components/providers/ApiAuthProvider';
import { ConfigProvider } from '@/components/providers/ConfigProvider';
import { LayoutProvider } from '@/components/providers/LayoutProvider';
import { NetworksProvider } from '@/components/providers/NetworksProvider';
import { SelectedNetworkProvider } from '@/components/providers/SelectedNetworkProvider';
import { PipelineStateProvider } from '@/components/providers/PipelineStateProvider';
import { ThirdwebProviderWrapper } from '@/components/providers/ThirdwebProviderWrapper';
import { WalletAuthProvider } from '@/components/providers/WalletAuthContext';
import { LayoutSwitcher } from '@/components/layout/LayoutSwitcher';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';

/**
 * Single client boundary for all providers. Ensures ThirdwebProvider wraps
 * the entire app so useActiveAccount and other thirdweb hooks work everywhere.
 * WalletAuthProvider exposes sign-in via context so components in portals (e.g. Dialog)
 * can sign in without calling thirdweb hooks directly.
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProviderWrapper>
      <WalletAuthProvider>
      <ConfigProvider>
        <ApiAuthProvider>
          <NetworksProvider>
            <SelectedNetworkProvider>
            <PipelineStateProvider>
              <LayoutProvider>
                <LayoutSwitcher>{children}</LayoutSwitcher>
              </LayoutProvider>
            </PipelineStateProvider>
            </SelectedNetworkProvider>
          </NetworksProvider>
          <Toaster position="top-right" richColors />
          <Analytics />
        </ApiAuthProvider>
      </ConfigProvider>
      </WalletAuthProvider>
    </ThirdwebProviderWrapper>
  );
}
