/**
 * Chroma vector database client
 * Implements MEMORY_INTEGRATION_POINTS operations for persistent memory layer
 * 
 * Spec: MEMORY_LAYERS.persistent.backend = "http://localhost:8000"
 */

import { MEMORY_INTEGRATION_POINTS } from "../../core/spec/memory";
import { config as envConfig } from "../../config/env";
import { MEMORY_CONFIG } from "../../core/constants";
import { NetworkError, MemoryStorageError } from "../../core/errors";

export interface ChromaDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface ChromaSearchResult {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  distance?: number;
}

export interface ChromaClientConfig {
  baseUrl?: string;
  collectionName?: string;
  apiKey?: string;
}

const DEFAULT_CONFIG: Required<ChromaClientConfig> = {
  baseUrl: envConfig.CHROMA_BASE_URL,
  collectionName: MEMORY_CONFIG.CHROMA_COLLECTION_NAME,
  apiKey: "",
};

/**
 * Chroma vector database client
 * Implements find_similar and store_contract operations
 */
export class ChromaClient {
  private config: Required<ChromaClientConfig>;
  private collectionName: string;

  constructor(config: ChromaClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.collectionName = this.config.collectionName;
  }

  /**
   * Find similar contracts by intent (MEMORY_INTEGRATION_POINTS.generate)
   * Uses semantic similarity search via embeddings
   */
  async findSimilar(
    queryText: string,
    limit: number = 5,
  ): Promise<ChromaSearchResult[]> {
    try {
      // Generate embedding for query text
      // For now, we'll use a simple text-based approach
      // In production, integrate with OpenAI embeddings API or local model
      const queryEmbedding = await this.generateEmbedding(queryText);

      // Query Chroma API
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/collections/${this.collectionName}/query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey && { "X-Api-Key": this.config.apiKey }),
          },
          body: JSON.stringify({
            query_embeddings: [queryEmbedding],
            n_results: limit,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new NetworkError(
          `Chroma query failed: ${errorText}`,
          `${this.config.baseUrl}/api/v1/collections/${this.collectionName}/query`,
          response.status,
        );
      }

      const data = await response.json() as {
        ids?: string[][];
        documents?: string[][];
        metadatas?: Record<string, unknown>[][];
        distances?: number[][];
      };
      
      // Transform Chroma response to our format
      const results: ChromaSearchResult[] = [];
      if (data.ids && data.ids[0]) {
        for (let i = 0; i < data.ids[0].length; i++) {
          results.push({
            id: data.ids[0][i],
            content: data.documents?.[0]?.[i] || "",
            metadata: data.metadatas?.[0]?.[i] || {},
            distance: data.distances?.[0]?.[i],
          });
        }
      }

      return results;
    } catch (error) {
      // Graceful degradation: return empty results if Chroma is unavailable
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Chroma] findSimilar failed: ${message}. Returning empty results.`);
      return [];
    }
  }

  /**
   * Store contract to Chroma (MEMORY_INTEGRATION_POINTS.monitor)
   * Saves contract code with metadata for future similarity search
   */
  async storeContract(
    contractCode: string,
    metadata: Record<string, any> = {},
  ): Promise<boolean> {
    try {
      // Generate embedding for contract code
      const embedding = await this.generateEmbedding(contractCode);

      // Generate unique ID
      const id = `${metadata.contractHash || "contract"}_${Date.now()}`;

      // Ensure collection exists
      await this.ensureCollection();

      // Add document to Chroma
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/collections/${this.collectionName}/add`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey && { "X-Api-Key": this.config.apiKey }),
          },
          body: JSON.stringify({
            ids: [id],
            embeddings: [embedding],
            documents: [contractCode],
            metadatas: [metadata],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new MemoryStorageError(
          `Chroma store failed: ${errorText}`,
          "chroma",
          {
            statusCode: response.status,
            url: `${this.config.baseUrl}/api/v1/collections/${this.collectionName}/add`,
          },
        );
      }

      return true;
    } catch (error) {
      // Graceful degradation: log error but don't fail the workflow
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Chroma] storeContract failed: ${message}. Continuing without storage.`);
      return false;
    }
  }

  /**
   * Get patterns (aggregate Chroma results)
   * Returns common patterns from stored contracts
   */
  async getPatterns(limit: number = 10): Promise<ChromaSearchResult[]> {
    try {
      // Query for all documents and aggregate patterns
      // This is a simplified implementation
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/collections/${this.collectionName}/get`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey && { "X-Api-Key": this.config.apiKey }),
          },
          body: JSON.stringify({
            limit,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Chroma get failed: ${response.status}`);
      }

      const data = await response.json() as {
        ids?: string[];
        documents?: string[];
        metadatas?: Record<string, unknown>[];
      };
      const results: ChromaSearchResult[] = [];

      if (data.ids) {
        for (let i = 0; i < data.ids.length; i++) {
          results.push({
            id: data.ids[i],
            content: data.documents?.[i] || "",
            metadata: data.metadatas?.[i] || {},
          });
        }
      }

      return results;
    } catch (error) {
      console.warn(`[Chroma] getPatterns failed: ${error}`);
      return [];
    }
  }

  /**
   * Ensure collection exists, create if not
   */
  private async ensureCollection(): Promise<void> {
    try {
      // Check if collection exists
      const getResponse = await fetch(
        `${this.config.baseUrl}/api/v1/collections/${this.collectionName}`,
        {
          method: "GET",
          headers: {
            ...(this.config.apiKey && { "X-Api-Key": this.config.apiKey }),
          },
        },
      );

      if (getResponse.ok) {
        // Collection exists
        return;
      }

      // Create collection if it doesn't exist
      const createResponse = await fetch(
        `${this.config.baseUrl}/api/v1/collections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey && { "X-Api-Key": this.config.apiKey }),
          },
          body: JSON.stringify({
            name: this.collectionName,
            metadata: {},
          }),
        },
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create Chroma collection: ${errorText}`);
      }
    } catch (error) {
      // If collection check/creation fails, we'll try to add documents anyway
      // Chroma might auto-create collections
      console.warn(`[Chroma] ensureCollection failed: ${error}`);
    }
  }

  /**
   * Generate embedding for text
   * 
   * Uses OpenAI embeddings API when OPENAI_API_KEY is configured.
   * Falls back to zero vector placeholder when API key is not available.
   * 
   * Future enhancement: Support local embedding models for offline operation
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Placeholder: return zero vector
    // In production, call OpenAI text-embedding-3-large or similar
    // Dimension: 1536 for OpenAI, 768 for smaller models
    
    const apiKey = envConfig.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "text-embedding-3-large",
            input: text,
          }),
        });

        if (response.ok) {
          const data = await response.json() as { data: Array<{ embedding: number[] }> };
          return data.data[0].embedding;
        }
      } catch (error) {
        console.warn(`[Chroma] OpenAI embedding failed: ${error}. Using placeholder.`);
      }
    }

    // Fallback: return zero vector
    return new Array(MEMORY_CONFIG.EMBEDDING_DIMENSION_OPENAI).fill(0);
  }
}

/**
 * Create Chroma client with default config
 */
export function createChromaClient(config?: ChromaClientConfig): ChromaClient {
  return new ChromaClient(config);
}

