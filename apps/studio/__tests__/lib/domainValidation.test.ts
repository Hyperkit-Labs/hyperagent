import {
  normalizeDomainInput,
  validateDomainInput,
} from "@/lib/domainValidation";

describe("domainValidation", () => {
  it("normalizes casing and trailing dots", () => {
    expect(normalizeDomainInput(" Example.COM. ")).toBe("example.com");
  });

  it("rejects malformed domains", () => {
    expect(validateDomainInput("https://example.com")).toContain("hostname");
    expect(validateDomainInput("localhost")).toContain("fully qualified");
    expect(validateDomainInput("bad_domain.com")).toContain("Invalid");
  });

  it("accepts valid domains", () => {
    expect(validateDomainInput("app.example.com")).toBeNull();
  });
});
