/**
 * Sign-In with Ethereum (SIWE): build message, exchange signature for our JWT.
 * Gateway verifies SIWE, upserts wallet_users, returns access_token and expires_in.
 * Supabase Auth is not used; Supabase is database-only.
 */

import { SiweMessage } from "siwe";
import { getApiBase } from "@/lib/api";

export interface SiweSession {
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

/**
 * Exchange SIWE message + signature for our JWT. Does not send Authorization header.
 */
export async function exchangeSiweForSession(message: string, signature: string): Promise<SiweSession> {
  const base = getApiBase();
  const res = await fetch(`${base}/auth/siwe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message, signature }),
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
    throw new Error(detail || `SIWE exchange failed: ${res.status}`);
  }
  const data = (await res.json()) as SiweSession;
  if (!data.access_token || typeof data.expires_in !== "number") {
    throw new Error("Invalid session response");
  }
  return data;
}
