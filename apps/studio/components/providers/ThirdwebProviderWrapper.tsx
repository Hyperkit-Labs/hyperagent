"use client";

import { ThirdwebProvider, AutoConnect } from "thirdweb/react";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import {
  CONNECT_WALLETS,
  ACCOUNT_ABSTRACTION_CONFIG,
} from "@/lib/connectWallets";
import { useAutoBootstrap } from "@/hooks/useAutoBootstrap";

function AutoBootstrapGate({ children }: { children: React.ReactNode }) {
  useAutoBootstrap();
  return <>{children}</>;
}

/**
 * Wrapper for ThirdwebProvider (thirdweb v5).
 * AutoConnect reconnects the last connected wallet on reload so users do not
 * have to connect again after every refresh.
 * AutoBootstrapGate triggers bootstrap when wallet is connected but session is missing.
 * When NEXT_PUBLIC_SPONSOR_GAS=true, uses thirdweb account abstraction.
 * SKALE uses custom AccountFactory when NEXT_PUBLIC_SKALE_*_FACTORY_ADDRESS is set.
 */
export function ThirdwebProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = getThirdwebClient();
  const aa = ACCOUNT_ABSTRACTION_CONFIG;
  const accountAbstraction = aa
    ? {
        chain: aa.chain,
        sponsorGas: aa.sponsorGas,
        ...(aa.factoryAddress && { factoryAddress: aa.factoryAddress }),
        ...(aa.overrides && { overrides: aa.overrides }),
      }
    : undefined;
  return (
    <ThirdwebProvider>
      {client ? (
        <AutoConnect
          client={client}
          wallets={CONNECT_WALLETS}
          {...(accountAbstraction && { accountAbstraction })}
        />
      ) : null}
      <AutoBootstrapGate>{children}</AutoBootstrapGate>
    </ThirdwebProvider>
  );
}
