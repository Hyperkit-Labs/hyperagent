import * as publicBuildEnv from "../../scripts/assert-public-build-env.cjs";

const {
  assertStudioPublicBuildEnv,
  isLoopbackHostname,
  isProductionLikeChannel,
  validateStudioPublicBuildEnv,
} = publicBuildEnv;

describe("assert-public-build-env", () => {
  it("recognizes production-like channels", () => {
    expect(isProductionLikeChannel("staging")).toBe(true);
    expect(isProductionLikeChannel("Production")).toBe(true);
    expect(isProductionLikeChannel("development")).toBe(false);
  });

  it("recognizes loopback hosts", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("api.hyperkitlabs.com")).toBe(false);
  });

  it("accepts an explicit non-loopback Studio image build env", () => {
    expect(
      assertStudioPublicBuildEnv({
        NEXT_PUBLIC_API_URL: "https://api.hyperkitlabs.com/api/v1",
        NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "abc123client",
        NEXT_PUBLIC_ENV: "staging",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-key",
      }),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        apiUrl: "https://api.hyperkitlabs.com/api/v1",
        appEnv: "staging",
      }),
    );
  });

  it("rejects missing required variables", () => {
    const result = validateStudioPublicBuildEnv(
      {
        NEXT_PUBLIC_API_URL: "",
        NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "",
      },
      { requireExplicitEnv: true },
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_API_URL is required.",
        "NEXT_PUBLIC_THIRDWEB_CLIENT_ID is required.",
        "NEXT_PUBLIC_ENV is required for Studio image builds.",
      ]),
    );
  });

  it("rejects missing public auth env for production-like channels", () => {
    const result = validateStudioPublicBuildEnv({
      NEXT_PUBLIC_API_URL: "https://api.hyperkitlabs.com/api/v1",
      NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "abc123client",
      NEXT_PUBLIC_ENV: "staging",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_SUPABASE_URL is required.",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is required.",
      ]),
    );
  });

  it("rejects loopback API URLs for production-like channels", () => {
    expect(() =>
      assertStudioPublicBuildEnv({
        NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
        NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "abc123client",
        NEXT_PUBLIC_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-key",
      }),
    ).toThrow("must not point to loopback");
  });

  it("allows loopback API URLs for explicit development image builds", () => {
    expect(
      assertStudioPublicBuildEnv({
        NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
        NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "abc123client",
        NEXT_PUBLIC_ENV: "development",
      }),
    ).toEqual(expect.objectContaining({ ok: true, appEnv: "development" }));
  });
});
