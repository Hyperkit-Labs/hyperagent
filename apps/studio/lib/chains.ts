/**
 * Thirdweb chain definitions for Mantle, SKALE Base, Filecoin (not in thirdweb/chains package).
 * Supported networks and metadata from GET /api/v1/networks; use useNetworks() for UI.
 * Chain IDs and RPCs must match infra/registries/network/chains.yaml.
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

export const skaleBaseSepolia = defineChain({
  id: 324705682,
  name: 'SKALE Base Sepolia',
  nativeCurrency: { decimals: 18, name: 'CREDIT', symbol: 'CREDIT' },
  rpc: 'https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha',
  blockExplorers: [{ name: 'SKALE Explorer', url: 'https://base-sepolia-testnet-explorer.skalenodes.com/' }],
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
