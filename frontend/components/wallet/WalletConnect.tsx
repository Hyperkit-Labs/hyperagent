'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import { avalancheFuji, avalanche } from 'thirdweb/chains';
import { getThirdwebClient } from '@/lib/thirdwebClient';

/**
 * Universal Wallet Connect Component
 * Supports: MetaMask, Core Wallet, OKX Wallet, Phantom, and more
 * Uses Thirdweb's ConnectButton for automatic wallet detection
 */
export function WalletConnect() {
  const [mounted, setMounted] = useState(false);
  const client = getThirdwebClient();
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!client || !mounted) {
    return (
      <div className="h-[40px] w-[165px] bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  // Define supported wallets using Thirdweb v5 API
  const wallets = [
    createWallet('io.metamask'),
    createWallet('app.core'),
    createWallet('com.okex.wallet'),
    createWallet('app.phantom'),
    createWallet('com.coinbase.wallet'),
    createWallet('me.rainbow'),
  ];

  return (
    <ConnectButton
      client={client}
      wallets={wallets}
      chains={[avalancheFuji, avalanche]}
      theme="light"
      connectButton={{
        label: 'Connect Wallet',
        className: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg',
      }}
      detailsButton={{
        className: 'bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium px-4 py-2 rounded-lg transition-all duration-200',
        displayBalanceToken: {
          [avalancheFuji.id]: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // USDC on Fuji
          [avalanche.id]: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // USDC on mainnet
        },
      }}
      switchButton={{
        label: 'Wrong Network',
        className: 'bg-yellow-500 hover:bg-yellow-600 text-white font-medium px-4 py-2 rounded-lg',
      }}
    />
  );
}

/**
 * Compact Wallet Button for Navigation Bar
 */
export function CompactWalletButton() {
  const [mounted, setMounted] = useState(false);
  const client = getThirdwebClient();
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!client || !mounted) {
    return (
      <div className="h-[36px] w-[80px] bg-gray-100 rounded-md animate-pulse" />
    );
  }

  const wallets = [
    createWallet('io.metamask'),
    createWallet('app.core'),
    createWallet('com.okex.wallet'),
    createWallet('app.phantom'),
  ];

  return (
    <ConnectButton
      client={client}
      wallets={wallets}
      chains={[avalancheFuji, avalanche]}
      theme="light"
      connectButton={{
        label: 'Connect',
        className: 'bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition-colors',
      }}
      detailsButton={{
        className: 'bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 rounded-md transition-colors text-sm',
      }}
    />
  );
}

export default WalletConnect;

