"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { copyToClipboard } from "@/lib/utils";
import { Copy, Check } from "lucide-react";

export interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  language = "text",
  showLineNumbers = true,
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`rounded-xl overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] ${className}`}
    >
      <div className="flex items-center justify-end px-2 py-1 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-[var(--color-semantic-success)]" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: "transparent",
          fontSize: "12px",
        }}
        showLineNumbers={showLineNumbers}
        codeTagProps={{ style: { fontFamily: "var(--font-jetbrains-mono)" } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
