/**
 * Simulation service backend: uses shared toolkit from @hyperagent/ai-tools.
 * Types from @hyperagent/core-types; implementation is TenderlyToolkit.
 */
import type { SimulateRequest, SimulateTxResult } from "@hyperagent/core-types";
import { TenderlyToolkit } from "@hyperagent/ai-tools";

export type { SimulateRequest, SimulateTxResult };

export interface ISimulationBackend {
  simulate(tx: SimulateRequest): Promise<SimulateTxResult>;
}

export function createDefaultBackend(): ISimulationBackend | null {
  const key = process.env.TENDERLY_API_KEY;
  if (!key) return null;
  return new TenderlyToolkit(
    key,
    process.env.TENDERLY_API_URL || "https://api.tenderly.co",
    process.env.TENDERLY_ACCOUNT,
    process.env.TENDERLY_PROJECT
  );
}
