"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Coins, Loader2, Wallet } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { getContract } from "thirdweb";
import { transfer } from "thirdweb/extensions/erc20";
import { sendTransaction, waitForReceipt } from "thirdweb";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { topUpCreditsWithTx, getStablecoins, handleApiError } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { useConfig } from "@/components/providers/ConfigProvider";
import { useNetworks } from "@/hooks/useNetworks";
import { useSelectedNetwork } from "@/components/providers/SelectedNetworkProvider";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { toast } from "sonner";
import { getChainByChainId } from "@/lib/smartWalletDeploy";

const DECIMALS = 6;

type Token = "USDC" | "USDT";

export type StablecoinsMap = Record<string, { USDC?: string; USDT?: string }>;

export interface PaymentTopUpCardProps {
  /** Called after a successful on-chain top-up so parent can refresh credits. */
  onTopUpSuccess?: () => void;
  /** When provided (e.g. from Payments page consolidated fetch), skip internal fetch. */
  stablecoinsFromParent?: StablecoinsMap;
}

export function PaymentTopUpCard({
  onTopUpSuccess,
  stablecoinsFromParent,
}: PaymentTopUpCardProps) {
  const account = useActiveAccount();
  const { hasSession } = useSession();
  const { networks } = useNetworks();
  const { selectedNetworkId } = useSelectedNetwork();
  const { config } = useConfig();
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<Token>("USDC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stablecoinsLocal, setStablecoinsLocal] = useState<StablecoinsMap>({});

  const fetchStablecoins = useCallback(() => {
    getStablecoins()
      .then(setStablecoinsLocal)
      .catch(() => setStablecoinsLocal({}));
  }, []);

  useEffect(() => {
    if (stablecoinsFromParent !== undefined) return;
    if (hasSession) fetchStablecoins();
  }, [hasSession, stablecoinsFromParent, fetchStablecoins]);

  const merchantAddress = config?.merchant_wallet_address ?? null;
  const creditsPerUsd = config?.credits_per_usd ?? 10;
  const stablecoins = stablecoinsFromParent ?? stablecoinsLocal;

  const { selectedNetwork, chain, tokenAddress } = useMemo(() => {
    const net =
      networks.find(
        (n) => n.id === selectedNetworkId || n.network_id === selectedNetworkId,
      ) ??
      networks.find((n) => !n.is_mainnet) ??
      networks[0];
    const cid = net?.chain_id;
    const ch = cid != null ? getChainByChainId(cid) : undefined;
    const addrs = cid != null ? stablecoins[String(cid)] : undefined;
    const addr = token === "USDC" ? addrs?.USDC : addrs?.USDT;
    return {
      selectedNetwork: net,
      chain: ch,
      tokenAddress: addr,
    };
  }, [networks, selectedNetworkId, stablecoins, token]);

  const handlePayWithStablecoin = async () => {
    const num = parseFloat(amount);
    if (!account || !hasSession || Number.isNaN(num) || num <= 0) return;
    const addr = merchantAddress?.trim();
    if (!addr) {
      setError("Merchant wallet not configured. Set MERCHANT_WALLET_ADDRESS.");
      return;
    }
    if (!chain || !tokenAddress) {
      setError(
        `USDC/USDT not supported on ${selectedNetwork?.name ?? "selected network"}. Switch network in the header or use Base.`,
      );
      return;
    }

    setLoading(true);
    setError(null);
    const client = getThirdwebClient();
    if (!client) {
      setError("Thirdweb client not configured");
      setLoading(false);
      return;
    }

    const contract = getContract({ client, chain, address: tokenAddress });
    const amountWei = BigInt(Math.floor(num * 10 ** DECIMALS));

    try {
      const tx = transfer({
        contract,
        to: addr as `0x${string}`,
        amount: amountWei.toString(),
      });

      const result = await sendTransaction({
        transaction: tx,
        account: account,
      });

      const receipt = await waitForReceipt({
        client,
        chain,
        transactionHash: result.transactionHash,
      });

      if (receipt.status !== "success") {
        throw new Error("Transaction failed");
      }

      const refType = token === "USDC" ? "usdc_transfer" : "usdt_transfer";
      await topUpCreditsWithTx({
        amount: num,
        currency: "USD",
        reference_type: refType,
        reference_id: result.transactionHash,
        tx_hash: result.transactionHash,
      });

      const creditsAdded = Math.floor(num * creditsPerUsd);
      setAmount("");
      onTopUpSuccess?.();
      toast.success(
        `Added ${creditsAdded} credits (${num} USD). Tx: ${result.transactionHash.slice(0, 10)}...`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transfer failed";
      setError(handleApiError(e));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!hasSession) {
    return (
      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Wallet className="w-5 h-5" />
          <h3 className="text-sm font-medium">Add budget</h3>
        </div>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
          Sign in to add USDC or USDT budget.
        </p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Wallet className="w-5 h-5" />
          <h3 className="text-sm font-medium">Add budget (USDC/USDT)</h3>
        </div>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
          Connect your wallet to top up with USDC or USDT.
        </p>
      </div>
    );
  }

  const canPay = chain && tokenAddress && merchantAddress;

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="w-5 h-5 text-[var(--color-text-muted)]" />
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Add budget (USDC/USDT)
        </h3>
      </div>
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Send USDC or USDT on{" "}
        <strong>{selectedNetwork?.name ?? "selected network"}</strong>. 1 USD ={" "}
        {creditsPerUsd} credits. Funds go to merchant wallet.
      </p>
      {!canPay && selectedNetwork && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Select a network with USDC/USDT in the header (e.g. SKALE Base
          Sepolia, Base).
        </p>
      )}
      {error && <ApiErrorBanner error={error} onRetry={() => setError(null)} />}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={token}
          onChange={(e) => setToken(e.target.value as Token)}
          className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-default)] focus:outline-none"
        >
          <option value="USDC">USDC</option>
          <option value="USDT">USDT</option>
        </select>
        <input
          type="number"
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-24 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-default)] focus:outline-none"
        />
        <button
          type="button"
          onClick={handlePayWithStablecoin}
          disabled={loading || !amount.trim() || !canPay || !account}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)] disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wallet className="w-4 h-4" />
          )}
          {loading ? "Processing..." : "Pay with " + token}
        </button>
      </div>
      {!merchantAddress && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Configure MERCHANT_WALLET_ADDRESS to enable payments.
        </p>
      )}
    </div>
  );
}
