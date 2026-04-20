import { describe, expect, it } from "vitest";
import {
  allTaxonomySecretKeys,
  gatewayNonSecretConfigKeys,
  publicBrowserEnvKeys,
} from "./env-taxonomy.js";
import { EnvFlat } from "./keys.js";

const envValues = new Set<string>(Object.values(EnvFlat));

describe("env-taxonomy", () => {
  it("maps every listed secret to a canonical Env value", () => {
    for (const k of allTaxonomySecretKeys) {
      expect(envValues.has(k)).toBe(true);
    }
  });

  it("maps public and gateway config keys to canonical Env values", () => {
    for (const k of [...publicBrowserEnvKeys, ...gatewayNonSecretConfigKeys]) {
      expect(envValues.has(k)).toBe(true);
    }
  });
});
