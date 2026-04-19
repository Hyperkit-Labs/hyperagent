"use client";

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Code2, Shield, Rocket, Wrench, Plus } from "lucide-react";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
} from "@/components/ai-elements";
import { AiPromptShell, ExpandableToolbar } from "@/components/ui";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export interface ActionPill {
  id: string;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export interface ChatCommandBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  actionPills?: ActionPill[];
  onCreateWorkflow?: () => void;
  canCreateWorkflow?: boolean;
  creatingWorkflow?: boolean;
  /** Optional status indicator (e.g. "Gemini key active") rendered inside the Omnibar */
  statusIndicator?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function ChatCommandBar({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask HyperAgent to build...",
  actionPills = [],
  onCreateWorkflow,
  canCreateWorkflow = false,
  creatingWorkflow = false,
  statusIndicator,
  children,
  className = "",
}: ChatCommandBarProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(e);
  };

  const defaultPills: ActionPill[] = [
    {
      id: "audit",
      label: "Audit",
      onClick: () => onChange("Audit my smart contract for security issues"),
      icon: <Shield className="w-3.5 h-3.5" />,
    },
    {
      id: "debug",
      label: "Debug",
      onClick: () => onChange("Debug and fix the issues in my contract"),
      icon: <Wrench className="w-3.5 h-3.5" />,
    },
    {
      id: "deploy",
      label: "Deploy",
      onClick: () => onChange("Deploy my contract to the testnet"),
      icon: <Rocket className="w-3.5 h-3.5" />,
    },
    {
      id: "create",
      label: "Create",
      onClick: () =>
        onChange("Create an ERC20 token with name MyToken and symbol MTK"),
      icon: <Code2 className="w-3.5 h-3.5" />,
    },
  ];

  const pills = actionPills.length > 0 ? actionPills : defaultPills;
  const [pillFlash, setPillFlash] = useState<string | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrowBar = useMediaQuery("(max-width: 639px)");

  const handlePillClick = useCallback((pill: ActionPill) => {
    pill.onClick();
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setPillFlash(pill.id);
    flashTimeoutRef.current = setTimeout(() => {
      setPillFlash(null);
      flashTimeoutRef.current = null;
    }, 400);
  }, []);

  return (
    <div
      className={`p-4 border-t border-white/10 bg-black/20 backdrop-blur-md ${className}`}
    >
      {statusIndicator && <div className="mb-2">{statusIndicator}</div>}
      {narrowBar ? (
        <ExpandableToolbar
          label="Quick prompts"
          defaultCollapsed
          icon={<Wrench className="h-3.5 w-3.5 opacity-80" />}
          className="border-b border-white/5 px-2 pb-1"
          triggerClassName="text-[var(--color-text-secondary)]"
        >
          <div className="flex flex-wrap gap-2 px-1 pb-2">
            {pills.map((pill) => (
              <motion.button
                key={pill.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePillClick(pill)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border transition-colors ${
                  pillFlash === pill.id
                    ? "border-[var(--color-primary)] animate-pulse text-[var(--color-primary-light)]"
                    : "border-white/10 hover:bg-white/10 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {pill.icon}
                {pill.label}
              </motion.button>
            ))}
          </div>
        </ExpandableToolbar>
      ) : (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-3 py-2 border-b border-white/5">
          {pills.map((pill) => (
            <motion.button
              key={pill.id}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handlePillClick(pill)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border transition-colors ${
                pillFlash === pill.id
                  ? "border-[var(--color-primary)] animate-pulse text-[var(--color-primary-light)]"
                  : "border-white/10 hover:bg-white/10 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {pill.icon}
              {pill.label}
            </motion.button>
          ))}
        </div>
      )}
      <AiPromptShell className="mx-2 mb-2 mt-1">
        <PromptInput
          value={value}
          onChange={(v) => onChange(v)}
          onSubmit={handleSubmit}
          disabled={disabled}
          placeholder={placeholder}
          className="!p-0 !border-0 !bg-transparent"
          footer={
            <PromptInputFooter className="flex items-center justify-between px-2 pb-2 pt-1">
              <div className="flex items-center gap-2">
                {onCreateWorkflow && canCreateWorkflow && (
                  <button
                    type="button"
                    onClick={onCreateWorkflow}
                    disabled={creatingWorkflow}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-white/10 disabled:opacity-50 transition-colors"
                  >
                    {creatingWorkflow ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        Run pipeline
                      </>
                    )}
                  </button>
                )}
              </div>
              <PromptInputButton disabled={disabled || !value.trim()} />
            </PromptInputFooter>
          }
        />
      </AiPromptShell>
      {children}
    </div>
  );
}
