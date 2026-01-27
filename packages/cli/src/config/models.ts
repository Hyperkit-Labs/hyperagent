// Model Configuration v4.1
export type ModelProvider = "google" | "openai" | "xai";

export const APPROVED_MODELS = {
    "policy": {
        provider: "google",
        model: "gemini-2.5-flash-lite",
        maxTokens: 8192,
        temperature: 0.1
    },
    "generate": {
        provider: "google",
        model: "gemini-2.5-flash-lite",
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
