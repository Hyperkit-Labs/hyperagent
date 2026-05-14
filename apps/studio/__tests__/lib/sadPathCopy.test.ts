import { workflowCreateFailureMessage } from "@/lib/sadPathCopy";

describe("workflowCreateFailureMessage", () => {
  it("keeps 403 failures distinct from expired-session copy", () => {
    const error = new Error("Access denied") as Error & { status?: number };
    error.status = 403;

    expect(workflowCreateFailureMessage(error)).toBe(
      "This action is not available for your current account or workflow state. Your draft is still here.",
    );
  });
});
