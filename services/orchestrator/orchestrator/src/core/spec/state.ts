/**
 * DESIGN TOKEN: State Shape
 * This is the COMPLETE state object. Nothing else is added.
 * All 7 fields present on every state transition.
 * No optional fields, no extra properties.
 */
export type HyperAgentStatus =
  | "processing"
  | "auditing"
  | "validating"
  | "deploying"
  | "success"
  | "failed";

/**
 * Core 7-field state from blueprint (unchanged).
 */
export type HyperAgentStateCore = {
  intent: string;
  contract: string;
  auditResults: { passed: boolean; findings: string[] };
  deploymentAddress: string;
  txHash: string;
  status: HyperAgentStatus;
  logs: string[];
};

/**
 * Schema-locked meta extension.
 * This is the ONLY allowed top-level extension beyond the 7 core fields.
 */
export type HyperAgentMetaV1 = {
  version: "v1";
  workflowId: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  execution: {
    step: number;
    maxSteps: number;
  };
  chains: {
    selected: string;
    requested: string[];
  };
  contracts: {
    primaryId: string;
    items: Array<{
      id: string;
      filename: string;
    }>;
  };
  billing: {
    x402Enabled: boolean;
    priceUsd: number;
    paymentRequired: boolean;
  };
};

export type HyperAgentMeta = HyperAgentMetaV1;

/**
 * Full spec-locked state for orchestrator.
 */
export type HyperAgentState = HyperAgentStateCore & {
  meta: HyperAgentMeta;
};

/**
 * Create initial state from user intent
 */
export function initialState(intent: string): HyperAgentState {
  const now = new Date().toISOString();
  const workflowId = `wf_${cryptoRandomId()}`;
  return {
    intent,
    contract: "",
    auditResults: { passed: false, findings: [] },
    deploymentAddress: "",
    txHash: "",
    status: "processing",
    logs: [],
    meta: {
      version: "v1",
      workflowId,
      createdAt: now,
      updatedAt: now,
      execution: {
        step: 0,
        maxSteps: 50,
      },
      chains: {
        selected: "avalanche",
        requested: ["avalanche"],
      },
      contracts: {
        primaryId: "contract_1",
        items: [{ id: "contract_1", filename: "Contract.sol" }],
      },
      billing: {
        x402Enabled: false,
        priceUsd: 0,
        paymentRequired: false,
      },
    },
  };
}

/**
 * Immutable state update helper
 * Returns new state with updates, never mutates original
 */
export function withUpdates(
  state: HyperAgentState,
  patch: Partial<HyperAgentState>,
): HyperAgentState {
  const next: HyperAgentState = { ...state, ...patch };
  next.meta = {
    ...state.meta,
    ...(patch.meta ?? {}),
    updatedAt: new Date().toISOString(),
  } as HyperAgentMeta;
  return next;
}

/**
 * Validate state has all required fields
 */
export function validateStateShape(state: unknown): state is HyperAgentState {
  if (typeof state !== "object" || state === null) {
    return false;
  }

  const s = state as Record<string, unknown>;

  return (
    typeof s.intent === "string" &&
    typeof s.contract === "string" &&
    typeof s.auditResults === "object" &&
    s.auditResults !== null &&
    typeof (s.auditResults as { passed: boolean }).passed === "boolean" &&
    Array.isArray((s.auditResults as { findings: string[] }).findings) &&
    typeof s.deploymentAddress === "string" &&
    typeof s.txHash === "string" &&
    typeof s.status === "string" &&
    ["processing", "auditing", "validating", "deploying", "success", "failed"].includes(
      s.status as string,
    ) &&
    Array.isArray(s.logs) &&
    s.logs.every((log) => typeof log === "string") &&
    typeof s.meta === "object" &&
    s.meta !== null &&
    typeof (s.meta as { version: string }).version === "string"
  );
}

function cryptoRandomId(): string {
  // Avoid Node-only crypto imports in this package. This is deterministic enough for IDs.
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

