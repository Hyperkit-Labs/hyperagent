"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, HardDrive, FileCode, FunctionSquare, X } from "lucide-react";
import { ROUTES } from "@/constants/routes";

interface ContextSidebarProps {
  open: boolean;
  onClose: () => void;
  /** Optional workflow context when on chat with workflow selected. */
  workflowId?: string | null;
  /** Optional contract functions when viewing contract. */
  contractFunctions?: string[];
}

function ResourceInspectorChat({ workflowId }: { workflowId?: string | null }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">OpenSandbox</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-text-tertiary)] flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5" />
            CPU
          </span>
          <span className="text-[var(--color-text-primary)] font-mono">--</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-text-tertiary)] flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5" />
            RAM
          </span>
          <span className="text-[var(--color-text-primary)] font-mono">--</span>
        </div>
      </div>
      {workflowId && (
        <p className="text-[10px] text-[var(--color-text-dim)] font-mono truncate" title={workflowId}>
          {workflowId.slice(0, 8)}...
        </p>
      )}
    </div>
  );
}

function ResourceInspectorContracts({ functions }: { functions?: string[] }) {
  const list = functions?.length ? functions : ["constructor", "transfer", "approve", "balanceOf"];
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Functions</h3>
      <ul className="space-y-1">
        {list.map((fn, i) => (
          <li
            key={i}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-mono text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
          >
            <FunctionSquare className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
            {fn}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContextSidebar({ open, onClose, workflowId, contractFunctions }: ContextSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isChat = pathname === ROUTES.HOME || pathname === "/";
  const hasWorkflow = isChat && (searchParams.get("workflow") || workflowId);
  const isContracts = pathname?.startsWith(ROUTES.CONTRACTS) || pathname?.includes("/contracts");

  const content = isContracts ? (
    <ResourceInspectorContracts functions={contractFunctions} />
  ) : (
    <ResourceInspectorChat workflowId={hasWorkflow ? (searchParams.get("workflow") || workflowId) : null} />
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 overflow-hidden border-l border-white/10"
        >
          <div
            className="w-[280px] h-full flex flex-col bg-[var(--color-bg-elevated)]/80 backdrop-blur-2xl border-l border-white/10"
            style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.2)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Resource Inspector
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {content}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
