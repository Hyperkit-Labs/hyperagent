import { Env } from "../config/env";
import { getMerchantWalletAddress } from "../config/configLoader";

export type X402SettleResult =
  | { status: 200; verified: true }
  | {
      status: number;
      verified: false;
      responseBody?: unknown;
      responseHeaders?: Record<string, string>;
      error?: string;
      errorMessage?: string;
    };

export async function settleX402Payment(args: {
  env: Env;
  resourceUrl: string;
  method: string;
  network: string;
  priceUsd: number;
  walletAddress?: string;
  paymentData?: string;
}): Promise<X402SettleResult> {
  const baseUrl = args.env.X402_VERIFIER_URL;
  if (!baseUrl) {
    return {
      status: 502,
      verified: false,
      error: "Settlement service not configured",
      errorMessage: "X402_VERIFIER_URL is not set on the API server",
    };
  }

  // Get merchant wallet from YAML config (config/deployment.yaml)
  // Fallback to env for backward compatibility
  const payTo = getMerchantWalletAddress() || args.env.MERCHANT_WALLET_ADDRESS;
  if (!payTo) {
    return {
      status: 502,
      verified: false,
      error: "Merchant not configured",
      errorMessage: "Merchant wallet address not configured in config/deployment.yaml or MERCHANT_WALLET_ADDRESS env",
    };
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/settle-payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      resourceUrl: args.resourceUrl,
      method: args.method,
      paymentData: args.paymentData,
      payTo,
      network: args.network,
      price: `$${args.priceUsd.toFixed(2)}`,
      routeConfig: {
        description: "HyperAgent TS API",
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
      },
    }),
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  if (res.status === 200) {
    return { status: 200, verified: true };
  }

  // x402-verifier returns a JSON wrapper with responseBody/responseHeaders.
  if (res.status === 402 && data && typeof data === "object") {
    return {
      status: 402,
      verified: false,
      responseBody: data.responseBody,
      responseHeaders: data.responseHeaders,
    };
  }

  // Best-effort error formatting
  if (data && typeof data === "object") {
    return {
      status: res.status,
      verified: false,
      error: data.error,
      errorMessage: data.errorMessage,
      responseHeaders: data.responseHeaders,
    };
  }

  return {
    status: res.status,
    verified: false,
    error: "Settlement error",
    errorMessage: typeof data === "string" ? data : "Payment verification failed",
  };
}
