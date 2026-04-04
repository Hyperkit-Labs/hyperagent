import { http, HttpResponse } from "msw";

/**
 * Default handlers for Jest. Extend per test with server.use(...).
 * Match relative to origin; tests may use http://localhost or full NEXT_PUBLIC_API_URL.
 */
export const handlers = [
  http.get("*/api/health", () =>
    HttpResponse.json({ ok: true, service: "mock-gateway" }),
  ),
];
