import {
  buildUpstreamHeaders,
  sanitizeGatewayPathSegments,
  sessionTokenFromCookieHeader,
} from "@/app/api/gateway/[...path]/route-helpers";

describe("Studio gateway route helpers", () => {
  it("extracts the first-party session token from cookies", () => {
    expect(
      sessionTokenFromCookieHeader(
        "foo=bar; hyperagent_session_token=abc123; Path=/",
      ),
    ).toBe("abc123");
    expect(sessionTokenFromCookieHeader("rt=legacy-token; Path=/")).toBe(
      "legacy-token",
    );
  });

  it("prefers an explicit authorization header over cookie translation", () => {
    const request = {
      headers: new Headers({
        accept: "application/json",
        authorization: "Bearer direct-token",
        cookie: "hyperagent_session_token=cookie-token",
        "x-workspace-id": "ws_123",
      }),
    };
    const headers = buildUpstreamHeaders(request);
    expect(headers.get("authorization")).toBe("Bearer direct-token");
    expect(headers.get("x-workspace-id")).toBe("ws_123");
    expect(headers.get("cookie")).toBeNull();
  });

  it("derives bearer auth from the first-party session cookie when no auth header is present", () => {
    const request = {
      headers: new Headers({
        accept: "*/*",
        cookie:
          "hyperagent_session_token=cookie-token; hyperagent_has_session=1",
      }),
    };
    const headers = buildUpstreamHeaders(request);
    expect(headers.get("authorization")).toBe("Bearer cookie-token");
    expect(headers.get("accept")).toBe("*/*");
    expect(headers.get("cookie")).toBeNull();
  });

  it("treats malformed cookie encoding as no credential", () => {
    expect(
      sessionTokenFromCookieHeader("hyperagent_session_token=%E0%A4%A"),
    ).toBeNull();
  });

  it("sanitizes gateway path segments before proxying upstream", () => {
    expect(
      sanitizeGatewayPathSegments(["api", "v1", "workspaces", "current"]),
    ).toEqual(["api", "v1", "workspaces", "current"]);
    expect(() =>
      sanitizeGatewayPathSegments(["api", "..", "workflows"]),
    ).toThrow("gateway.invalid_path_segment");
    expect(() => sanitizeGatewayPathSegments(["bad segment"])).toThrow(
      "gateway.invalid_path_segment",
    );
  });
});
