import { isExcludedFromStudioEdge } from "../studio-proxy-config";

describe("isExcludedFromStudioEdge", () => {
  it("excludes Next.js and Vercel internals", () => {
    expect(isExcludedFromStudioEdge("/_next/static/chunks/main.js")).toBe(true);
    expect(isExcludedFromStudioEdge("/_vercel/insights/view")).toBe(true);
    expect(isExcludedFromStudioEdge("/.well-known/security.txt")).toBe(true);
  });

  it("excludes common static filenames", () => {
    expect(isExcludedFromStudioEdge("/favicon.ico")).toBe(true);
    expect(isExcludedFromStudioEdge("/robots.txt")).toBe(true);
    expect(isExcludedFromStudioEdge("/manifest.json")).toBe(true);
    expect(isExcludedFromStudioEdge("/icon.png")).toBe(true);
  });

  it("does not exclude app HTML routes", () => {
    expect(isExcludedFromStudioEdge("/")).toBe(false);
    expect(isExcludedFromStudioEdge("/login")).toBe(false);
    expect(isExcludedFromStudioEdge("/dashboard")).toBe(false);
  });
});
