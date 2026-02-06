/**
 * DESIGN TOKEN: LLM Model Map
 * These are the ONLY LLM endpoints.
 * Other models are REJECTED at runtime.
 */
export type LLMProvider = "anthropic" | "openai" | "google";

export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  maxTokens: number;
  temperature: number;
}

export const APPROVED_MODELS: Record<string, ModelConfig> = {
  generate: {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    maxTokens: 8192,
    temperature: 0.2,
  },
  audit: {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    maxTokens: 4096,
    temperature: 0.0,
  },
};

/**
 * Get model config for a node type
 * Throws if node type doesn't have an approved model
 */
export function getModelConfig(nodeType: string): ModelConfig {
  const config = APPROVED_MODELS[nodeType];
  if (!config) {
    throw new Error(`No approved model for node type: ${nodeType}`);
  }
  return config;
}

