/**
 * Option B: Verify agent session JWT and decrypt api_keys_enc.
 * Keys never in body or logs; only decrypted in memory for this request.
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_ISSUER = "hyperagent-orchestrator";

export interface AgentSessionPayload {
  sub: string;
  run_id: string;
  api_keys_enc: string;
  exp: number;
  iat: number;
  iss: string;
}

export interface ResolvedContext {
  userId: string;
  projectId: string;
  runId: string;
  apiKeys: Record<string, string>;
}

function getPayloadKey(): Buffer {
  const raw = process.env.AGENT_SESSION_PAYLOAD_KEY;
  if (!raw || raw.length < 32) {
    throw new Error("AGENT_SESSION_PAYLOAD_KEY must be set and at least 32 bytes");
  }
  if (raw.length === 32 && /^[\x20-\x7e]+$/.test(raw)) {
    return Buffer.from(raw, "utf-8");
  }
  return Buffer.from(raw, "base64");
}

function decryptApiKeys(encB64: string, key: Buffer): Record<string, string> {
  const raw = Buffer.from(encB64, "base64");
  if (raw.length < 12 + 16) return {};
  const nonce = raw.subarray(0, 12);
  const authTag = raw.subarray(-16);
  const ciphertext = raw.subarray(12, -16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
  return JSON.parse(plain) as Record<string, string>;
}

/**
 * Verify X-Agent-Session JWT and decrypt api_keys. Returns context with apiKeys for this run only.
 */
export function resolveAgentSession(token: string): ResolvedContext | null {
  const secret = process.env.JWT_SECRET_KEY;
  if (!secret) {
    console.warn("[agent-session] JWT_SECRET_KEY not set, skipping JWT resolution");
    return null;
  }
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
    }) as AgentSessionPayload;
    const key = getPayloadKey();
    const apiKeys = decryptApiKeys(payload.api_keys_enc, key);
    const providers = Object.keys(apiKeys).filter((k) => apiKeys[k]?.trim());
    console.info("[agent-session] JWT verified user=%s run=%s providers=%s", payload.sub, payload.run_id, providers.join(",") || "(none)");
    return {
      userId: payload.sub,
      projectId: "",
      runId: payload.run_id,
      apiKeys,
    };
  } catch (err) {
    console.error("[agent-session] JWT resolution failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
