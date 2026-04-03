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

const TRANSIENT_BOOTSTRAP_HTTP = new Set([502, 503, 504]);
const BOOTSTRAP_MAX_ATTEMPTS = 3;
const BOOTSTRAP_RETRY_BASE_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callBootstrap(body: {
  authMethod: "siwe" | "thirdweb_inapp";
  walletAddress?: string;
  siwePayload?: { message: string; signature: string };
  authToken?: string;
}): Promise<BootstrapSession> {
  const url = new URL("/api/v1/auth/bootstrap", getGatewayOrigin()).toString();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < BOOTSTRAP_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = (await res.json()) as BootstrapSession;
      if (!data.access_token || typeof data.expires_in !== "number") {
        throw new Error("Invalid session response");
      }
      return data;
    }

    const text = await res.text();
    let detail: string;
    let responseCode: string | undefined;
    try {
      const j = JSON.parse(text) as { message?: string; error?: string; requestId?: string; code?: string };
      detail = (j.message ?? j.error ?? text).trim() || text;
      const c = typeof j.code === "string" ? j.code.trim() : "";
      if (c) {
        responseCode = c;
        if (!detail.toUpperCase().includes(c.toUpperCase())) {
          detail = `${detail} [${c}]`;
        }
      }
    } catch {
      detail = text || res.statusText;
    }
    const requestId =
      res.headers.get("x-request-id") ??
      res.headers.get("X-Request-Id") ??
      (() => {
        try {
          const j = JSON.parse(text) as { requestId?: string };
          return j.requestId;
        } catch {
          return undefined;
        }
      })();
    const suffix = requestId ? ` (requestId=${requestId})` : "";
    const err = new Error((detail || `Bootstrap failed: ${res.status}`) + suffix) as Error & {
      status?: number;
      requestId?: string;
      code?: string;
    };
    err.status = res.status;
    if (requestId) err.requestId = requestId;
    if (responseCode) err.code = responseCode;

    if (TRANSIENT_BOOTSTRAP_HTTP.has(res.status) && attempt < BOOTSTRAP_MAX_ATTEMPTS - 1) {
      lastError = err;
      await sleep(BOOTSTRAP_RETRY_BASE_MS * (attempt + 1));
      continue;
    }
    throw err;
  }

  throw lastError ?? new Error("Bootstrap failed after retries");
}

/**
 * Bootstrap via SIWE: build message, sign with wallet, send to backend.
 */
function studioPublicOriginUrl(): URL | null {
  const raw = process.env.NEXT_PUBLIC_STUDIO_ORIGIN?.trim();
  if (!raw) return null;
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

export async function bootstrapWithSiwe(params: {
  address: string;
  chainId?: number;
  signMessage: (message: string) => Promise<string>;
}): Promise<BootstrapSession> {
  const fixed = studioPublicOriginUrl();
  const domain = fixed?.host ?? (typeof window !== "undefined" ? window.location.host : "localhost");
  const uri =
    fixed?.origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://localhost");
  const chainId = params.chainId ?? 1;
  const messageBody = buildSiweMessage({ address: params.address, domain, chainId, uri });
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
