"use client";

import Link from "next/link";
import { ExternalLink, FileCode, Copy, Check } from "lucide-react";
import { useState } from "react";
import { ROUTES } from "@/constants/routes";
import { StatusBadge } from "@/components/ui";
import type { Deployment } from "@/lib/transformers";

interface DeploymentDetailsProps {
  deployment: Deployment;
}

export function DeploymentDetails({ deployment }: DeploymentDetailsProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (deployment.contractAddress) {
      void navigator.clipboard.writeText(deployment.contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <h3 className="text-sm font-medium text-slate-100">Deployment details</h3>
        <Link
          href={`${ROUTES.HOME}?workflow=${encodeURIComponent(deployment.workflowId)}`}
          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1.5"
        >
          Open in Studio
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </header>
      <div className="flex-1 overflow-auto px-4 py-3 space-y-4 text-xs">
        <div>
          <span className="text-slate-500 block mb-1">Workflow</span>
          <span className="text-slate-100 font-mono">{deployment.workflowId}</span>
        </div>
        <div>
          <span className="text-slate-500 block mb-1">Status</span>
          <StatusBadge status={deployment.status} />
        </div>
        <div>
          <span className="text-slate-500 block mb-1">Network</span>
          <span className="text-slate-100">{deployment.network ?? "-"}</span>
        </div>
        {deployment.contractAddress && (
          <div>
            <span className="text-slate-500 block mb-1">Contract address</span>
            <div className="flex items-center gap-2">
              <code className="text-[11px] font-mono text-slate-300 truncate flex-1">
                {deployment.contractAddress}
              </code>
              <button
                type="button"
                onClick={copyAddress}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
                title="Copy address"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
        {deployment.transactionHash && (
          <div>
            <span className="text-slate-500 block mb-1">Transaction</span>
            <code className="text-[11px] font-mono text-slate-400 truncate block">
              {deployment.transactionHash}
            </code>
          </div>
        )}
        {deployment.duration != null && (
          <div>
            <span className="text-slate-500 block mb-1">Duration</span>
            <span className="text-slate-100">{deployment.duration}s</span>
          </div>
        )}
        {deployment.gasUsed != null && (
          <div>
            <span className="text-slate-500 block mb-1">Gas used</span>
            <span className="text-slate-100">{deployment.gasUsed.toLocaleString()}</span>
          </div>
        )}
        <div className="pt-2">
          <Link
            href={ROUTES.CONTRACTS}
            className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300"
          >
            <FileCode className="w-3.5 h-3.5" />
            View all contracts
          </Link>
        </div>
      </div>
    </div>
  );
}
