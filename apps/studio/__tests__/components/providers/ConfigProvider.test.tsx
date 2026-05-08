import React from "react";
import { render } from "@testing-library/react";

const mockUseSWR = jest.fn(() => ({
  data: null,
  error: null,
  isLoading: false,
}));

jest.mock("swr", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard"),
}));

jest.mock("@/lib/api", () => ({
  getConfig: jest.fn(),
}));

jest.mock("@/config/environment", () => ({
  setRuntimeFeatures: jest.fn(),
  setRuntimeConfig: jest.fn(),
}));

import { ConfigProvider } from "@/components/providers/ConfigProvider";

describe("ConfigProvider", () => {
  beforeEach(() => {
    mockUseSWR.mockClear();
  });

  it("revalidates config on mount for authenticated routes", () => {
    render(
      <ConfigProvider>
        <div>child</div>
      </ConfigProvider>,
    );

    expect(mockUseSWR).toHaveBeenCalledWith(
      "config",
      expect.any(Function),
      expect.objectContaining({
        revalidateOnMount: true,
      }),
    );
  });
});
