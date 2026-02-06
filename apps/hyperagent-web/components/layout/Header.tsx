'use client';

import React from 'react';
import Menu from 'lucide-react/dist/esm/icons/menu'
import Search from 'lucide-react/dist/esm/icons/search'
import Bell from 'lucide-react/dist/esm/icons/bell'
import { ConnectButton } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import { getThirdwebClient } from '@/lib/thirdwebClient';
import {
  mantleMainnet,
  mantleSepoliaTestnet,
  skaleChaosTestnet,
  filecoinMainnet,
  filecoinCalibration,
} from '@/lib/chains';
import { 
  avalanche, 
  avalancheFuji, 
  arbitrum, 
  arbitrumSepolia,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
  mainnet,
  sepolia,
} from 'thirdweb/chains';

interface HeaderProps {
  onMenuClick: () => void;
  currentPage: string;
  currentSection?: string;
}

const getSupportedWallets = () => {
  return [
    createWallet("io.metamask"),
    createWallet("okx.wallet"),
    createWallet("com.coinbase.wallet"),
    createWallet("com.trustwallet.app"),
    createWallet("io.rabby"),
    createWallet("me.rainbow"),
  ];
};

export const Header: React.FC<HeaderProps> = ({ onMenuClick, currentPage, currentSection = 'Overview' }) => {
  const thirdwebClient = getThirdwebClient();
  const supportedWallets = getSupportedWallets();

  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 lg:px-6 bg-[#05050A]/80 backdrop-blur-md sticky top-0 z-20">
      {/* Left: Mobile Menu & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden text-slate-400 hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 hidden sm:inline">{currentSection}</span>
          <span className="text-slate-600 hidden sm:inline">/</span>
          <span className="text-white font-medium">{currentPage}</span>
        </div>
      </div>

      {/* Center: Omni-Search (Hidden on mobile) */}
      <div className="hidden lg:flex relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search workflows, contracts, or logs..."
          className="w-full bg-white/[0.03] border border-white/10 rounded-full py-1.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 placeholder:text-slate-600 transition-all"
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>System Operational</span>
        </div>

        <div className="hidden sm:block h-4 w-[1px] bg-white/10 mx-1" />

        <button className="relative text-slate-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-violet-500 ring-2 ring-[#05050A]" />
        </button>

        {/* Thirdweb Wallet Connect Button - Multiple Wallet Support */}
        {thirdwebClient ? (
          <div className="wallet-connect-wrapper">
            <ConnectButton
              client={thirdwebClient}
              wallets={supportedWallets}
              chains={[
                mantleMainnet,
                mantleSepoliaTestnet,
                avalanche,
                avalancheFuji,
                arbitrum,
                arbitrumSepolia,
                base,
                baseSepolia,
                bsc,
                bscTestnet,
                mainnet,
                sepolia,
                skaleChaosTestnet,
                filecoinMainnet,
                filecoinCalibration,
              ]}
              theme="dark"
              connectModal={{
                size: 'compact',
                title: 'Connect Wallet',
                titleIcon: '',
                showThirdwebBranding: false,
              }}
              connectButton={{
                label: 'Connect',
                style: {
                  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: '9999px',
                  height: '36px',
                  minHeight: '36px',
                  padding: '0 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'white',
                  boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.1), inset 0 1px 2px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                },
              }}
              detailsButton={{
                style: {
                  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: '9999px',
                  height: '36px',
                  minHeight: '36px',
                  padding: '0 14px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'white',
                  boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.1), inset 0 1px 2px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: 'inherit',
                },
              }}
            />
            <style dangerouslySetInnerHTML={{
              __html: `
                .wallet-connect-wrapper button {
                  transition: all 0.2s ease !important;
                }
                .wallet-connect-wrapper button:hover {
                  background: linear-gradient(135deg, #334155 0%, #475569 100%) !important;
                  border-color: rgba(139, 92, 246, 0.4) !important;
                  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.3), 
                             0 0 12px rgba(139, 92, 246, 0.15),
                             inset 0 1px 2px rgba(0, 0, 0, 0.2) !important;
                  transform: translateY(-1px);
                }
                .wallet-connect-wrapper button:active {
                  transform: translateY(0);
                }
              `
            }} />
          </div>
        ) : (
          <button 
            disabled
            className="h-9 px-4 rounded-full bg-gradient-to-br from-slate-800 to-slate-700 border border-white/5 flex items-center justify-center text-xs font-medium text-slate-400 shadow-inner opacity-50 cursor-not-allowed"
            title="Thirdweb client not configured. Set NEXT_PUBLIC_THIRDWEB_CLIENT_ID in .env"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
};