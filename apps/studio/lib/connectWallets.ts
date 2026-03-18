/**
 * Shared wallet list for connect modal and AutoConnect.
 * Using the same list in both places ensures the last-connected wallet
 * can be restored after a page refresh.
 * Includes: MetaMask, Coinbase, WalletConnect, inAppWallet (all thirdweb auth options).
 */
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { getAccountAbstractionConfig } from "@/lib/smartWallet";

/** All thirdweb-supported in-app wallet auth options (social, passkey, email, phone, etc.) */
const IN_APP_AUTH_OPTIONS = [
  "google",
  "apple",
  "facebook",
  "discord",
  "github",
  "twitch",
  "x",
  "telegram",
  "line",
  "coinbase",
  "tiktok",
  "epic",
  "farcaster",
  "steam",
  "passkey",
  "email",
  "phone",
  "guest",
  "wallet",
] as const;

export const CONNECT_WALLETS = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
  inAppWallet({
    auth: {
      options: [...IN_APP_AUTH_OPTIONS],
      mode: "popup",
    },
  }),
];

/**
 * Account abstraction config for connect/AutoConnect.
 * Resolved from getAccountAbstractionConfig(): SKALE custom factory → Base Sepolia (thirdweb shared).
 */
export const ACCOUNT_ABSTRACTION_CONFIG = getAccountAbstractionConfig();

/**
 * Connect options for useConnectModal(). When NEXT_PUBLIC_SPONSOR_GAS=true,
 * wires thirdweb account abstraction. Uses custom factory on SKALE when configured.
 */
export function getConnectConfig(client: import("thirdweb").ThirdwebClient) {
  const aa = getAccountAbstractionConfig();
  return {
    client,
    wallets: CONNECT_WALLETS,
    ...(aa && {
      accountAbstraction: {
        chain: aa.chain,
        sponsorGas: aa.sponsorGas,
        ...(aa.factoryAddress && { factoryAddress: aa.factoryAddress }),
        ...(aa.overrides && { overrides: aa.overrides }),
      },
    }),
  };
}
