import { describe, it, expect } from "vitest";
import {
  getOwner,
  isDomainOwnedBy,
  STATE_DOMAIN_OWNERS,
  type StateDomainName,
} from "./stateDomains.js";

describe("STATE_DOMAIN_OWNERS", () => {
  it("covers all 7 domains", () => {
    const expected: StateDomainName[] = [
      "session",
      "task",
      "permission",
      "plugin",
      "memory",
      "bridge",
      "telemetry",
    ];
    const defined = STATE_DOMAIN_OWNERS.map((o) => o.domain);
    for (const d of expected) {
      expect(defined).toContain(d);
    }
  });

  it("has no duplicate domain entries", () => {
    const domains = STATE_DOMAIN_OWNERS.map((o) => o.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it("every owner has a non-empty ownerService and description", () => {
    for (const owner of STATE_DOMAIN_OWNERS) {
      expect(owner.ownerService.length).toBeGreaterThan(0);
      expect(owner.description.length).toBeGreaterThan(0);
    }
  });
});

describe("getOwner", () => {
  it("returns the owner for session", () => {
    const owner = getOwner("session");
    expect(owner).toBeDefined();
    expect(owner!.ownerService).toBe("api-gateway");
  });

  it("returns the owner for task", () => {
    const owner = getOwner("task");
    expect(owner).toBeDefined();
    expect(owner!.ownerService).toBe("orchestrator");
  });

  it("returns undefined for unknown domain", () => {
    expect(getOwner("nonexistent" as StateDomainName)).toBeUndefined();
  });
});

describe("isDomainOwnedBy", () => {
  it("returns true for correct owner", () => {
    expect(isDomainOwnedBy("session", "api-gateway")).toBe(true);
    expect(isDomainOwnedBy("task", "orchestrator")).toBe(true);
    expect(isDomainOwnedBy("permission", "agent-os")).toBe(true);
  });

  it("returns false for incorrect owner", () => {
    expect(isDomainOwnedBy("session", "orchestrator")).toBe(false);
    expect(isDomainOwnedBy("task", "api-gateway")).toBe(false);
  });

  it("returns false for unknown domain", () => {
    expect(isDomainOwnedBy("unknown" as StateDomainName, "any")).toBe(false);
  });
});
