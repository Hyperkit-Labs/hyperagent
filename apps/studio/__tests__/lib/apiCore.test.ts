import {
  AUTH_ERROR_MESSAGE,
  fetchJson,
  setAuthHeaderProvider,
  setOn401Callback,
} from "@/lib/api/core";

jest.mock("@/config/environment", () => ({
  getServiceUrl: () => "https://api.hyperkitlabs.com/api/v1",
}));

describe("fetchJson request shaping", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setAuthHeaderProvider(null);
    setOn401Callback(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setAuthHeaderProvider(null);
    setOn401Callback(null);
  });

  function okResponse(body: unknown = {}): Response {
    return {
      ok: true,
      json: async () => body,
    } as Response;
  }

  it("keeps auth on browser GET requests but skips content-type without a body", async () => {
    const fetchMock = jest.fn(async () => okResponse({ ok: true }));
    globalThis.fetch = fetchMock as typeof fetch;
    setAuthHeaderProvider(async () => ({ Authorization: "Bearer test-token" }));

    await fetchJson("/config");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.credentials).toBe("include");
    expect(options.headers).toEqual({
      Authorization: "Bearer test-token",
    });
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

  it("passes 401 context to the global unauthorized callback", async () => {
    const on401 = jest.fn();
    setOn401Callback(on401);
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () =>
        JSON.stringify({
          message: "Invalid or expired token",
          code: "unauthorized.invalid_token",
          requestId: "req-401",
        }),
      headers: new Headers({
        "x-request-id": "req-401",
      }),
    })) as typeof fetch;

    // Outer catch normalizes 401 to AUTH_ERROR_MESSAGE for consistent UI copy;
    // on401 still receives the gateway body message below.
    await expect(
      fetchJson("/workflows", {
        invokeGlobal401OnUnauthorized: true,
      }),
    ).rejects.toThrow(AUTH_ERROR_MESSAGE);

    expect(on401).toHaveBeenCalledWith({
      path: "/workflows",
      status: 401,
      code: "unauthorized.invalid_token",
      requestId: "req-401",
      message: "Invalid or expired token",
    });
  });
});
