/**
 * @jest-environment node
 *
 * msw/node patches Node's HTTP stack; run in the Node environment, not jsdom.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "@jest/globals";
import { server } from "../../mocks/server";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("MSW", () => {
  it("returns mocked JSON for /api/health", async () => {
    const res = await fetch("http://localhost/api/health");
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", service: "gateway" });
  });
});
