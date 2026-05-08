import {
  buildUpstreamHeaders,
  sessionTokenFromCookieHeader,
} from "@/app/api/gateway/[...path]/route-helpers";

describe("buildUpstreamHeaders", () => {
  it("forwards traceparent when present", () => {
    const h = new Headers();
    h.set(
      "traceparent",
      "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    );
    h.set("authorization", "Bearer tok");
    const out = buildUpstreamHeaders({ headers: h });
    expect(out.get("traceparent")).toBe(
      "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    );
    expect(out.get("authorization")).toBe("Bearer tok");
  });

  it("maps session cookie to Authorization when no auth header", () => {
    const cookie =
      "hyperagent_session_token=" + encodeURIComponent("jwt-here") + "; Path=/";
    const h = new Headers();
    h.set("cookie", cookie);
    const out = buildUpstreamHeaders({ headers: h });
    expect(out.get("authorization")).toBe("Bearer jwt-here");
  });
});

describe("sessionTokenFromCookieHeader", () => {
  it("returns null for empty cookie", () => {
    expect(sessionTokenFromCookieHeader(null)).toBeNull();
  });
});
