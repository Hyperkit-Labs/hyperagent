import React from "react";
import { render } from "@testing-library/react";

const mockUseSWR = jest.fn(() => ({
  data: [],
  error: null,
  isLoading: false,
  mutate: jest.fn(),
}));

jest.mock("swr", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

jest.mock("@/lib/api", () => ({
  getNetworks: jest.fn(),
}));

import { NetworksProvider } from "@/components/providers/NetworksProvider";

describe("NetworksProvider", () => {
  beforeEach(() => {
    mockUseSWR.mockClear();
  });

  it("revalidates networks on mount so the shell can resolve target network state", () => {
    render(
      <NetworksProvider>
        <div>child</div>
      </NetworksProvider>,
    );

    expect(mockUseSWR).toHaveBeenCalledWith(
      "networks",
      expect.any(Function),
      expect.objectContaining({
        revalidateOnMount: true,
      }),
    );
  });
});
