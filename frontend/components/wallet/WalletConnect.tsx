'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
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
      <div className="h-[40px] w-[165px] bg-gray-800/50 rounded-lg animate-pulse border border-white/10" />
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
      theme="dark"
      connectButton={{
        label: 'Connect Wallet',
        className: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30',
      }}
      detailsButton={{
        className: 'bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 rounded-xl transition-all duration-200 border border-white/10',
      }}
      switchButton={{
        label: 'Wrong Network',
        className: 'bg-yellow-500 hover:bg-yellow-400 text-white font-medium px-4 py-2 rounded-xl shadow-lg',
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
      <div className="h-[36px] w-[80px] bg-gray-800/50 rounded-md animate-pulse border border-white/10" />
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
      theme="dark"
      connectButton={{
        label: 'Connect',
        className: 'bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-xl',
      }}
      detailsButton={{
        className: 'bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl transition-all text-sm border border-white/10',
      }}
    />
  );
}

export default WalletConnect;

