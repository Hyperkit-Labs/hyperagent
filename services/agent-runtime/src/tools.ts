/**
 * Agent tools: call audit, compile, storage, simulation, deploy via env URLs.
 *
 * Simulation and IPFS are delegated to simulateDeploy.ts (canonical typed implementation).
 * This module owns audit, compile, and high-level deploy, plus re-exports for convenience.
 */
import { simulate, pin } from "./simulateDeploy.js";
import type { SimulateTxResult } from "@hyperagent/core-types";

const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || "http://localhost:8001";
const COMPILE_SERVICE_URL = process.env.COMPILE_SERVICE_URL || "http://localhost:8004";
const DEPLOY_SERVICE_URL = process.env.DEPLOY_SERVICE_URL || "http://localhost:8003";

async function checkedFetch(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; message?: string; detail?: string };
      detail = body.error || body.message || body.detail || detail;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) detail = text.slice(0, 300);
    }
    throw new Error(`${url.split("/").pop()} failed: ${detail}`);
  }
  return res.json();
}

export async function runSlither(contractCode: string, contractName: string): Promise<{ findings: Array<{ severity: string; title: string; description: string; location?: string }> }> {
  const data = await checkedFetch(`${AUDIT_SERVICE_URL}/audit/slither`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractCode, contractName }),
  });
  const arr = Array.isArray(data) ? data : ((data as Record<string, unknown>).findings ?? data);
  return { findings: Array.isArray(arr) ? arr : [] };
}

export async function compileContract(contractCode: string, framework: "hardhat" | "foundry"): Promise<{ success: boolean; bytecode?: string; abi?: unknown[]; errors?: string[] }> {
  return checkedFetch(`${COMPILE_SERVICE_URL}/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractCode, framework }),
  }) as Promise<{ success: boolean; bytecode?: string; abi?: unknown[]; errors?: string[] }>;
}

/** Delegates to simulateDeploy.pin (canonical IPFS path). */
export async function storeOnIPFS(content: string, name: string): Promise<{ cid: string; gatewayUrl: string }> {
  return pin({ content, name });
}

/** Delegates to simulateDeploy.simulate (canonical Tenderly path). */
export async function tenderlySim(params: { network: string; from: string; to: string; data: string; value?: string }): Promise<SimulateTxResult> {
  return simulate({
    network: params.network,
    from: params.from,
    to: params.to,
    data: params.data,
    value: params.value ?? "0",
  });
}

export interface DeployPlanResult {
  rpcUrl?: string;
  explorerUrl?: string;
  bytecode?: string;
  abi?: unknown[];
  constructorArgs?: unknown[];
  address?: string;
  transactionHash?: string;
}

export async function deployContract(params: { chainId: number; bytecode: string; abi: unknown[]; constructorArgs?: unknown[] }): Promise<DeployPlanResult> {
  return checkedFetch(`${DEPLOY_SERVICE_URL}/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }) as Promise<DeployPlanResult>;
}
