/**
 * SessionProvider: route gating should depend on session presence, not `/api/v1/config`.
 */

import React from "react";
import { render, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard"),
}));

jest.mock("@/lib/session-store", () => ({
  getStoredSession: jest.fn(() => ({
    access_token: "tok",
    expires_at: Date.now() / 1000 + 3600,
  })),
  SESSION_CHANGE_EVENT: "hyperagent_session_change",
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
  });

  it("sets bootstrapStatus=success when a protected route has a stored session", async () => {
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(getByTestId("status").textContent).toBe("success"),
    );
  });

  it("sets bootstrapStatus=failed and redirects when a protected route has no session", async () => {
    const { getStoredSession } = jest.requireMock("@/lib/session-store") as {
      getStoredSession: jest.Mock;
    };
    getStoredSession.mockReturnValueOnce(null);
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

  it("does not gate the login route", async () => {
    const { usePathname } = jest.requireMock("next/navigation") as {
      usePathname: jest.Mock;
    };
    usePathname.mockReturnValue("/login");
    const { getByTestId } = render(
      <SessionProvider>
        <SessionStatus />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(getByTestId("status").textContent).toBe("success"),
    );
    expect(redirectToLoginWithNext).not.toHaveBeenCalled();
  });
});
