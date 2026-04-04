/**
 * Deterministic input guardrail: blocks malicious prompts before they reach the LLM.
 * Mirrors services/orchestrator/input_guardrail.py deny-list for defense in depth.
 */

const FORBIDDEN_TERMS: readonly string[] = [
  "ignore instructions",
  "ignore previous",
  "ignore all",
  "disregard instructions",
  "disregard previous",
  "forget everything",
  "forget your instructions",
  "system_override",
  "system override",
  "override system",
  "bypass",
  "jailbreak",
  "new instructions",
  "you are now",
  "pretend you are",
  "act as if",
  "drop table",
  "drop database",
  "delete all",
  "delete database",
  "truncate table",
  "exec(",
  "eval(",
  "execute(",
  "rm -rf",
  "format c:",
  "reveal your prompt",
  "show your prompt",
  "repeat your instructions",
  "output your system prompt",
  "what are your instructions",
  "developer mode",
  "dan mode",
  "do anything now",
];

export interface GuardrailResult {
  passed: boolean;
  violation?: string;
}

export function validateInput(userPrompt: string): GuardrailResult {
  if (!userPrompt || typeof userPrompt !== "string") {
    return { passed: false, violation: "Empty or invalid input" };
  }
  const text = userPrompt.trim();
  if (!text) {
    return { passed: false, violation: "Empty input" };
  }
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term.toLowerCase())) {
      return {
        passed: false,
        violation:
          "Security policy violation: input contains prohibited content",
      };
    }
  }
  return { passed: true };
}
