/**
 * Per-chain account abstraction config for thirdweb smart wallets.
 * SKALE chains use HyperAgent-owned AccountFactory (thirdweb shared factory not deployed).
 * Chain capability metadata is the single source of truth.
 */

import { skaleBaseSepolia, skaleBaseMainnet } from "@/lib/chains";
import { baseSepolia } from "thirdweb/chains";

export type AAChainKey = "skale-base-sepolia" | "skale-base-mainnet" | "base-sepolia";

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
export const ENTRYPOINT_V06 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as const;

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

/**
 * Resolves AA config for connect/AutoConnect.
 * Priority: SKALE Sepolia factory → SKALE Mainnet factory → Base Sepolia (thirdweb shared).
 */
export function getAccountAbstractionConfig(): AccountAbstractionConfig | undefined {
  const sponsorGas = getEnv("NEXT_PUBLIC_SPONSOR_GAS") === "true";
  if (!sponsorGas) return undefined;

  const skaleSepoliaFactory = getEnv("NEXT_PUBLIC_SKALE_BASE_SEPOLIA_FACTORY_ADDRESS");
  const skaleMainnetFactory = getEnv("NEXT_PUBLIC_SKALE_BASE_MAINNET_FACTORY_ADDRESS");

  if (skaleSepoliaFactory) {
    const bundlerUrl =
      getEnv("NEXT_PUBLIC_SKALE_BASE_SEPOLIA_BUNDLER_URL") ??
      getBundlerUrl(324705682);
    const entrypoint =
      getEnv("NEXT_PUBLIC_SKALE_BASE_SEPOLIA_ENTRYPOINT_ADDRESS") ?? ENTRYPOINT_V06;
    return {
      chain: skaleBaseSepolia,
      factoryAddress: skaleSepoliaFactory,
      sponsorGas: getEnv("NEXT_PUBLIC_SKALE_BASE_SEPOLIA_SPONSOR_GAS") !== "false",
      overrides: { bundlerUrl, entrypointAddress: entrypoint },
    };
  }

  if (skaleMainnetFactory) {
    const bundlerUrl =
      getEnv("NEXT_PUBLIC_SKALE_BASE_MAINNET_BUNDLER_URL") ??
      getBundlerUrl(1187947933);
    const entrypoint =
      getEnv("NEXT_PUBLIC_SKALE_BASE_MAINNET_ENTRYPOINT_ADDRESS") ?? ENTRYPOINT_V06;
    return {
      chain: skaleBaseMainnet,
      factoryAddress: skaleMainnetFactory,
      sponsorGas: getEnv("NEXT_PUBLIC_SKALE_BASE_MAINNET_SPONSOR_GAS") !== "false",
      overrides: { bundlerUrl, entrypointAddress: entrypoint },
    };
  }

  return {
    chain: baseSepolia,
    sponsorGas: true,
  };
}
