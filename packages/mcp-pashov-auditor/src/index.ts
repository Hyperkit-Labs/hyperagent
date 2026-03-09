#!/usr/bin/env node
/**
 * MCP server for Pashov solidity-auditor.
 * Exposes audit_solidity tool for AI agents to perform deep structural analysis.
 * Calls agent-runtime /agents/pashov-audit when AGENT_RUNTIME_URL is set.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const AGENT_RUNTIME_URL = (process.env.AGENT_RUNTIME_URL || "http://localhost:4001").replace(/\/$/, "");

const server = new McpServer({
  name: "pashov-solidity-auditor",
  version: "0.1.0",
});

server.registerTool(
  "audit_solidity",
  {
    description: "Run AI-driven security audit on Solidity contract bundle. Uses pashov/skills solidity-auditor for deep structural analysis and attack vectors.",
    inputSchema: {
      bundle: z.string().describe("Contract bundle: Solidity source(s) + optional judging/report format. Max ~120k chars."),
      apiKeys: z
        .record(z.string())
        .optional()
        .describe("BYOK: anthropic, openai, or google API key for LLM audit. Omit to use agent-runtime session."),
    },
  },
  async ({ bundle, apiKeys }) => {
    try {
      const systemPrompt = `You are a Solidity security auditor. Analyze the provided contract bundle for vulnerabilities.
Focus on: reentrancy, access control, integer overflow, unchecked external calls, front-running, signature replay.
Return findings in the format: [N] **M. Title** \`location\` · Confidence: X% **Description** ...`;
      const userPrompt = `Bundle (${bundle.length} chars):\n\n${bundle.slice(0, 120000)}`;

      const res = await fetch(`${AGENT_RUNTIME_URL}/agents/pashov-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          userPrompt,
          context: {
            userId: "",
            projectId: "",
            runId: "",
            apiKeys: apiKeys || {},
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          content: [{ type: "text" as const, text: `Audit failed: ${res.status} ${text.slice(0, 500)}` }],
          isError: true,
        };
      }

      const data = (await res.json()) as { text?: string };
      const text = data.text || "No findings.";
      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text" as const, text: `Audit error: ${msg}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
