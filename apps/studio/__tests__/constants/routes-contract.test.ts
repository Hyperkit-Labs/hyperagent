import {
  getStudioShellMode,
  isPublicStudioApiPath,
  isProtectedStudioRoute,
  isPublicStudioRoute,
  LEGACY_ROUTE_REDIRECTS,
  ROUTES,
} from "@/constants/routes";

describe("Studio route contract", () => {
  it("keeps login public and home protected", () => {
    expect(isPublicStudioRoute(ROUTES.LOGIN)).toBe(true);
    expect(isProtectedStudioRoute(ROUTES.LOGIN)).toBe(false);
    expect(isProtectedStudioRoute(ROUTES.HOME)).toBe(true);
  });

  it("assigns the expected shell modes", () => {
    expect(getStudioShellMode(ROUTES.LOGIN)).toBe("public");
    expect(getStudioShellMode(ROUTES.HOME)).toBe("shellless");
    expect(getStudioShellMode(ROUTES.DASHBOARD)).toBe("shared");
  });

  it("covers dynamic protected routes", () => {
    expect(isProtectedStudioRoute("/workflows/demo-workflow")).toBe(true);
    expect(isProtectedStudioRoute("/apps/demo-app")).toBe(true);
  });

  it("tracks legacy redirect sources as protected routes", () => {
    expect(LEGACY_ROUTE_REDIRECTS["/chat"]).toBe(ROUTES.HOME);
    expect(LEGACY_ROUTE_REDIRECTS["/logs"]).toBe(ROUTES.MONITORING);
    expect(isProtectedStudioRoute("/chat")).toBe(true);
    expect(isProtectedStudioRoute("/logs")).toBe(true);
  });

  it("keeps the public studio API paths in the shared contract", () => {
    expect(isPublicStudioApiPath("/api/auth/callback")).toBe(true);
    expect(isPublicStudioApiPath("/api/gateway-health/signin")).toBe(true);
    expect(isPublicStudioApiPath("/api/v1/config")).toBe(false);
  });
});
