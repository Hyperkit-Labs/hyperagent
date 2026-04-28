import { validateTemplatePackage } from "@/lib/templatePackageValidation";

describe("templatePackageValidation", () => {
  it("accepts a minimal valid package", () => {
    const result = validateTemplatePackage({
      schema_version: "1",
      name: "Template",
      files: [{ path: "contracts/A.sol", content: "// SPDX" }],
      metadata: {},
      tests: {},
      frontend_scaffold: {},
      chain_compatibility: ["base-sepolia"],
      version: 1,
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects invalid schema fields", () => {
    const result = validateTemplatePackage({
      schema_version: "2",
      name: "",
      files: [{ path: "", content: 42 }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("schema_version");
    expect(result.errors.join(" ")).toContain("name");
    expect(result.errors.join(" ")).toContain("files[0].path");
  });
});
