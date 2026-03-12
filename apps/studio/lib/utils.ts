/**
 * Shared UI and formatting utilities.
 */

import { tokens } from './design-tokens';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get spacing value from tokens
 */
export function getSpacing(size: keyof typeof tokens.spacing): string {
  return tokens.spacing[size];
}

/**
 * Get border radius value from tokens
 */
export function getRadius(size: keyof typeof tokens.borderRadius): string {
  return tokens.borderRadius[size];
}

// getStatusColor removed - use StatusBadge component instead
// This function was duplicating logic now handled by components/ui/StatusBadge.tsx

const EXPLORER_BY_NETWORK: Record<string, string> = {
  ethereum: 'https://etherscan.io',
  sepolia: 'https://sepolia.etherscan.io',
  mantle: 'https://mantlescan.xyz',
  'mantle-sepolia': 'https://sepolia.mantlescan.xyz',
  avalanche: 'https://snowtrace.io',
  fuji: 'https://testnet.snowtrace.io',
  polygon: 'https://polygonscan.com',
  'polygon-amoy': 'https://amoy.polygonscan.com',
  arbitrum: 'https://arbiscan.io',
  'arbitrum-sepolia': 'https://sepolia.arbiscan.io',
  base: 'https://basescan.org',
  'base-sepolia': 'https://sepolia.basescan.org',
  bsc: 'https://bscscan.com',
  'bsc-testnet': 'https://testnet.bscscan.com',
  'skalebase-mainnet': 'https://skale-base-explorer.skalenodes.com',
  'skalebase-sepolia': 'https://base-sepolia-testnet-explorer.skalenodes.com',
  'skale base sepolia': 'https://base-sepolia-testnet-explorer.skalenodes.com',
  'skale base': 'https://skale-base-explorer.skalenodes.com',
};

export function getExplorerUrl(network: string, type: 'tx' | 'address', value: string): string | null {
  const base = EXPLORER_BY_NETWORK[network.toLowerCase()] ?? null;
  if (!base) return null;
  if (type === 'tx') return `${base}/tx/${value}`;
  return `${base}/address/${value}`;
}

export function formatRelativeTime(date: Date | string | number): string {
  const d = typeof date === 'object' && 'getTime' in date ? date : new Date(date);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
