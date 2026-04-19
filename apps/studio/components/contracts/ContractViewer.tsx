"use client";

import { useState } from "react";
import Link from "next/link";
import { Artifact, CodeBlock } from "@/components/ai-elements";
import { Copy, Check, Download, Rocket, FileCode } from "lucide-react";
import { copyToClipboard } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import {
  ContractToolbar,
  ContractToolbarButton,
  ExpandableToolbar,
} from "@/components/ui";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface ContractViewerProps {
  contractCode: string;
  abi?: unknown[];
  contractName?: string;
  workflowId?: string;
}

export function ContractViewer({
  contractCode,
  abi,
  contractName,
  workflowId,
}: ContractViewerProps) {
  const [copied, setCopied] = useState(false);
  const [showABI, setShowABI] = useState(false);
  const narrowActions = useMediaQuery("(max-width: 639px)");

  const handleCopy = async () => {
    const success = await copyToClipboard(contractCode);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([contractCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contractName || "contract"}.sol`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const actionButtons = (
    <ContractToolbar className="flex-wrap gap-0.5">
      {workflowId && (
        <ContractToolbarButton asChild>
          <Link
            href={ROUTES.APPS_ID(workflowId)}
            className="inline-flex items-center gap-1.5"
          >
            <Rocket className="w-4 h-4" />
            Deploy
          </Link>
        </ContractToolbarButton>
      )}
      <ContractToolbarButton
        type="button"
        onClick={handleCopy}
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="w-4 h-4 text-[var(--color-semantic-success)]" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
        <span className="sr-only sm:not-sr-only sm:inline">Copy</span>
      </ContractToolbarButton>
      <ContractToolbarButton
        type="button"
        onClick={handleDownload}
        aria-label="Download contract"
      >
        <Download className="w-4 h-4" />
        <span className="sr-only sm:not-sr-only sm:inline">Save</span>
      </ContractToolbarButton>
    </ContractToolbar>
  );

  const actions = narrowActions ? (
    <ExpandableToolbar
      label="Contract actions"
      defaultCollapsed
      icon={<FileCode className="h-3.5 w-3.5 opacity-80" />}
      className="min-w-[10rem]"
    >
      {actionButtons}
    </ExpandableToolbar>
  ) : (
    actionButtons
  );

  return (
    <Artifact
      title="Contract Code"
      description={contractName}
      actions={actions}
      defaultOpen={true}
    >
      <CodeBlock code={contractCode} language="solidity" showLineNumbers />

      {abi && abi.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowABI(!showABI)}
            className="px-3 py-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            {showABI ? "Hide" : "Show"} ABI
          </button>
          {showABI && (
            <CodeBlock
              code={JSON.stringify(abi, null, 2)}
              language="json"
              showLineNumbers={false}
              className="mt-2"
            />
          )}
        </div>
      )}
    </Artifact>
  );
}
