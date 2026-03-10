/**
 * Unified auth bootstrap: call backend to upsert wallet_users and get session JWT.
 * Supports both SIWE (external wallet) and thirdweb_inapp (OAuth: Google, email, passkey, etc.).
 */

import { SiweMessage } from "siwe";
import { getGatewayOrigin } from "@/lib/api";

export interface BootstrapSession {
  access_token: string;
  expires_in: number;
}

function randomNonce(): string {
  const array = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build EIP-4361 SIWE message for the given address and domain.
 */
export function buildSiweMessage(params: {
  address: string;
  domain: string;
  chainId: number;
  nonce?: string;
  uri?: string;
  statement?: string;
}): string {
  const { address, domain, chainId, nonce = randomNonce(), uri, statement } = params;
  const message = new SiweMessage({
    domain,
    address,
    statement: statement ?? "Sign in to HyperAgent Studio.",
    uri: uri ?? (typeof window !== "undefined" ? window.location.origin : "https://localhost"),
    version: "1",
    chainId,
    nonce,
    issuedAt: new Date().toISOString(),
  });
  return message.prepareMessage();
}

async function callBootstrap(body: {
  authMethod: "siwe" | "thirdweb_inapp";
  walletAddress?: string;
  siwePayload?: { message: string; signature: string };
  authToken?: string;
}): Promise<BootstrapSession> {
  const url = new URL("/api/v1/auth/bootstrap", getGatewayOrigin()).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let detail: string;
    try {
      const j = JSON.parse(text);
      detail = (j as { message?: string }).message ?? text;
    } catch {
      detail = text || res.statusText;
    }
    throw new Error(detail || `Bootstrap failed: ${res.status}`);
  }
  const data = (await res.json()) as BootstrapSession;
  if (!data.access_token || typeof data.expires_in !== "number") {
    throw new Error("Invalid session response");
  }
  return data;
}

/**
 * Bootstrap via SIWE: build message, sign with wallet, send to backend.
 */
export async function bootstrapWithSiwe(params: {
  address: string;
  signMessage: (message: string) => Promise<string>;
}): Promise<BootstrapSession> {
  const domain = typeof window !== "undefined" ? window.location.host : "localhost";
  const chainId = 1;
  const messageBody = buildSiweMessage({ address: params.address, domain, chainId });
  const signature = await params.signMessage(messageBody);
  return callBootstrap({
    authMethod: "siwe",
    siwePayload: { message: messageBody, signature },
  });
}

/**
 * Bootstrap via thirdweb in-app wallet: get auth token, send to backend.
 */
export async function bootstrapWithThirdwebInApp(params: {
  walletAddress: string;
  getAuthToken: () => Promise<string>;
}): Promise<BootstrapSession> {
  const authToken = await params.getAuthToken();
  return callBootstrap({
    authMethod: "thirdweb_inapp",
    walletAddress: params.walletAddress,
    authToken,
  });
}
