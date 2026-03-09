'use client';

import { ThirdwebProvider, AutoConnect } from 'thirdweb/react';
import { getThirdwebClient } from '@/lib/thirdwebClient';
import { CONNECT_WALLETS } from '@/lib/connectWallets';

/**
 * Wrapper for ThirdwebProvider (thirdweb v5).
 * AutoConnect reconnects the last connected wallet on reload so users do not
 * have to connect again after every refresh.
 */
export function ThirdwebProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = getThirdwebClient();
  return (
    <ThirdwebProvider>
      {client ? (
        <AutoConnect
          client={client}
          wallets={CONNECT_WALLETS}
        />
      ) : null}
      {children}
    </ThirdwebProvider>
  );
}

