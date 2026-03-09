"use client";

import { usePipelineState } from "@/components/providers/PipelineStateProvider";

const STATE_COLORS: Record<string, { top: string; bottom: string }> = {
  idle: { top: "bg-purple-900/10", bottom: "bg-indigo-900/10" },
  coding: { top: "bg-blue-900/12", bottom: "bg-sky-900/10" },
  auditing: { top: "bg-amber-900/12", bottom: "bg-orange-900/10" },
  deploying: { top: "bg-purple-900/12", bottom: "bg-violet-900/10" },
  success: { top: "bg-emerald-900/12", bottom: "bg-green-900/10" },
};

export function AmbientBackground() {
  const { state } = usePipelineState();
  const colors = STATE_COLORS[state] ?? STATE_COLORS.idle;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 transition-colors duration-1000">
      <div className={`absolute top-[-10%] left-[20%] w-[600px] h-[600px] ${colors.top} rounded-full blur-[120px]`} />
      <div className={`absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] ${colors.bottom} rounded-full blur-[100px]`} />
    </div>
  );
}
