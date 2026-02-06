import { ChromaClient } from "../../adapters/memory/chromaClient";

// Mock fetch globally
global.fetch = jest.fn();

describe("ChromaClient", () => {
  let client: ChromaClient;

  beforeEach(() => {
    client = new ChromaClient({
      baseUrl: "http://localhost:8000",
      collectionName: "test_collection",
    });
    (global.fetch as jest.Mock).mockClear();
  });

  it("should find similar contracts", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ids: [["doc1", "doc2"]],
        documents: [["contract1", "contract2"]],
        metadatas: [[{}, {}]],
        distances: [[0.1, 0.2]],
      }),
    });

    const results = await client.findSimilar("test query", 2);

    expect(results).toHaveLength(2);
    expect(results[0].content).toBe("contract1");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/query"),
      expect.any(Object),
    );
  });

  it("should store contract", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await client.storeContract("contract code", { workflowId: "test" });

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/add"),
      expect.any(Object),
    );
  });

  it("should handle API errors", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(client.findSimilar("query", 5)).rejects.toThrow();
  });

  it("should use OpenAI embeddings when API key is available", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(1536).fill(0.1) }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ids: [["doc1"]],
          documents: [["contract1"]],
          metadatas: [[{}]],
          distances: [[0.1]],
        }),
      });

    const results = await client.findSimilar("test query", 1);

    expect(results).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2); // Embedding + query

    delete process.env.OPENAI_API_KEY;
  });
});

