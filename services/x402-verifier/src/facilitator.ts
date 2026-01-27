import './env';

import { facilitator } from "thirdweb/x402";
import { createThirdwebClient } from "thirdweb";
import { avalancheFuji, avalanche, defineChain, type Chain } from "thirdweb/chains";

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
  // Avalanche
  "avalanche_fuji": avalancheFuji,
  "fuji": avalancheFuji,
  "avalanche_mainnet": avalanche,
  "avalanche": avalanche,

  // Mantle
  "mantle_testnet": defineChain(5003),
  "mantle_mainnet": defineChain(5000),

  // Base
  "base_sepolia": defineChain(84532),
  "base_mainnet": defineChain(8453),

  // Arbitrum
  "arbitrum_sepolia": defineChain(421614),
  "arbitrum_one": defineChain(42161),
};

export const getChain = (network: string): Chain => {
  const raw = network.toLowerCase().trim();

  // CAIP-2: eip155:<chainId>
  if (raw.startsWith("eip155:")) {
    const idStr = raw.split(":", 2)[1];
    const maybeId = Number(idStr);
    if (Number.isFinite(maybeId) && maybeId > 0) {
      return defineChain(maybeId);
    }
  }

  const normalized = raw.replace(/-/g, "_");
  const chain = NETWORK_CHAIN_MAP[normalized];
  if (chain) return chain;

  // If callers pass a raw chainId, allow it.
  const maybeId = Number(raw);
  if (Number.isFinite(maybeId) && maybeId > 0) {
    return defineChain(maybeId);
  }

  throw new Error(
    `Unsupported network '${network}' for x402 settlement. Pass a chainId (e.g. '42161') or CAIP-2 (eip155:42161).`
  );
};

export { client };
