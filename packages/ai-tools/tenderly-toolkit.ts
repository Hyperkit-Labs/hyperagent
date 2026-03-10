/**
 * TenderlyToolkit: wraps Tenderly simulate API. Use from simulation service or orchestrator clients.
 * API key and URL are passed in; no raw vendor SDK in callers.
 * Supports Single Simulations and Bundled Simulations per https://docs.tenderly.co/simulations/
 */
import type {
  SimulateRequest,
  SimulateTxResult,
  SimulateBundleRequest,
  SimulateBundleResult,
  SimulateBundleTx,
} from "@hyperagent/core-types";

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

  private getSimulateUrl(): string {
    const base = this.baseUrl.replace(/\/$/, "");
    if (this.account && this.project) {
      return `${base}/api/v1/account/${this.account}/project/${this.project}/simulate`;
    }
    return `${base}/api/v1/simulate`;
  }

  private getSimulateBundleUrl(): string {
    const base = this.baseUrl.replace(/\/$/, "");
    if (this.account && this.project) {
      return `${base}/api/v1/account/${this.account}/project/${this.project}/simulate-bundle`;
    }
    return `${base}/api/v1/simulate-bundle`;
  }

  async simulate(tx: SimulateRequest): Promise<SimulateTxResult> {
    const response = await fetch(this.getSimulateUrl(), {
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
    });
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

  /**
   * Bundled Simulations: run multiple transactions consecutively in one block.
   * Use for deploy + initialize() or deploy + first-interaction validation.
   * See https://docs.tenderly.co/simulations/bundled-simulations
   */
  async simulateBundle(req: SimulateBundleRequest): Promise<SimulateBundleResult> {
    const simulations = req.simulations.map((tx: SimulateBundleTx) => ({
      network_id: tx.network_id,
      from: tx.from,
      to: tx.to ?? undefined,
      input: tx.input,
      value: tx.value ?? "0",
      gas: tx.gas ?? 8000000,
      save: tx.save ?? true,
      save_if_fails: tx.save_if_fails ?? true,
      simulation_type: tx.simulation_type ?? "full",
      state_objects: tx.state_objects,
    }));

    const response = await fetch(this.getSimulateBundleUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": this.apiKey,
      },
      body: JSON.stringify({ simulations }),
    });

    const result = (await response.json()) as {
      simulation_results?: Array<{
        transaction?: { status?: boolean; gas_used?: number };
        error?: string;
      }>;
      simulation?: { id?: string };
      error?: string;
    };

    if (!response.ok) {
      return {
        success: false,
        error: result.error ?? "Tenderly simulate-bundle API error",
      };
    }

    const results = result.simulation_results ?? [];
    const allPassed = results.every((r) => r.transaction?.status !== false && !r.error);
    const totalGas = results.reduce((sum, r) => sum + (r.transaction?.gas_used ?? 0), 0);
    const sim = result.simulation;
    const simulationUrl =
      this.account && this.project && sim?.id
        ? `https://dashboard.tenderly.co/${this.account}/${this.project}/simulator/${sim.id}`
        : sim?.id
          ? `https://dashboard.tenderly.co/simulator/${sim.id}`
          : null;

    return {
      success: allPassed,
      gasUsed: totalGas,
      simulations: results.map((r) => ({
        success: r.transaction?.status ?? false,
        gas_used: r.transaction?.gas_used,
        error: r.error,
      })),
      simulationUrl: simulationUrl ?? null,
    };
  }
}
