/**
 * Per-chain account abstraction config for thirdweb smart wallets.
 * SKALE chains use HyperAgent-owned AccountFactory (thirdweb shared factory not deployed).
 * Chain capability metadata is the single source of truth.
 *
 * SKALE uses CREDIT as its native gas token (not ETH/sFUEL). Users need CREDIT to
 * submit transactions. Check isCreditSufficient() before calling any write function.
 * Direct users to the SKALE Base faucet when balance is too low.
 */

import { skaleBaseSepolia, skaleBaseMainnet, baseSepolia } from "@/lib/chains";

export type AAChainKey =
  | "skale-base-sepolia"
  | "skale-base-mainnet"
  | "base-sepolia";

export const CHAIN_CAPABILITIES: Record<
  AAChainKey,
  {
    aa: {
      enabled: boolean;
      provider: "thirdweb";
      factoryMode: "custom" | "shared";
      entrypointVersion: "0.6";
    };
  }
> = {
  "skale-base-sepolia": {
    aa: {
      enabled: true,
      provider: "thirdweb",
      factoryMode: "custom",
      entrypointVersion: "0.6",
    },
  },
  "skale-base-mainnet": {
    aa: {
      enabled: true,
      provider: "thirdweb",
      factoryMode: "custom",
      entrypointVersion: "0.6",
    },
  },
  "base-sepolia": {
    aa: {
      enabled: true,
      provider: "thirdweb",
      factoryMode: "shared",
      entrypointVersion: "0.6",
    },
  },
};

/** Canonical ERC-4337 v0.6 EntryPoint. Deploy on SKALE if not present. */
export const ENTRYPOINT_V06 =
  "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as const;

/** thirdweb bundler URL format: https://{chainId}.bundler.thirdweb.com */
function getBundlerUrl(chainId: number): string {
  return `https://${chainId}.bundler.thirdweb.com`;
}

function getEnv(key: string): string | undefined {
  return typeof process !== "undefined" ? process.env[key] : undefined;
}

export interface AccountAbstractionConfig {
  chain: ReturnType<typeof import("thirdweb/chains").defineChain>;
  factoryAddress?: string;
  sponsorGas: boolean;
  overrides?: {
    bundlerUrl?: string;
    entrypointAddress?: string;
  };
}

// ---------------------------------------------------------------------------
// CREDIT balance helpers
// ---------------------------------------------------------------------------

/** SKALE chain IDs that use CREDIT as the native gas token. */
export const SKALE_CHAIN_IDS: ReadonlySet<number> = new Set([
  1187947933, // SKALE Base Mainnet
  324705682, // SKALE Base Sepolia
]);

/** Minimum CREDIT balance (in ether units) considered sufficient for a transaction. */
const CREDIT_MIN_BALANCE = 0.001;

/** Faucet URLs per SKALE chain — direct users here when CREDIT is insufficient. */
export const SKALE_FAUCET_URLS: Readonly<Record<number, string>> = {
  1187947933: "https://base.skale.space/",
  324705682: "https://base-sepolia-faucet.skale.space/",
};

export interface CreditBalanceResult {
  chainId: number;
  balanceEther: number;
  sufficient: boolean;
  faucetUrl: string | null;
}

/**
 * Check the CREDIT (native gas) balance of a wallet on a SKALE chain.
 * Returns whether the balance is sufficient for transactions.
 *
 * Only meaningful for SKALE chains. Returns sufficient=true for all other chains
 * since they use ETH/MATIC/etc. which have their own balance checks.
 */
export async function checkCreditBalance(
  address: string,
  chainId: number,
): Promise<CreditBalanceResult> {
  const faucetUrl = SKALE_FAUCET_URLS[chainId] ?? null;

  if (!SKALE_CHAIN_IDS.has(chainId)) {
    return { chainId, balanceEther: 0, sufficient: true, faucetUrl };
  }

  try {
    const { createPublicClient, http, formatEther } = await import("viem");
    const { skaleBaseMainnet: skaleMain, skaleBaseSepolia: skaleSep } =
      await import("@/lib/chains");

    const rpcUrl =
      chainId === 1187947933
        ? (skaleMain.rpc as string)
        : (skaleSep.rpc as string);
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    const balanceWei = await publicClient.getBalance({
      address: address as `0x${string}`,
    });
    const balanceEther = parseFloat(formatEther(balanceWei));
    const sufficient = balanceEther >= CREDIT_MIN_BALANCE;

    return { chainId, balanceEther, sufficient, faucetUrl };
  } catch (err) {
    console.warn("[smartWallet] CREDIT balance check failed:", err);
    // Optimistic: don't block on network error
    return { chainId, balanceEther: 0, sufficient: true, faucetUrl };
  }
}

/**
 * Throws a user-friendly error if the wallet lacks CREDIT on a SKALE chain.
 * Call this before submitting any write transaction to a SKALE network.
 */
export async function assertCreditSufficient(
  address: string,
  chainId: number,
): Promise<void> {
  const result = await checkCreditBalance(address, chainId);
  if (!result.sufficient) {
    const faucet = result.faucetUrl
      ? ` Get CREDIT from the faucet: ${result.faucetUrl}`
      : "";
    throw new Error(
      `Insufficient CREDIT balance (${result.balanceEther.toFixed(6)} CREDIT) for transactions on SKALE chain ${chainId}.${faucet}`,
    );
  }
}

// ---------------------------------------------------------------------------
// AA config resolver
// ---------------------------------------------------------------------------

/**
 * Resolves AA config for connect/AutoConnect.
 * Priority: SKALE Sepolia factory → SKALE Mainnet factory → Base Sepolia (thirdweb shared).
 */
export function getAccountAbstractionConfig():
  | AccountAbstractionConfig
  | undefined {
  const sponsorGas = getEnv("NEXT_PUBLIC_SPONSOR_GAS") === "true";
  if (!sponsorGas) return undefined;

  const skaleSepoliaFactory = getEnv(
    "NEXT_PUBLIC_SKALE_BASE_SEPOLIA_FACTORY_ADDRESS",
  );
  const skaleMainnetFactory = getEnv(
    "NEXT_PUBLIC_SKALE_BASE_MAINNET_FACTORY_ADDRESS",
  );

  if (skaleSepoliaFactory) {
    const bundlerUrl =
      getEnv("NEXT_PUBLIC_SKALE_BASE_SEPOLIA_BUNDLER_URL") ??
      getBundlerUrl(324705682);
    const entrypoint =
      getEnv("NEXT_PUBLIC_SKALE_BASE_SEPOLIA_ENTRYPOINT_ADDRESS") ??
      ENTRYPOINT_V06;
    return {
      chain: skaleBaseSepolia,
      factoryAddress: skaleSepoliaFactory,
      sponsorGas:
        getEnv("NEXT_PUBLIC_SKALE_BASE_SEPOLIA_SPONSOR_GAS") !== "false",
      overrides: { bundlerUrl, entrypointAddress: entrypoint },
    };
  }

  if (skaleMainnetFactory) {
    const bundlerUrl =
      getEnv("NEXT_PUBLIC_SKALE_BASE_MAINNET_BUNDLER_URL") ??
      getBundlerUrl(1187947933);
    const entrypoint =
      getEnv("NEXT_PUBLIC_SKALE_BASE_MAINNET_ENTRYPOINT_ADDRESS") ??
      ENTRYPOINT_V06;
    return {
      chain: skaleBaseMainnet,
      factoryAddress: skaleMainnetFactory,
      sponsorGas:
        getEnv("NEXT_PUBLIC_SKALE_BASE_MAINNET_SPONSOR_GAS") !== "false",
      overrides: { bundlerUrl, entrypointAddress: entrypoint },
    };
  }

  return {
    chain: baseSepolia,
    sponsorGas: true,
  };
}
