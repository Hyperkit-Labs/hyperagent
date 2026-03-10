/**
 * Shared wallet list for connect modal and AutoConnect.
 * Using the same list in both places ensures the last-connected wallet
 * can be restored after a page refresh.
 * Includes: MetaMask, Coinbase, WalletConnect, inAppWallet (Google/OAuth).
 */
import { createWallet, inAppWallet } from "thirdweb/wallets";

export const CONNECT_WALLETS = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
  inAppWallet({
    auth: {
      options: ["google"],
      mode: "popup",
    },
  }),
];
