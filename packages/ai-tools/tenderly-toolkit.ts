/**
 * TenderlyToolkit: wraps Tenderly simulate API. Use from simulation service or orchestrator clients.
 * API key and URL are passed in; no raw vendor SDK in callers.
 */
import type { SimulateRequest, SimulateTxResult } from "@hyperagent/core-types";

export interface TenderlyToolkitOptions {
  apiKey: string;
  baseUrl?: string;
  account?: string;
  project?: string;
}

export class TenderlyToolkit {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.tenderly.co",
    private readonly account?: string,
    private readonly project?: string
  ) {}

  async simulate(tx: SimulateRequest): Promise<SimulateTxResult> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, "")}/api/v1/simulate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Access-Key": this.apiKey,
        },
        body: JSON.stringify({
          network_id: tx.network,
          from: tx.from,
          to: tx.to ?? undefined,
          input: tx.data,
          value: tx.value ?? "0",
          save: true,
          save_if_fails: true,
        }),
      }
    );
    const result = (await response.json()) as {
      transaction?: {
        status?: boolean;
        gas_used?: number;
        transaction_info?: { call_trace?: unknown };
      };
      simulation?: { id?: string };
      error?: string;
    };
    if (!response.ok) {
      return {
        success: false,
        error: result.error ?? "Tenderly API error",
      };
    }
    const t = result.transaction;
    const sim = result.simulation;
    const simulationUrl =
      this.account && this.project && sim?.id
        ? `https://dashboard.tenderly.co/${this.account}/${this.project}/simulator/${sim.id}`
        : sim?.id
          ? `https://dashboard.tenderly.co/simulator/${sim.id}`
          : null;
    return {
      success: t?.status ?? false,
      gasUsed: t?.gas_used ?? 0,
      traces: t?.transaction_info?.call_trace ?? undefined,
      simulationUrl: simulationUrl ?? null,
    };
  }
}
