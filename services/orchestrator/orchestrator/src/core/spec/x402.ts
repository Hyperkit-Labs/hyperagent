/**
 * DESIGN TOKEN: x402 Metering (ERC-7732)
 * EXACTLY how we meter costs.
 */
export interface X402MeteringConfig {
  cost: number;
  unit: string;
}

export const X402_METERING: Record<string, X402MeteringConfig> = {
  policy_check: { cost: 0.001, unit: "per intent" },
  generation: { cost: 0.05, unit: "per contract" },
  audit: { cost: 0.02, unit: "per contract" },
  deployment: { cost: 0.1, unit: "per deployment" },
  storage: { cost: 0.01, unit: "per month" },
};

/**
 * Calculate cost for a node operation
 */
export function getNodeCost(nodeType: string): number {
  const mapping: Record<string, string> = {
    policy: "policy_check",
    generate: "generation",
    audit: "audit",
    deploy: "deployment",
    validate: "policy_check", // Validation is cheap
    eigenda: "storage",
    monitor: "storage",
  };

  const meterKey = mapping[nodeType];
  if (!meterKey) {
    return 0;
  }

  const config = X402_METERING[meterKey];
  return config ? config.cost : 0;
}

