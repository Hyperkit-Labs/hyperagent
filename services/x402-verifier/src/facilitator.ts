import './env';

import { facilitator } from "thirdweb/x402";
import { createThirdwebClient } from "thirdweb";
import { avalancheFuji, avalanche, type Chain } from "thirdweb/chains";

const secretKey = process.env.THIRDWEB_SECRET_KEY;
const serverWalletAddress = process.env.THIRDWEB_SERVER_WALLET_ADDRESS;

if (!secretKey || !serverWalletAddress) {
  console.error('\n❌ Missing environment variables:');
  console.error('  THIRDWEB_SECRET_KEY:', secretKey ? '✓' : '✗ Missing');
  console.error('  THIRDWEB_SERVER_WALLET_ADDRESS:', serverWalletAddress ? '✓' : '✗ Missing');
  throw new Error("THIRDWEB_SECRET_KEY and THIRDWEB_SERVER_WALLET_ADDRESS required");
}

const client = createThirdwebClient({ secretKey });
export const thirdwebFacilitator = facilitator({
  client,
  serverWalletAddress: serverWalletAddress as `0x${string}`,
});

const NETWORK_CHAIN_MAP: Record<string, Chain> = {
  "avalanche_fuji": avalancheFuji,
  "fuji": avalancheFuji,
  "avalanche_mainnet": avalanche,
  "avalanche": avalanche,
};

export const getChain = (network: string): Chain => {
  const normalized = network.toLowerCase().trim();
  if (NETWORK_CHAIN_MAP[normalized]) {
    return NETWORK_CHAIN_MAP[normalized];
  }
  if (normalized.includes("hyperion") || normalized.includes("metis") || normalized.includes("mantle")) {
    throw new Error(`${network} does not support x402 payments. Only Avalanche networks are supported.`);
  }
  return avalancheFuji;
};

export { client };
