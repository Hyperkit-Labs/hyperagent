/**
 * Regression tests: command palette has one shortcut owner and restores focus.
 */

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  usePathname: jest.fn(() => "/dashboard"),
  useSearchParams: jest.fn(() => new URLSearchParams("")),
}));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LayoutProvider } from "@/components/providers/LayoutProvider";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
  });
});

function PaletteHarness() {
  return (
    <LayoutProvider>
      <button type="button">Before</button>
    </LayoutProvider>
  );
}

describe("CommandPalette", () => {
  it("opens exactly once via Cmd/Ctrl+K and restores focus on escape", async () => {
    render(<PaletteHarness />);

    const trigger = screen.getByRole("button", { name: "Before" });
    trigger.focus();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const dialog = await screen.findByRole("dialog", {
      name: "Command palette",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getAllByRole("dialog", { name: "Command palette" }),
    ).toHaveLength(1);

    const input = screen.getByPlaceholderText(
      "Search templates, docs, workflows…",
    );
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Command palette" }),
      ).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it("ignores repeated keydown so holding the shortcut does not toggle twice", async () => {
    render(<PaletteHarness />);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true, repeat: true });
    expect(
      screen.queryByRole("dialog", { name: "Command palette" }),
    ).not.toBeInTheDocument();
  });
});
