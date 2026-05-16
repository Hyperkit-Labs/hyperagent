import React from "react";
import { act, render } from "@testing-library/react";

const mockUseActiveAccount = jest.fn();
const mockToastError = jest.fn();
const mockSetAuthHeaderProvider = jest.fn();
const mockSetOn401Callback = jest.fn();
const mockGetStoredSession = jest.fn();
const mockClearStoredSession = jest.fn();
const mockSetStoredSession = jest.fn();
const mockClearExpiredSessionIfNeeded = jest.fn(() => false);
const mockGetSessionTimeToExpiry = jest.fn(() => 600);
const mockBootstrapWithThirdwebInApp = jest.fn();
const mockRedirectToLoginWithNext = jest.fn();

jest.mock("thirdweb/react", () => ({
  useActiveAccount: () => mockUseActiveAccount(),
}));

jest.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock("@/lib/api", () => ({
  setAuthHeaderProvider: (...args: unknown[]) =>
    mockSetAuthHeaderProvider(...args),
  setOn401Callback: (...args: unknown[]) => mockSetOn401Callback(...args),
}));

jest.mock("@/lib/session-store", () => ({
  getStoredSession: () => mockGetStoredSession(),
  clearStoredSession: () => mockClearStoredSession(),
  setStoredSession: (...args: unknown[]) => mockSetStoredSession(...args),
  clearExpiredSessionIfNeeded: () => mockClearExpiredSessionIfNeeded(),
  getSessionTimeToExpiry: () => mockGetSessionTimeToExpiry(),
  SESSION_CHANGE_EVENT: "hyperagent_session_change",
}));

jest.mock("@/lib/authBootstrap", () => ({
  bootstrapWithThirdwebInApp: (...args: unknown[]) =>
    mockBootstrapWithThirdwebInApp(...args),
}));

jest.mock("@/lib/authRedirect", () => ({
  redirectToLoginWithNext: () => mockRedirectToLoginWithNext(),
}));

import { ApiAuthProvider } from "@/components/providers/ApiAuthProvider";

describe("ApiAuthProvider", () => {
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    console.warn = jest.fn();
    mockUseActiveAccount.mockReturnValue({
      address: "0xabc",
      getAuthToken: jest.fn(async () => "thirdweb-token"),
    });
    mockGetStoredSession.mockReturnValue({
      access_token: "jwt-token",
      expires_at: Math.floor(Date.now() / 1000) + 600,
    });
    mockBootstrapWithThirdwebInApp.mockResolvedValue({
      access_token: "new-jwt",
      expires_in: 3600,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    console.warn = originalConsoleWarn;
  });

  it("attempts silent refresh before redirect fallback clears the session", async () => {
    render(
      <ApiAuthProvider>
        <div>child</div>
      </ApiAuthProvider>,
    );

    await act(async () => {
      jest.advanceTimersByTime(300_000);
      await Promise.resolve();
    });

    expect(mockBootstrapWithThirdwebInApp).toHaveBeenCalledTimes(1);
    expect(mockClearStoredSession).not.toHaveBeenCalled();
    expect(mockRedirectToLoginWithNext).not.toHaveBeenCalled();
    expect(mockSetStoredSession).toHaveBeenCalledWith("new-jwt", 3600);
  });

  it("logs unauthorized request context before redirecting on global 401", () => {
    render(
      <ApiAuthProvider>
        <div>child</div>
      </ApiAuthProvider>,
    );

    const on401 = mockSetOn401Callback.mock.calls[0]?.[0] as
      | ((context: {
          path: string;
          status: 401;
          code?: string;
          requestId?: string;
          message: string;
        }) => void)
      | undefined;
    expect(on401).toBeDefined();

    on401?.({
      path: "/workflows",
      status: 401,
      code: "unauthorized.invalid_token",
      requestId: "req-123",
      message: "Invalid or expired token",
    });

    expect(console.warn).toHaveBeenCalledWith(
      "[auth] global 401 logout",
      expect.objectContaining({
        path: "/workflows",
        code: "unauthorized.invalid_token",
        requestId: "req-123",
      }),
    );
    expect(mockClearStoredSession).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockRedirectToLoginWithNext).toHaveBeenCalledTimes(1);
  });
});
