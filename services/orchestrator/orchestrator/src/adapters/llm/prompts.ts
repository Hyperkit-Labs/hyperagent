export function buildContractPrompt(intent: string, references: string[] = []): string {
  const refBlock =
    references.length > 0
      ? `\n\nReference contracts:\n${references.map((r, i) => `[${i + 1}]\n${r}`).join("\n\n")}\n`
      : "";

  return [
    "Generate a Solidity smart contract from the user intent.",
    "Requirements:",
    "- Output Solidity code only.",
    "- Use pragma solidity ^0.8.0;",
    "- Avoid selfdestruct and delegatecall.",
    "- Keep it minimal and compilable.",
    "",
    `User intent: ${intent}`,
    refBlock,
  ].join("\n");
}


