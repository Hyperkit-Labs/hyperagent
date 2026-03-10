"use client";

import Link from "next/link";
import { ExternalLink, FileCode, Copy, Check, CheckCircle, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { ROUTES } from "@/constants/routes";
import { StatusBadge } from "@/components/ui";
import { ExplorerLink } from "@/components/deployments/ExplorerLink";
import type { Deployment } from "@/lib/transformers";

interface DeploymentDetailsProps {
  deployment: Deployment;
}

const PIPELINE_STAGES = [
  { key: "build", label: "Build" },
  { key: "audit", label: "Audit" },
  { key: "simulate", label: "Simulate" },
  { key: "deploy", label: "Deploy" },
];

export function DeploymentDetails({ deployment }: DeploymentDetailsProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (deployment.contractAddress) {
      void navigator.clipboard.writeText(deployment.contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSuccess = deployment.status === "success";
  const isFailed = deployment.status === "failed";

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] shrink-0">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Deployment details</h3>
        <Link
          href={`${ROUTES.HOME}?workflow=${encodeURIComponent(deployment.workflowId)}`}
          className="text-xs text-[var(--color-primary-light)] hover:text-[var(--color-primary)] flex items-center gap-1.5"
        >
          Open in Studio
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </header>
      <div className="flex-1 overflow-auto px-4 py-3 space-y-4 text-xs">
        <div>
          <span className="text-[var(--color-text-muted)] block mb-1">Pipeline</span>
          <div className="flex items-center gap-1">
            {PIPELINE_STAGES.map((stage, i) => {
              const stageComplete = isSuccess || (isFailed && i < 3);
              const stageFailed = isFailed && i === 3;
              return (
              <div key={stage.key} className="flex items-center gap-1">
                <span
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${
                    stageComplete
                      ? "bg-[var(--color-semantic-success)]/20 text-[var(--color-semantic-success)]"
                      : stageFailed
                        ? "bg-[var(--color-semantic-error)]/20 text-[var(--color-semantic-error)]"
                        : "bg-[var(--color-border-subtle)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {stageComplete ? <CheckCircle className="w-3 h-3" /> : stageFailed ? <XCircle className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                  {stage.label}
                </span>
                {i < PIPELINE_STAGES.length - 1 && (
                  <span className="text-[var(--color-border-default)]">→</span>
                )}
              </div>
            );
            })}
          </div>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)] block mb-1">Workflow</span>
          <span className="text-[var(--color-text-primary)] font-mono">{deployment.workflowId}</span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)] block mb-1">Status</span>
          <StatusBadge status={deployment.status} />
        </div>
        <div>
          <span className="text-[var(--color-text-muted)] block mb-1">Network</span>
          <span className="text-[var(--color-text-primary)]">{deployment.network ?? "-"}</span>
        </div>
        {deployment.contractAddress && (
          <div>
            <span className="text-[var(--color-text-muted)] block mb-1">Contract address</span>
            <div className="flex items-center gap-2">
              {deployment.network ? (
                <ExplorerLink
                  network={deployment.network}
                  type="address"
                  value={deployment.contractAddress}
                  label={`${deployment.contractAddress.slice(0, 10)}...${deployment.contractAddress.slice(-8)}`}
                />
              ) : (
                <code className="text-[11px] font-mono text-[var(--color-text-tertiary)] truncate flex-1">
                  {deployment.contractAddress}
                </code>
              )}
              <button
                type="button"
                onClick={copyAddress}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                title="Copy address"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
        {deployment.transactionHash && deployment.network && (
          <div>
            <span className="text-[var(--color-text-muted)] block mb-1">Transaction</span>
            <ExplorerLink
              network={deployment.network}
              type="tx"
              value={deployment.transactionHash}
              label={`${deployment.transactionHash.slice(0, 10)}...`}
            />
          </div>
        )}
        {deployment.duration != null && (
          <div>
            <span className="text-[var(--color-text-muted)] block mb-1">Duration</span>
            <span className="text-[var(--color-text-primary)]">{deployment.duration}s</span>
          </div>
        )}
        {deployment.gasUsed != null && (
          <div>
            <span className="text-[var(--color-text-muted)] block mb-1">Gas used</span>
            <span className="text-[var(--color-text-primary)]">{deployment.gasUsed.toLocaleString()}</span>
          </div>
        )}
        <div className="pt-2">
          <Link
            href={ROUTES.CONTRACTS}
            className="inline-flex items-center gap-2 text-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
          >
            <FileCode className="w-3.5 h-3.5" />
            View all contracts
          </Link>
        </div>
      </div>
    </div>
  );
}
