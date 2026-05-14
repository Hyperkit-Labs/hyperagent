jest.mock("@hyperagent/config", () => ({
  buildStudioConnectSrcDirective: () => "'self'",
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
