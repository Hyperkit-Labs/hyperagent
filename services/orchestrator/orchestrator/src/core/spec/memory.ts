/**
 * DESIGN TOKEN: Memory Layer Architecture
 * EXACTLY 3 layers, no more, no fewer.
 */
export type MemoryLayer = "volatile" | "persistent" | "immutable";

export interface MemoryLayerConfig {
  storage: string;
  duration: string;
  backend: string;
  query: string;
}

export const MEMORY_LAYERS: Record<MemoryLayer, MemoryLayerConfig> = {
  volatile: {
    storage: "LangGraph state object",
    duration: "5 minutes (execution lifetime)",
    backend: "in-memory",
    query: "read-write on every node",
  },
  persistent: {
    storage: "Chroma vector database",
    duration: "1 month rolling window",
    backend: "http://localhost:8000",
    query: "semantic similarity search via embeddings",
  },
  immutable: {
    storage: "Pinata IPFS",
    duration: "5+ years",
    backend: "https://api.pinata.cloud",
    query: "content-addressed by CID",
  },
};

/**
 * DESIGN TOKEN: Memory Query Interface
 * ONLY these operations. No custom queries.
 */
export type MemoryOperation =
  | "store_contract" // Save to Chroma
  | "find_similar" // Search Chroma by intent
  | "get_patterns" // Aggregate Chroma results
  | "pin_to_ipfs" // Save to Pinata
  | "fetch_from_ipfs"; // Load from Pinata via CID

/**
 * DESIGN TOKEN: Memory Integration Points
 * EXACTLY where memory is called in the graph.
 * NOT in other nodes.
 */
export interface MemoryIntegrationPoint {
  operation: MemoryOperation;
  input: string;
  output: string;
  usage: string;
}

export const MEMORY_INTEGRATION_POINTS: Record<string, MemoryIntegrationPoint> = {
  generate: {
    operation: "find_similar",
    input: "state.intent",
    output: "results: []",
    usage: "Enhance LLM prompt with reference contracts",
  },
  monitor: {
    operation: "store_contract",
    input: "state (full)",
    output: "success: boolean",
    usage: "Save successful deployment to Chroma",
  },
  eigenda: {
    operation: "pin_to_ipfs",
    input: "contract + auditResults",
    output: "cid: string",
    usage: "Store proof on Pinata",
  },
};

