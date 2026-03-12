"use client";

import Link from "next/link";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { getDocsUrl } from "@/lib/api";
import { ROUTES } from "@/constants/routes";
import { BookOpen, ExternalLink, FileText, Zap, Shield, Globe, Code2, Terminal, Key } from "lucide-react";
import { PageTitle } from "@/components/layout/PageTitle";

function buildGuides(apiDocsUrl: string | null) {
  return [
    { icon: Zap, title: "Quick start", desc: "Create your first smart contract in under 2 minutes", href: ROUTES.HOME, external: false },
    { icon: Key, title: "BYOK setup", desc: "Add your LLM API keys to power the pipeline", href: ROUTES.SETTINGS, external: false },
    { icon: Code2, title: "Templates", desc: "Browse pre-built contract templates and presets", href: ROUTES.TEMPLATES, external: false },
    { icon: Shield, title: "Security pipeline", desc: "How audits and simulations protect your contracts", href: ROUTES.SECURITY, external: false },
    { icon: Globe, title: "Multi-chain deploy", desc: "Deploy across EVM networks with one click", href: ROUTES.NETWORKS, external: false },
    { icon: Terminal, title: "CLI reference", desc: "API client and programmatic access via TypeScript SDK", href: apiDocsUrl, external: true },
  ];
}

export default function DocsPage() {
  const apiDocsUrl = getDocsUrl();

  return (
    <RequireApiSession>
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-400" />
          </div>
          <PageTitle title="Documentation" subtitle="Guides, API reference, and platform resources" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href={apiDocsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-panel rounded-xl p-6 glass-panel-hover transition-all flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                API reference
                <ExternalLink className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              </h2>
              <p className="text-[var(--color-text-tertiary)] text-sm mt-1">Interactive OpenAPI docs with request/response examples.</p>
            </div>
          </a>
          <a
            href="https://github.com/AiHyperKit"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-panel rounded-xl p-6 glass-panel-hover transition-all flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-panel)] flex items-center justify-center shrink-0">
              <Code2 className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </div>
            <div>
              <h2 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                GitHub repository
                <ExternalLink className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              </h2>
              <p className="text-[var(--color-text-tertiary)] text-sm mt-1">Source code, issues, and contributing guidelines.</p>
            </div>
          </a>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Guides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {buildGuides(apiDocsUrl).map((g) => {
              const Icon = g.icon;
              const inner = (
                <div className={`glass-panel rounded-lg p-4 flex items-start gap-3 h-full ${g.href ? "glass-panel-hover transition-all" : "opacity-70"}`}>
                  <Icon className="w-5 h-5 text-[var(--color-text-tertiary)] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                      {g.title}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{g.desc}</p>
                  </div>
                </div>
              );
              if (!g.href) {
                return <div key={g.title} className="pointer-events-none">{inner}</div>;
              }
              return g.external ? (
                <a key={g.title} href={g.href} target="_blank" rel="noopener noreferrer">{inner}</a>
              ) : (
                <Link key={g.title} href={g.href}>{inner}</Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </RequireApiSession>
  );
}
