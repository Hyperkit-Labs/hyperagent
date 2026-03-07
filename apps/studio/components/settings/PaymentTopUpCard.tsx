"use client";

import { useState, useEffect } from "react";
import { Coins, Loader2, Wallet } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { getContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { transfer } from "thirdweb/extensions/erc20";
import { sendTransaction, waitForReceipt } from "thirdweb";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { topUpCreditsWithTx, getConfig, handleApiError } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { toast } from "sonner";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDT_BASE = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";
const DECIMALS = 6;

type Token = "USDC" | "USDT";

export interface PaymentTopUpCardProps {
  /** Called after a successful on-chain top-up so parent can refresh credits. */
  onTopUpSuccess?: () => void;
}

export function PaymentTopUpCard({ onTopUpSuccess }: PaymentTopUpCardProps) {
  const account = useActiveAccount();
  const { hasSession } = useSession();
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<Token>("USDC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [merchantAddress, setMerchantAddress] = useState<string | null>(null);

  useEffect(() => {
    getConfig().then((c) => setMerchantAddress(c.merchant_wallet_address ?? null));
  }, []);

  const handlePayWithStablecoin = async () => {
    const num = parseFloat(amount);
    if (!account || !hasSession || Number.isNaN(num) || num <= 0) return;
    const addr = merchantAddress?.trim();
    if (!addr) {
      setError("Merchant wallet not configured. Set MERCHANT_WALLET_ADDRESS.");
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

    const tokenAddress = token === "USDC" ? USDC_BASE : USDT_BASE;
    const contract = getContract({ client, chain: base, address: tokenAddress });
    const amountWei = BigInt(Math.floor(num * 10 ** DECIMALS));

    try {
      const tx = transfer({
        contract,
        to: addr as `0x${string}`,
        amount: amountWei,
      });

      const result = await sendTransaction({
        transaction: tx,
        account: account,
      });

      const receipt = await waitForReceipt({
        client,
        chain: base,
        transactionHash: result.transactionHash,
      });

      if (receipt.status !== "success") {
        throw new Error("Transaction failed");
      }

      await topUpCreditsWithTx({
        amount: num,
        currency: "USD",
        reference_type: "usdc_transfer",
        reference_id: result.transactionHash,
        tx_hash: result.transactionHash,
      });

      setAmount("");
      onTopUpSuccess?.();
      toast.success(`Added ${num} credits. Tx: ${result.transactionHash.slice(0, 10)}...`);
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
        <p className="text-sm text-[var(--color-text-tertiary)] mt-2">Sign in to add USDC or USDT budget.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="w-5 h-5 text-[var(--color-text-muted)]" />
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Add budget (USDC/USDT)</h3>
      </div>
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Send USDC or USDT to add credits. 1:1 conversion. Funds go to merchant wallet.
      </p>
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
          disabled={loading || !amount.trim() || !merchantAddress}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)] disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
          {loading ? "Processing..." : "Pay with " + token}
        </button>
      </div>
      {!merchantAddress && (
        <p className="text-xs text-[var(--color-text-muted)]">Configure MERCHANT_WALLET_ADDRESS to enable payments.</p>
      )}
    </div>
  );
}
