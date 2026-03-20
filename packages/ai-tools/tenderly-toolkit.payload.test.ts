/**
 * Guards the simulate-bundle POST body against drift from @hyperagent/core-types:
 * bundle-level fields must remain assignable on SimulateBundleRequest and appear in JSON.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SimulateBundleRequest } from "@hyperagent/core-types";
import { TenderlyToolkit } from "./tenderly-toolkit.js";

function okBundleResponse(): Response {
  return new Response(
    JSON.stringify({
      simulation_results: [{ transaction: { status: true, gas_used: 21_000 } }],
      simulation: { id: "sim-test" },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("TenderlyToolkit.simulateBundle JSON payload", () => {
  let lastInit: RequestInit | undefined;

  beforeEach(() => {
    lastInit = undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        lastInit = init;
        return okBundleResponse();
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes bundle-level fields from SimulateBundleRequest on the wire", async () => {
    const toolkit = new TenderlyToolkit(
      "access-key",
      "https://api.tenderly.co",
      "my-account",
      "my-project"
    );

    const stateObjects = {
      "0x00000000000000000000000000000000000000aa": {
        storage: { "0x0": "0xdecaf" },
      },
    } satisfies NonNullable<SimulateBundleRequest["state_objects"]>;

    const req: SimulateBundleRequest = {
      simulations: [
        {
          network_id: "1",
          from: "0x1111111111111111111111111111111111111111",
          to: "0x2222222222222222222222222222222222222222",
          input: "0x",
          value: "0",
          simulation_type: "abi",
          save: false,
        },
      ],
      block_number: 18_500_000,
      state_objects: stateObjects,
      simulation_type: "quick",
      save: false,
    };

    await toolkit.simulateBundle(req);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const bodyRaw = lastInit?.body;
    expect(bodyRaw).toBeDefined();
    const body = JSON.parse(String(bodyRaw)) as Record<string, unknown>;

    expect(body.simulations).toHaveLength(1);
    const row = (body.simulations as Record<string, unknown>[])[0];
    expect(row.network_id).toBe("1");
    expect(row.from).toBe("0x1111111111111111111111111111111111111111");
    expect(row.to).toBe("0x2222222222222222222222222222222222222222");
    expect(row.input).toBe("0x");
    expect(row.value).toBe("0");
    expect(row.gas).toBe(8_000_000);
    expect(row.save).toBe(false);
    expect(row.save_if_fails).toBe(true);
    expect(row.simulation_type).toBe("abi");
    expect(row.state_objects).toBeUndefined();

    expect(body.block_number).toBe(18_500_000);
    expect(body.state_objects).toEqual(stateObjects);
    expect(body.simulation_type).toBe("quick");
    expect(body.save).toBe(false);
  });

  it("omits bundle-level keys when not set (only simulations)", async () => {
    const toolkit = new TenderlyToolkit("k", "https://api.tenderly.co");

    const req: SimulateBundleRequest = {
      simulations: [
        {
          network_id: "137",
          from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          input: "0xdeadbeef",
        },
      ],
    };

    await toolkit.simulateBundle(req);

    const body = JSON.parse(String(lastInit?.body)) as Record<string, unknown>;
    expect([...Object.keys(body)].sort()).toEqual(["simulations"]);
    expect(body.block_number).toBeUndefined();
    expect(body.state_objects).toBeUndefined();
    expect(body.simulation_type).toBeUndefined();
    expect(body.save).toBeUndefined();
  });

  it("does not send bundle state_objects when empty object", async () => {
    const toolkit = new TenderlyToolkit("k", "https://api.tenderly.co");
    const req: SimulateBundleRequest = {
      simulations: [
        {
          network_id: "1",
          from: "0xb",
          input: "0x",
          state_objects: { "0xcc": { stateDiff: { "0x1": "0x2" } } },
        },
      ],
      state_objects: {},
    };
    await toolkit.simulateBundle(req);
    const body = JSON.parse(String(lastInit?.body)) as Record<string, unknown>;
    expect(body.state_objects).toBeUndefined();
    const row = (body.simulations as Record<string, unknown>[])[0];
    expect(row.state_objects).toEqual({ "0xcc": { stateDiff: { "0x1": "0x2" } } });
  });
});
