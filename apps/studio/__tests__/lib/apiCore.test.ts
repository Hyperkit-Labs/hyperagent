import { fetchJson, setAuthHeaderProvider } from "@/lib/api/core";

jest.mock("@/config/environment", () => ({
  getServiceUrl: () => "https://api.hyperkitlabs.com/api/v1",
}));

describe("fetchJson request shaping", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    setAuthHeaderProvider(null);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "https://ai.hyperkitlabs.com" } },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      // @ts-expect-error test cleanup for Node runtime
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
    setAuthHeaderProvider(null);
  });

  function okResponse(body: unknown = {}): Response {
    return {
      ok: true,
      json: async () => body,
    } as Response;
  }

  it("does not force auth or content-type on browser GET requests", async () => {
    const fetchMock = jest.fn(async () => okResponse({ ok: true }));
    globalThis.fetch = fetchMock as typeof fetch;
    setAuthHeaderProvider(async () => ({ Authorization: "Bearer test-token" }));

    await fetchJson("/config");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.credentials).toBe("include");
    expect(options.headers).toEqual({});
  });

  it("adds auth and content-type for browser POST requests with a body", async () => {
    const fetchMock = jest.fn(async () => okResponse({ ok: true }));
    globalThis.fetch = fetchMock as typeof fetch;
    setAuthHeaderProvider(async () => ({ Authorization: "Bearer test-token" }));

    await fetchJson("/workspaces/current/llm-keys", {
      method: "POST",
      body: JSON.stringify({ keys: { openai: "sk-test" } }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.credentials).toBe("include");
    expect(options.headers).toEqual({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    });
  });
});
