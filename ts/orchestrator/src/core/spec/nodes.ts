/**
 * DESIGN TOKEN: NodeType
 * These are the ONLY valid node types in HyperAgent.
 * Do not invent new types. Use only these.
 */
export type NodeType =
  | "policy" // ERC compliance checking
  | "generate" // LLM-based generation
  | "audit" // Slither audit execution
  | "validate" // Schema validation
  | "deploy" // Thirdweb deployment
  | "eigenda" // EigenDA proof storage
  | "monitor"; // Event monitoring + memory save

/**
 * DESIGN TOKEN: EdgeConnection
 * These are the ONLY valid transitions between nodes.
 * All other transitions are INVALID.
 * Graph enforces these via state machine only.
 */
export const VALID_TRANSITIONS: Record<NodeType, NodeType[]> = {
  policy: ["generate"], // Always → generate
  generate: ["audit"], // Always → audit
  audit: ["validate"], // Always → validate
  validate: ["deploy", "generate"], // → deploy if pass, else loop to generate
  deploy: ["eigenda"], // Always → eigenda
  eigenda: ["monitor"], // Always → monitor
  monitor: [], // Terminal node
};

/**
 * DESIGN TOKEN: Node Input/Output
 * Every node receives the COMPLETE state.
 * Every node returns the COMPLETE state with updates.
 * No partial updates. No selective fields.
 */
export interface NodeDefinition {
  input: "HyperAgentState"; // Type reference, not runtime value
  output: "HyperAgentState"; // Type reference, not runtime value
  maxRetries: number;
  timeoutMs: number;
  nextNode: NodeType | null; // null for terminal nodes
}

/**
 * Node implementation contract
 * Every node must implement this interface
 */
export interface NodeImplementation {
  definition: NodeDefinition;
  execute: (state: import("./state").HyperAgentState) => Promise<import("./state").HyperAgentState>;
}

