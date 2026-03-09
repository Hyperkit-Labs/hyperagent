/**
 * Shared wallet list for connect modal and AutoConnect.
 * Using the same list in both places ensures the last-connected wallet
 * can be restored after a page refresh.
 */
import { createWallet } from "thirdweb/wallets";

export const CONNECT_WALLETS = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
];
