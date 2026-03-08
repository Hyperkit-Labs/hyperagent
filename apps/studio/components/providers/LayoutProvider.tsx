"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ContextSidebar } from "@/components/layout/ContextSidebar";

interface LayoutContextValue {
  contextSidebarOpen: boolean;
  setContextSidebarOpen: (v: boolean) => void;
  toggleContextSidebar: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  openCommandPalette: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [contextSidebarOpen, setContextSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const toggleContextSidebar = useCallback(() => {
    setContextSidebarOpen((v) => !v);
  }, []);

  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);

  const value: LayoutContextValue = {
    contextSidebarOpen,
    setContextSidebarOpen,
    toggleContextSidebar,
    commandPaletteOpen,
    setCommandPaletteOpen,
    openCommandPalette,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </LayoutContext.Provider>
  );
}
