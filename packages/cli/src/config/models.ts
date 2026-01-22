export type ModelProvider = "anthropic" | "google" | "openai" | "xai";

export const APPROVED_MODELS = {
    "policy": {
        provider: "google",
        model: "gemini-1.5-flash",
        maxTokens: 8192,
        temperature: 0.1
    },
    "generate": {
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 8192,
        temperature: 0.2
    },
    "audit": {
        provider: "openai",
        model: "gpt-4o",
        maxTokens: 4096,
        temperature: 0.0
    },
    // Extra configurations for user override
    "cheap": {
        provider: "google",
        model: "gemini-1.5-flash",
        maxTokens: 4096,
        temperature: 0.1
    },
    "reasoning": {
        provider: "openai",
        model: "o1-preview",
        maxTokens: 8192,
        temperature: 0.2
    },
    "grok": {
        provider: "xai",
        model: "grok-beta",
        maxTokens: 4096,
        temperature: 0.7
    }
} as const;

export type ApprovedModelType = keyof typeof APPROVED_MODELS;
