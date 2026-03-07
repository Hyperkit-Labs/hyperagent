/**
 * Thirdweb chain definitions for Mantle, SKALE, Filecoin (not in thirdweb/chains package).
 * Supported networks list and metadata come from GET /api/v1/networks (chain registry); use useNetworks() for UI.
 * This file is only for wallet/RPC execution via thirdweb where the registry chain is not in thirdweb/chains.
 */

import { defineChain } from 'thirdweb/chains';

export const mantleMainnet = defineChain({
  id: 5000,
  name: 'Mantle',
  nativeCurrency: { decimals: 18, name: 'MNT', symbol: 'MNT' },
  blockExplorers: [{ name: 'Mantlescan', url: 'https://mantlescan.xyz' }],
});

export const mantleSepoliaTestnet = defineChain({
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { decimals: 18, name: 'MNT', symbol: 'MNT' },
  blockExplorers: [{ name: 'Mantlescan', url: 'https://sepolia.mantlescan.xyz' }],
  testnet: true,
});

export const skaleChaosTestnet = defineChain({
  id: 1351057230,
  name: 'SKALE Chaos Testnet',
  nativeCurrency: { decimals: 18, name: 'sFUEL', symbol: 'sFUEL' },
  blockExplorers: [{ name: 'SKALE Explorer', url: 'https://chaos-testnet-explorer.skale.network' }],
  testnet: true,
});

export const filecoinMainnet = defineChain({
  id: 314,
  name: 'Filecoin',
  nativeCurrency: { decimals: 18, name: 'FIL', symbol: 'FIL' },
  blockExplorers: [{ name: 'Filfox', url: 'https://filfox.info' }],
});

export const filecoinCalibration = defineChain({
  id: 314159,
  name: 'Filecoin Calibration',
  nativeCurrency: { decimals: 18, name: 'FIL', symbol: 'tFIL' },
  blockExplorers: [{ name: 'Filfox', url: 'https://calibration.filfox.info' }],
  testnet: true,
});
