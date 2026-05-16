jest.mock("@/lib/api", () => ({
  getWorkflows: jest.fn(),
  getErrorMessage: jest.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  isAbortError: jest.fn(() => false),
}));

jest.mock("@/lib/runtime-timeouts", () => ({
  CRITICAL_ROUTE_SETTLE_TIMEOUT_MS: 1000,
  withAsyncTimeout: jest.fn((promise: Promise<unknown>) => promise),
}));

jest.mock("@/constants/defaults", () => ({
  POLLING: {
    WORKFLOWS_MS: 1000,
  },
}));

import { renderHook, waitFor } from "@testing-library/react";
import { useWorkflows } from "@/hooks/useWorkflows";
import { getWorkflows } from "@/lib/api";

const mockedGetWorkflows = jest.mocked(getWorkflows);

describe("useWorkflows", () => {
  beforeEach(() => {
    mockedGetWorkflows.mockReset();
  });

  it("filters workflows by normalized network and reports filtered total", async () => {
    mockedGetWorkflows.mockResolvedValue({
      workflows: [
        {
          workflow_id: "wf-1",
          status: "running",
          network: "Base Sepolia",
        },
        {
          workflow_id: "wf-2",
          status: "completed",
          network: "Mantle",
        },
      ],
      total: 2,
    } as never);

    const { result } = renderHook(() =>
      useWorkflows({
        autoRefresh: false,
        filters: {
          network: "  base  ",
          limit: 10,
        },
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.workflows).toHaveLength(1);
    expect(result.current.workflows[0]?.workflow_id).toBe("wf-1");
    expect(result.current.total).toBe(1);
    expect(mockedGetWorkflows).toHaveBeenCalledWith(
      { status: undefined, limit: 10 },
      expect.any(AbortSignal),
    );
  });
});
