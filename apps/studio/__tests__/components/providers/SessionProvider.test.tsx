/**
 * SessionProvider: bootstrap fail-closed regression tests.
 * Non-401/503 errors (e.g. 500, network) must result in bootstrapStatus=failed, not success.
 */

import React from "react";
import { render, act, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard"),
}));

jest.mock("@/lib/session-store", () => ({
  getStoredSession: jest.fn(() => ({ access_token: "tok", expires_at: Date.now() / 1000 + 3600 })),
  clearStoredSession: jest.fn(),
  SESSION_CHANGE_EVENT: "hyperagent_session_change",
}));

const mockFetchConfigStrict = jest.fn();
jest.mock("@/lib/api", () => ({
  fetchConfigStrict: (...args: unknown[]) => mockFetchConfigStrict(...args),
}));

jest.mock("@/lib/authRedirect", () => ({
  redirectToLoginWithNext: jest.fn(),
}));

import { SessionProvider, useSessionContext } from "@/components/providers/SessionProvider";

function SessionStatus() {
  const { bootstrapStatus, hasSession, isReady } = useSessionContext();
  return (
    <div>
      <span data-testid="status">{bootstrapStatus}</span>
      <span data-testid="session">{String(hasSession)}</span>
      <span data-testid="ready">{String(isReady)}</span>
    </div>
  );
}

describe("SessionProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets bootstrapStatus=success when fetchConfigStrict resolves", async () => {
    mockFetchConfigStrict.mockResolvedValueOnce({ version: "1.0" });
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>
    );
    await waitFor(() => expect(getByTestId("status").textContent).toBe("success"));
  });

  it("sets bootstrapStatus=failed on 401", async () => {
    const err = Object.assign(new Error("Unauthorized"), { status: 401 });
    mockFetchConfigStrict.mockRejectedValueOnce(err);
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>
    );
    await waitFor(() => expect(getByTestId("status").textContent).toBe("failed"));
  });

  it("sets bootstrapStatus=failed on 500 (fail-closed, not success)", async () => {
    const err = Object.assign(new Error("Internal Server Error"), { status: 500 });
    mockFetchConfigStrict.mockRejectedValueOnce(err);
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>
    );
    await waitFor(() => expect(getByTestId("status").textContent).toBe("failed"));
  });

  it("sets bootstrapStatus=failed on network error (fail-closed)", async () => {
    mockFetchConfigStrict.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>
    );
    await waitFor(() => expect(getByTestId("status").textContent).toBe("failed"));
  });
});
