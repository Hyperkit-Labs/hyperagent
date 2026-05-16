jest.mock("@hyperagent/config", () => ({
  buildStudioConnectSrcDirective: () => "'self'",
}));

jest.mock("next/server", () => ({
  NextResponse: {
    next: jest.fn(() => ({
      headers: new Headers(),
    })),
    redirect: jest.fn(() => ({
      headers: new Headers(),
    })),
    json: jest.fn(() => ({
      headers: new Headers(),
    })),
  },
}));

import { getRequestSessionToken } from "@/proxy";

describe("Studio proxy session token resolution", () => {
  it("accepts the gateway rt cookie as a valid session token source", () => {
    const request = {
      headers: new Headers(),
      cookies: {
        get: (name: string) =>
          name === "rt" ? { value: "rt-cookie-token" } : undefined,
      },
    };

    expect(getRequestSessionToken(request as never)).toBe("rt-cookie-token");
  });
});
