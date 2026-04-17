"use client";

import { createThirdwebClient } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import { ERC1066Client } from "hyperkit-erc1066";
import {
  PROOF_VALID_SECONDS,
  buildX402Receipt,
  encodeX402Proof,
  parseX402Challenge,
  erc1066ToAction,
  type X402PaymentProof,
} from "@/lib/x402Client";

/**
 * ERC1066Client pointed at the HyperAgent API gateway.
 * Used to validate/execute ERC-1066 intents and map status codes to actions.
 * The gateway URL is the Next.js origin so requests go through the proxy.
 */
const _gatewayUrl =
  typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL ?? "") : "";

export const erc1066Client = _gatewayUrl
  ? new ERC1066Client(_gatewayUrl)
  : null;

const clientId =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID
    : undefined;

export const thirdwebClient = clientId
  ? createThirdwebClient({ clientId })
  : null;

export function isThirdwebConfigured(): boolean {
  return !!clientId;
}

export function getThirdwebClient() {
  return thirdwebClient;
}

// ---------------------------------------------------------------------------
// Legacy x402 path — EIP-191 signed JSON receipt (HyperAgent custom contract)
// ---------------------------------------------------------------------------
//
// For SKALE v0.1.0 production, prefer createOfficialX402Fetch / createKiteAlignedX402Fetch:
// ERC-3009 TransferWithAuthorization via @x402/fetch + @x402/evm matches Kite's x402 guide
// (https://docs.gokite.ai/kite-agent-passport/service-provider-guide) and PayAI/Pieverse facilitators.

/**
 * Returns a fetch-like function that handles HTTP 402 (Payment Required) responses
 * via HyperAgent's x402 protocol. On a 402 with an x402 challenge body, builds a
 * signed payment proof and retries the request with the X-Payment header.
 *
 * Proof format: base64-encoded JSON { nonce, amount, payer, signature, valid_before }
 * matching _validate_proof_structure in services/orchestrator/x402_middleware.py.
 *
 * Prefer {@link createOfficialX402Fetch} when you have a Thirdweb Account (ERC-3009).
 *
 * Falls back to the original 402 response when:
 * - No wallet is provided
 * - The 402 body is not an x402 challenge (e.g. credits-exhausted)
 * - Payment amount exceeds maxPaymentUsd
 */
export function createFetchWithPayment(
  wallet:
    | { address?: string; signMessage?: (msg: string) => Promise<string> }
    | null
    | undefined,
  maxPaymentUsd?: number,
): (url: string, init?: RequestInit) => Promise<Response> {
  const maxUsd = maxPaymentUsd ?? 1;

  return async (url: string, init?: RequestInit): Promise<Response> => {
    const res = await fetch(url, init);

    if (res.status !== 402 || !wallet?.address || !wallet?.signMessage) {
      return res;
    }

    const challenge = await parseX402Challenge(res);
    if (!challenge) {
      return res;
    }

    // Use ERC-1066 action mapping to decide whether to attempt payment.
    const erc1066Code = challenge.erc1066_code;
    const action = erc1066Code
      ? erc1066ToAction(erc1066Code)
      : (challenge.action ?? "request_payment");

    if (action === "deny") {
      // Server explicitly rejected: expired, replay, disallowed. Return the 402 as-is.
      return res;
    }
    if (action === "retry") {
      // Transient issue (too early). Caller should retry after a delay.
      return res;
    }

    // action === "request_payment" or "execute" — proceed with proof construction.
    const priceUsd = challenge.price_usd;
    if (priceUsd > maxUsd) {
      throw new Error(
        `x402 payment of $${priceUsd.toFixed(2)} exceeds allowed max ($${maxUsd.toFixed(2)}). ` +
          `Increase maxPaymentUsd or decline.`,
      );
    }

    const payTo = challenge.paymentRequirements?.payTo;
    const nonce = crypto.randomUUID();
    const amount = String(priceUsd);
    const payer = wallet.address;
    const valid_before = Math.floor(Date.now() / 1000) + PROOF_VALID_SECONDS;

    const receipt = buildX402Receipt({
      nonce,
      amount,
      payer,
      valid_before,
      ...(payTo ? { pay_to: payTo } : {}),
      network: "skale-base",
    });

    const signature = await wallet.signMessage(receipt);

    const proof: X402PaymentProof = {
      nonce,
      amount,
      payer,
      signature,
      valid_before,
      ...(payTo ? { pay_to: payTo } : {}),
      network: "skale-base",
    };

    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set("X-Payment", encodeX402Proof(proof));

    return fetch(url, { ...init, headers: retryHeaders });
  };
}

// ---------------------------------------------------------------------------
// Official x402 implementation — ERC-3009 TransferWithAuthorization via
// @x402/fetch + @x402/evm (ExactEvmScheme). This is the CORRECT client
// for SKALE Base: it signs typed EIP-712 data rather than a plain message,
// and sends the standard `X-Payment` header the PayAI facilitator expects.
//
// Usage:  const fetchWithPayment = await createOfficialX402Fetch(account);
//         const res = await fetchWithPayment(url, init);
//
// Primary path for SKALE chains. Falls back to createFetchWithPayment when
// the official packages are unavailable (e.g. SSR without the full bundle).
// ---------------------------------------------------------------------------

export async function createOfficialX402Fetch(
  thirdwebAccount: Account,
  chainId: number = 1187947933, // SKALE Base Mainnet
): Promise<(url: string, init?: RequestInit) => Promise<Response>> {
  try {
    const [
      { wrapFetchWithPayment, x402Client },
      { ExactEvmScheme, toClientEvmSigner },
      { createPublicClient, http },
    ] = await Promise.all([
      import("@x402/fetch"),
      import("@x402/evm"),
      import("viem"),
    ]);

    // SKALE uses legacy (type 0) transactions only — supply the RPC so the
    // signer can read on-chain nonces without EIP-1559 gas fields.
    const skaleRpcs: Record<number, string> = {
      1187947933: "https://skale-base.skalenodes.com/v1/base",
      324705682:
        "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha",
    };
    const rpcUrl = skaleRpcs[chainId];
    const publicClient = rpcUrl
      ? createPublicClient({ transport: http(rpcUrl) })
      : createPublicClient({ transport: http() });

    const evmSigner = toClientEvmSigner(
      {
        address: thirdwebAccount.address as `0x${string}`,
        signTypedData: (message) =>
          thirdwebAccount.signTypedData(
            message as Parameters<Account["signTypedData"]>[0],
          ),
      },
      publicClient,
    );

    const client = new x402Client();
    // Register the ERC-3009 exact payment scheme for this chain.
    client.register(`eip155:${chainId}`, new ExactEvmScheme(evmSigner));

    return wrapFetchWithPayment(fetch, client) as (
      url: string,
      init?: RequestInit,
    ) => Promise<Response>;
  } catch (err) {
    console.warn(
      "[x402] @x402/fetch setup failed — falling back to custom implementation.",
      err,
    );
    const address = thirdwebAccount.address;
    const signMessage = (msg: string) =>
      thirdwebAccount.signMessage({ message: msg });
    return createFetchWithPayment({ address, signMessage });
  }
}

/** Alias for {@link createOfficialX402Fetch} — Kite x402 service-provider guide uses the same ERC-3009 flow. */
export const createKiteAlignedX402Fetch = createOfficialX402Fetch;
