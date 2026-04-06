describe("studio config environment", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    process.env = { ...OLD_ENV };
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_ENV;
    delete process.env.NEXT_PUBLIC_MONITORING_ENABLED;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("resolves backend URL from canonical NEXT_PUBLIC_API_URL", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_API_URL = "https://api.hyperkitlabs.com";
    const mod = await import("./environment");
    expect(mod.getServiceUrl("backend")).toBe(
      "https://api.hyperkitlabs.com/api/v1",
    );
  });

  it("rewrites remote API to local gateway in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_ENV = "development";
    process.env.NEXT_PUBLIC_API_URL = "https://api.hyperkitlabs.com";
    const mod = await import("./environment");
    expect(mod.getServiceUrl("backend")).toBe("http://localhost:4000/api/v1");
  });

  it("keeps remote API in development when NEXT_PUBLIC_ENV is staging", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_ENV = "staging";
    process.env.NEXT_PUBLIC_API_URL = "https://api.hyperkitlabs.com";
    const mod = await import("./environment");
    expect(mod.getServiceUrl("backend")).toBe(
      "https://api.hyperkitlabs.com/api/v1",
    );
  });

  it("derives orchestrator URL from backend URL", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_API_URL = "https://api.hyperkitlabs.com/api/v1";
    const mod = await import("./environment");
    expect(mod.getServiceUrl("orchestrator")).toBe(
      "https://api.hyperkitlabs.com/api/v2",
    );
  });

  it("parses monitoring feature flag with shared bool semantics", async () => {
    process.env.NEXT_PUBLIC_MONITORING_ENABLED = "yes";
    const mod = await import("./environment");
    expect(mod.isFeatureEnabled("monitoring")).toBe(true);
  });

  it("throws on invalid NEXT_PUBLIC_API_URL format", async () => {
    process.env.NEXT_PUBLIC_API_URL = "not a url";
    const mod = await import("./environment");
    expect(() => mod.getServiceUrl("backend")).toThrow(
      "Invalid NEXT_PUBLIC_API_URL",
    );
  });

  it("falls back to backend URL for unknown services in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_ENV = "development";
    process.env.NEXT_PUBLIC_API_URL = "https://api.hyperkitlabs.com";
    const warn = console.warn as jest.Mock;
    warn.mockClear();
    const mod = await import("./environment");
    expect(mod.getServiceUrl("search")).toBe("http://localhost:4000/api/v1");
    expect(warn).toHaveBeenCalledWith(
      "[config] Unknown service: search, dev fallback: http://localhost:4000/api/v1",
    );
  });

  it("throws for unknown services in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_API_URL = "https://api.hyperkitlabs.com";
    const mod = await import("./environment");
    expect(() => mod.getServiceUrl("search")).toThrow(
      'Unknown service "search" in production. Supported names are: backend, orchestrator.',
    );
  });

  it("lets runtime feature overrides win over static defaults", async () => {
    process.env.NEXT_PUBLIC_MONITORING_ENABLED = "no";
    const mod = await import("./environment");
    expect(mod.isFeatureEnabled("monitoring")).toBe(false);
    mod.setRuntimeFeatures({ monitoring: true, x402: true });
    expect(mod.isFeatureEnabled("monitoring")).toBe(true);
    expect(mod.isFeatureEnabled("x402")).toBe(true);
  });

  it("stores runtime config values without affecting env-derived URLs", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_API_URL = "https://api.hyperkitlabs.com";
    const mod = await import("./environment");

    mod.setRuntimeConfig({
      default_network_id: "skale",
      default_chain_id: 84532,
    });

    expect(mod.getRuntimeConfig("default_network_id")).toBe("skale");
    expect(mod.getRuntimeConfig<number>("default_chain_id")).toBe(84532);
    expect(mod.getServiceUrl("backend")).toBe(
      "https://api.hyperkitlabs.com/api/v1",
    );
  });
});
