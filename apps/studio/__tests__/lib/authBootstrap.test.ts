/**
 * Unit tests: authBootstrap. Error handling, no silent swallow.
 */

import { buildSiweMessage, bootstrapWithSiwe } from "@/lib/authBootstrap";

const MOCK_GATEWAY = "http://localhost:4000";

jest.mock("@/lib/api", () => ({
  getGatewayOrigin: () => MOCK_GATEWAY,
}));

describe("authBootstrap", () => {
  describe("buildSiweMessage", () => {
    it("builds valid SIWE message", () => {
      const msg = buildSiweMessage({
        address: "0x1234567890123456789012345678901234567890",
        domain: "localhost",
        chainId: 1,
      });
      expect(msg).toContain("localhost");
      expect(msg).toContain("0x1234567890123456789012345678901234567890");
      expect(msg).toContain("Chain ID: 1");
    });
  });

  describe("bootstrapWithSiwe error handling", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    const emptyHeaders = { get: () => null } as Response["headers"];

    it("throws on 503 with message after transient retries", async () => {
      globalThis.fetch = async () =>
        ({
          ok: false,
          status: 503,
          headers: emptyHeaders,
          text: async () => JSON.stringify({ message: "Auth not configured" }),
          json: async () => ({ message: "Auth not configured" }),
        }) as Response;

      await expect(
        bootstrapWithSiwe({
          address: "0x1234567890123456789012345678901234567890",
          chainId: 1,
          signMessage: async () => "0xsig",
        })
      ).rejects.toThrow(/Auth not configured|503/);
    });

    it("throws on 401", async () => {
      globalThis.fetch = async () =>
        ({
          ok: false,
          status: 401,
          headers: emptyHeaders,
          text: async () => JSON.stringify({ message: "Invalid signature" }),
          json: async () => ({ message: "Invalid signature" }),
        }) as Response;

      await expect(
        bootstrapWithSiwe({
          address: "0x1234567890123456789012345678901234567890",
          chainId: 1,
          signMessage: async () => "0xbad",
        })
      ).rejects.toThrow();
    });
  });
});
