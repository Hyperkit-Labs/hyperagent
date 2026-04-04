/**
 * SessionProvider: bootstrap fail-closed regression tests.
 * 401 clears session and redirects. 503/429 fail bootstrap with message, no redirect. 500/network fail closed.
 */

import React from "react";
import { render, act, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard"),
}));

jest.mock("@/lib/session-store", () => ({
  getStoredSession: jest.fn(() => ({
    access_token: "tok",
    expires_at: Date.now() / 1000 + 3600,
  })),
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

import {
  SessionProvider,
  useSessionContext,
} from "@/components/providers/SessionProvider";
import { redirectToLoginWithNext } from "@/lib/authRedirect";

function SessionStatus() {
  const { bootstrapStatus, hasSession, isReady, bootstrapError } =
    useSessionContext();
  return (
    <div>
      <span data-testid="status">{bootstrapStatus}</span>
      <span data-testid="session">{String(hasSession)}</span>
      <span data-testid="ready">{String(isReady)}</span>
      <span data-testid="bootstrap-err">{bootstrapError ?? ""}</span>
    </div>
  );
}

describe("SessionProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchConfigStrict.mockReset();
  });

  it("sets bootstrapStatus=success when fetchConfigStrict resolves", async () => {
    mockFetchConfigStrict.mockImplementation(() =>
      Promise.resolve({ version: "1.0" }),
    );
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(getByTestId("status").textContent).toBe("success"),
    );
  });

  it("sets bootstrapStatus=failed on 401 and redirects to login", async () => {
    const err = Object.assign(new Error("Unauthorized"), { status: 401 });
    mockFetchConfigStrict.mockImplementation(() => Promise.reject(err));
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(getByTestId("status").textContent).toBe("failed"),
    );
    expect(redirectToLoginWithNext).toHaveBeenCalled();
  });

  it("sets bootstrapStatus=failed on 500 (fail-closed, not success)", async () => {
    const err = Object.assign(new Error("Internal Server Error"), {
      status: 500,
    });
    mockFetchConfigStrict.mockImplementation(() => Promise.reject(err));
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(getByTestId("status").textContent).toBe("failed"),
    );
  });

  it("sets bootstrapStatus=failed on network error (fail-closed)", async () => {
    mockFetchConfigStrict.mockImplementation(() =>
      Promise.reject(new TypeError("Failed to fetch")),
    );
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(getByTestId("status").textContent).toBe("failed"),
    );
  });

  it("503 does not redirect to login (session preserved for retry)", async () => {
    const err = Object.assign(new Error("Service Unavailable"), {
      status: 503,
    });
    mockFetchConfigStrict.mockImplementation(() => Promise.reject(err));
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(getByTestId("status").textContent).toBe("failed"),
    );
    expect(redirectToLoginWithNext).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(getByTestId("bootstrap-err").textContent.length).toBeGreaterThan(
        0,
      ),
    );
  });
});
