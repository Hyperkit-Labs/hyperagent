export interface AnthropicConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

export async function callAnthropic(
  config: AnthropicConfig,
  messages: AnthropicMessage[],
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const parts = data.content ?? [];
  const combined = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("\n")
    .trim();

  if (!combined) {
    throw new Error("Anthropic API returned empty content");
  }

  return combined;
}


