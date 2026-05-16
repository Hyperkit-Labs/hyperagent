/**
 * Server route regression: /chat redirects to / and preserves query params.
 */

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

import ChatRedirectPage from "@/app/chat/page";

describe("/chat redirect", () => {
  it("redirects to / while preserving query params", async () => {
    const { redirect } = jest.requireMock("next/navigation") as {
      redirect: jest.Mock;
    };

    await ChatRedirectPage({
      searchParams: Promise.resolve({
        q: "deploy",
        tab: "audit",
      }),
    });

    expect(redirect).toHaveBeenCalledWith("/?q=deploy&tab=audit");
  });
});
