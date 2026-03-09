"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type PipelineState = "idle" | "coding" | "auditing" | "deploying" | "success";

interface PipelineStateContextValue {
  state: PipelineState;
  setState: (s: PipelineState) => void;
}

const PipelineStateContext = createContext<PipelineStateContextValue | null>(null);

export function usePipelineState() {
  const ctx = useContext(PipelineStateContext);
  return ctx ?? { state: "idle" as PipelineState, setState: () => {} };
}

export function PipelineStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PipelineState>("idle");
  return (
    <PipelineStateContext.Provider value={{ state, setState }}>
      {children}
    </PipelineStateContext.Provider>
  );
}
