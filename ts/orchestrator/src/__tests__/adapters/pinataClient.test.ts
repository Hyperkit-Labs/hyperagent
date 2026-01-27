import { PinataClient } from "../../adapters/memory/pinataClient";

// Mock fetch globally
global.fetch = jest.fn();

describe("PinataClient", () => {
  let client: PinataClient;

  beforeEach(() => {
    client = new PinataClient({
      apiKey: "test-api-key",
      apiSecret: "test-api-secret",
    });
    (global.fetch as jest.Mock).mockClear();
  });

  it("should pin JSON to IPFS", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        IpfsHash: "QmTestCID123",
        PinSize: 1024,
        Timestamp: "2024-01-01T00:00:00Z",
      }),
    });

    const cid = await client.pinJSONToIPFS({ test: "data" });

    expect(cid).toBe("QmTestCID123");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/pinJSONToIPFS"),
      expect.any(Object),
    );
  });

  it("should fetch from IPFS", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ test: "data" }),
    });

    const data = await client.fetchFromIPFS("QmTestCID123");

    expect(data).toEqual({ test: "data" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ipfs/QmTestCID123"),
      expect.any(Object),
    );
  });

  it("should check if configured", () => {
    expect(client.isConfigured()).toBe(true);

    const unconfigured = new PinataClient();
    expect(unconfigured.isConfigured()).toBe(false);
  });

  it("should throw error when credentials missing", async () => {
    const unconfigured = new PinataClient();

    await expect(unconfigured.pinJSONToIPFS({})).rejects.toThrow(
      "Pinata API credentials not configured",
    );
  });

  it("should handle IPFS fetch errors", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(client.fetchFromIPFS("invalid-cid")).rejects.toThrow();
  });
});

