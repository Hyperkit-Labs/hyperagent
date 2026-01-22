import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { APPROVED_MODELS, ApprovedModelType } from "../config/models";
import * as dotenv from "dotenv";

dotenv.config();

export function getLLM(type: ApprovedModelType) {
    const config = APPROVED_MODELS[type];

    // 1. Anthropic (Claude)
    if (config.provider === "anthropic") {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            console.warn(`  ⚠️ [LLM] ANTHROPIC_API_KEY missing. Skipping ${config.model}.`);
            return null;
        }
        return new ChatAnthropic({
            modelName: config.model,
            temperature: config.temperature,
            anthropicApiKey: apiKey,
            maxTokens: config.maxTokens
        });
    }

    // 2. Google (Gemini)
    if (config.provider === "google") {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            console.warn(`  ⚠️ [LLM] GOOGLE_API_KEY missing. Skipping ${config.model}.`);
            return null;
        }
        return new ChatGoogleGenerativeAI({
            model: config.model,
            temperature: config.temperature,
            apiKey: apiKey,
            maxOutputTokens: config.maxTokens
        });
    }

    // 3. OpenAI (GPT)
    if (config.provider === "openai") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.warn(`  ⚠️ [LLM] OPENAI_API_KEY missing. Skipping ${config.model}.`);
            return null;
        }
        return new ChatOpenAI({
            modelName: config.model,
            temperature: config.temperature,
            openAIApiKey: apiKey,
            maxTokens: config.maxTokens
        });
    }

    // 4. xAI (Grok) - Uses OpenAI SDK compatibility
    if (config.provider === "xai") {
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
            console.warn(`  ⚠️ [LLM] XAI_API_KEY missing. Skipping ${config.model}.`);
            return null;
        }
        return new ChatOpenAI({
            modelName: config.model,
            temperature: config.temperature,
            openAIApiKey: apiKey,
            maxTokens: config.maxTokens,
            configuration: {
                baseURL: "https://api.x.ai/v1"
            }
        });
    }

    return null;
}
