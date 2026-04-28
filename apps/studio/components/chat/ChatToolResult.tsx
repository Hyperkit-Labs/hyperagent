"use client";

import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { Rocket } from "lucide-react";

export interface ChatToolResultProps {
  toolName: string;
  result?: { workflow_id?: string; message?: string } | null;
}

export function ChatToolResult({ toolName, result }: ChatToolResultProps) {
  if (toolName !== "create_workflow") {
    return null;
  }

  if (!result?.workflow_id) {
    return (
      <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
        <p className="text-[13px] text-red-200">
          {result?.message ?? "Workflow creation failed."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-primary-alpha-20)] bg-[var(--color-primary-alpha-10)] p-3">
      <p className="text-[13px] text-[var(--color-text-secondary)]">
        Workflow created successfully.
      </p>
      <Link
        href={`${ROUTES.CHAT}?workflow=${result.workflow_id}`}
        className="mt-2 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors"
      >
        <Rocket className="w-3.5 h-3.5" />
        Open in builder
      </Link>
    </div>
  );
}
