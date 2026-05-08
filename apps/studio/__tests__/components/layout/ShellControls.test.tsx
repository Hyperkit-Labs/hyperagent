import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockGetWorkflows = jest.fn();
const mockSetSelectedNetworkId = jest.fn();
const mockDeleteLLMKeys = jest.fn();
const mockDisconnect = jest.fn();
const mockSignIn = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard"),
  useSearchParams: jest.fn(() => new URLSearchParams("workflow=wf_123")),
}));

jest.mock("@/lib/api", () => ({
  getWorkflows: (...args: unknown[]) => mockGetWorkflows(...args),
  deleteLLMKeys: (...args: unknown[]) => mockDeleteLLMKeys(...args),
}));

jest.mock("@/hooks/useNetworks", () => ({
  useNetworks: jest.fn(() => ({
    networks: [
      {
        id: "base-mainnet",
        network_id: "base-mainnet",
        name: "Base",
        is_mainnet: true,
        tier: "primary",
      },
      {
        id: "base-sepolia",
        network_id: "base-sepolia",
        name: "Base Sepolia",
        is_mainnet: false,
        tier: "preferred",
      },
    ],
    loading: false,
    error: null,
  })),
}));

jest.mock("@/components/providers/SelectedNetworkProvider", () => ({
  useSelectedNetwork: jest.fn(() => ({
    selectedNetworkId: "base-mainnet",
    setSelectedNetworkId: mockSetSelectedNetworkId,
  })),
}));

jest.mock("thirdweb/react", () => ({
  useConnectModal: jest.fn(() => ({
    connect: jest.fn(),
    isConnecting: false,
  })),
  useActiveAccount: jest.fn(() => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
  })),
  useDisconnect: jest.fn(() => ({
    disconnect: mockDisconnect,
  })),
  useActiveWallet: jest.fn(() => null),
}));

jest.mock("@/lib/thirdwebClient", () => ({
  getThirdwebClient: jest.fn(() => ({ clientId: "test" })),
}));

jest.mock("@/lib/connectWallets", () => ({
  getConnectConfig: jest.fn(() => ({})),
}));

jest.mock("@/hooks/useSignInWithWallet", () => ({
  useSignInWithWallet: jest.fn(() => ({
    signIn: mockSignIn,
    isLoading: false,
    error: null,
  })),
}));

jest.mock("@/lib/session-store", () => ({
  clearStoredSession: jest.fn(),
  clearSessionOnlyLLMKey: jest.fn(),
}));

jest.mock("@/hooks/useSession", () => ({
  useSession: jest.fn(() => ({
    hasSession: true,
    isReady: true,
  })),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { NetworkSelector } from "@/components/layout/NetworkSelector";
import { ConnectWalletNav } from "@/components/wallet/ConnectWalletNav";

describe("shell controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWorkflows.mockResolvedValue({
      workflows: [
        { workflow_id: "wf_1", status: "completed", updated_at: "now" },
        { workflow_id: "wf_2", status: "failed", updated_at: "later" },
      ],
    });
  });

  it("opens notifications by keyboard and restores focus on escape", async () => {
    render(<NotificationsDropdown />);

    const trigger = screen.getByRole("button", { name: "Notifications" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const menu = await screen.findByRole("menu", {
      name: "Notifications menu",
    });
    await waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: /workflow completed/i }),
      ).toHaveFocus(),
    );

    fireEvent.keyDown(menu, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("menu", { name: "Notifications menu" }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("supports keyboard selection in the network listbox", async () => {
    render(<NetworkSelector />);

    const trigger = screen.getByRole("button", { name: "Select network" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const listbox = await screen.findByRole("listbox", { name: "Networks" });
    const selectedOption = screen.getByRole("option", { name: "Base" });

    await waitFor(() => expect(selectedOption).toHaveFocus());
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(mockSetSelectedNetworkId).toHaveBeenCalledWith("base-sepolia");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("opens wallet session controls from the keyboard and closes on escape", async () => {
    render(<ConnectWalletNav />);

    const trigger = screen.getByRole("button", {
      name: "Wallet session controls",
    });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const menu = await screen.findByRole("menu");
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus(),
    );

    fireEvent.keyDown(menu, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});
