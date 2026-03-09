"use client";

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Code2, Shield, Rocket, Wrench, ArrowUp, Plus } from "lucide-react";

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
      onClick: () => onChange("Create an ERC20 token with name MyToken and symbol MTK"),
      icon: <Code2 className="w-3.5 h-3.5" />,
    },
  ];

  const pills = actionPills.length > 0 ? actionPills : defaultPills;
  const [pillFlash, setPillFlash] = useState<string | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      <form onSubmit={handleSubmit} className="relative group">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pr-24 pb-12 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none resize-none min-h-[80px] max-h-[160px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!disabled && value.trim()) handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
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
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="p-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-mid)] text-white disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Send"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
