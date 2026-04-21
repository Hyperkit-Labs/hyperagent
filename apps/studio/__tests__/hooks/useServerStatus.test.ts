/** Importing the hook module loads @/lib/api (thirdweb / ESM deps). Mock before import. */
jest.mock("@/lib/api", () => ({
  getApiBase: jest.fn(() => "http://localhost:4000/api/v1"),
}));

import { interpretHealthResponse } from "@/hooks/useServerStatus";

function makeResponse(
  ok: boolean,
  status: number,
  body: object = {},
): Response {
  const text = () => Promise.resolve(JSON.stringify(body));
  return { ok, status, text } as Response;
}

describe("interpretHealthResponse", () => {
  it("treats non-2xx degraded with auth_signin_ready true as degraded", () => {
    const res = makeResponse(false, 503, {
      status: "degraded",
      auth_signin_ready: true,
    });
    expect(
      interpretHealthResponse(res, {
        status: "degraded",
        auth_signin_ready: true,
      }),
    ).toBe("degraded");
  });

  it("treats non-2xx degraded with sign-in unavailable as signin_unavailable", () => {
    const res = makeResponse(false, 503, {
      status: "degraded",
      auth_signin_ready: false,
    });
    expect(
      interpretHealthResponse(res, {
        status: "degraded",
        auth_signin_ready: false,
      }),
    ).toBe("signin_unavailable");
  });
});
