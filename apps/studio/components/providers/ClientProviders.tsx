"use client";

import dynamic from "next/dynamic";
import { ApiAuthProvider } from "@/components/providers/ApiAuthProvider";
import { ConfigProvider } from "@/components/providers/ConfigProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { LayoutProvider } from "@/components/providers/LayoutProvider";
import { NetworksProvider } from "@/components/providers/NetworksProvider";
import { SelectedNetworkProvider } from "@/components/providers/SelectedNetworkProvider";
import { PipelineStateProvider } from "@/components/providers/PipelineStateProvider";
import { ThirdwebProviderWrapper } from "@/components/providers/ThirdwebProviderWrapper";
import { WalletAuthProvider } from "@/components/providers/WalletAuthContext";
import { StudioErrorBoundary } from "@/components/providers/StudioErrorBoundary";
import { LayoutSwitcher } from "@/components/layout/LayoutSwitcher";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { DatadogRumInit } from "@/components/providers/DatadogRumInit";
import { DatadogRumUserContext } from "@/components/providers/DatadogRumUserContext";

const VercelAnalytics = dynamic(
  () => import("@vercel/analytics/next").then((m) => m.Analytics),
  { ssr: false },
);

/**
 * Single client boundary for all providers. Ensures ThirdwebProvider wraps
 * the entire app so useActiveAccount and other thirdweb hooks work everywhere.
 * SessionProvider: owns session + authenticated bootstrap; 401 clears session and redirects, 503/429 show retry.
 * WalletAuthProvider exposes sign-in via context so components in portals (e.g. Dialog)
 * can sign in without calling thirdweb hooks directly.
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <StudioErrorBoundary>
      <ThirdwebProviderWrapper>
        <WalletAuthProvider>
          <SessionProvider>
            <ConfigProvider>
              <ApiAuthProvider>
                <NetworksProvider>
                  <SelectedNetworkProvider>
                    <PipelineStateProvider>
                      <LayoutProvider>
                        <TooltipProvider delayDuration={300}>
                          <LayoutSwitcher>{children}</LayoutSwitcher>
                        </TooltipProvider>
                      </LayoutProvider>
                    </PipelineStateProvider>
                  </SelectedNetworkProvider>
                </NetworksProvider>
                <Toaster position="top-right" richColors />
                <DatadogRumInit />
                <DatadogRumUserContext />
                <VercelAnalytics />
              </ApiAuthProvider>
            </ConfigProvider>
          </SessionProvider>
        </WalletAuthProvider>
      </ThirdwebProviderWrapper>
    </StudioErrorBoundary>
  );
}
