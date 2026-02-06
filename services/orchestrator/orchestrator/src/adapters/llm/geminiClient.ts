import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface GeminiMessage {
  role: "user" | "model";
  content: string;
}

/**
 * Call Google Gemini API
 * Returns the generated text content
 */
export async function callGemini(
  config: GeminiConfig,
  messages: GeminiMessage[]
): Promise<string> {
  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({ 
    model: config.model,
    generationConfig: {
      maxOutputTokens: config.maxTokens,
      temperature: config.temperature,
    },
  });

  // Convert messages to Gemini format
  const history = messages.slice(0, -1).map(msg => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const lastMessage = messages[messages.length - 1];
  
  if (history.length > 0) {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
  } else {
    const result = await model.generateContent(lastMessage.content);
    return result.response.text();
  }
}
