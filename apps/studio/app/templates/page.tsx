"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { searchTemplates, type TemplateItem } from "@/lib/api";
import { useTemplatesData } from "@/hooks/useTemplatesData";
import { LayoutTemplate, Plus, Search, Flame, BarChart, CheckSquare, X } from "lucide-react";
import { ShimmerGrid } from "@/components/ai-elements";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  all: [],
  defi: ["defi", "vault", "erc4626", "lending", "swap", "amm", "token"],
  nfts: ["nft", "erc721", "erc1155", "gaming", "marketplace"],
  payments: ["payment", "erc20", "transfer", "split"],
  bridges: ["bridge", "cross-chain", "relay"],
  tools: ["tool", "util", "internal"],
};

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  defi: "DeFi",
  nfts: "NFTs & Gaming",
  payments: "Payments",
  bridges: "Bridges",
  tools: "Internal Tools",
};

function filterByCategory(items: TemplateItem[], category: string): TemplateItem[] {
  if (!category || category === "all" || !CATEGORY_KEYWORDS[category]) return items;
  const keywords = CATEGORY_KEYWORDS[category];
  return items.filter((item) => {
    const text = `${(item.name ?? "").toLowerCase()} ${(item.description ?? "").toLowerCase()} ${(item.id ?? "").toLowerCase()}`;
    return keywords.some((kw) => text.includes(kw));
  });
}

function TemplatesContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category")?.toLowerCase() ?? "all";
  const { templates, loading, error: loadError, refetch: loadTemplates } = useTemplatesData();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [searchResults, setSearchResults] = useState<TemplateItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      queueMicrotask(() => {
        setSearchResults(null);
        setSearching(false);
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setSearching(true));
    searchTemplates(searchQuery)
      .then((res) => {
        if (!cancelled) queueMicrotask(() => setSearchResults(Array.isArray(res) ? res : []));
      })
      .catch(() => {
        if (!cancelled) queueMicrotask(() => setSearchResults([]));
      })
      .finally(() => {
        if (!cancelled) queueMicrotask(() => setSearching(false));
      });
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const list = searchResults !== null ? searchResults : templates;
  const items = filterByCategory(list, category);
  const showSearchResults = searchQuery.trim().length > 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Templates</h1>
            <p className="text-[var(--color-text-tertiary)] text-sm mt-1">
              {showSearchResults
                ? `Search: "${searchQuery}"`
                : category !== "all"
                  ? `${CATEGORY_LABELS[category] ?? category}`
                  : "Start from a template or create from prompt. Data from registry."}
            </p>
          </div>
          <Link
            href={ROUTES.HOME}
            className="px-4 py-2 rounded-lg btn-primary-gradient text-white text-xs font-medium transition-all flex items-center gap-2 w-fit"
          >
            <Plus className="w-3.5 h-3.5" />
            New from prompt
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              type="search"
              placeholder="Search templates by name or id..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearchQuery(searchInput.trim())}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>
          <button
            type="button"
            onClick={() => setSearchQuery(searchInput.trim())}
            className="px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] text-sm font-medium hover:bg-[var(--color-bg-panel)] transition-colors"
          >
            Search
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "defi", "nfts", "payments", "bridges", "tools"] as const).map((cat) => (
            <Link
              key={cat}
              href={cat === "all" ? ROUTES.TEMPLATES : `${ROUTES.TEMPLATES}?category=${cat}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                (category === cat || (!category && cat === "all"))
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </Link>
          ))}
        </div>

        {(loading || searching) && <ShimmerGrid count={6} />}

        {!loading && !searching && items.length > 0 && !showSearchResults && category === "all" && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" /> Featured Templates
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
              {items.slice(0, 4).map(item => (
                <div key={`feat-${item.id}`} className="shrink-0 w-[300px] snap-center glass-panel rounded-xl p-5 border border-orange-500/20 bg-orange-500/5 hover:border-orange-500/40 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                      <LayoutTemplate className="w-5 h-5 text-orange-400" />
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">Popular</span>
                  </div>
                  <h3 className="font-medium text-white truncate">{item.name || item.id}</h3>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1 line-clamp-2">{item.description}</p>
                  <Link href={`${ROUTES.HOME}?template=${encodeURIComponent(item.id)}`} className="mt-4 inline-block text-xs font-medium text-orange-400 hover:text-orange-300">
                    Use template &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {compareIds.size > 0 && (
          <div className="bg-[var(--color-bg-panel)] border border-[var(--color-primary-alpha-30)] rounded-lg p-3 flex items-center justify-between shadow-lg sticky top-20 z-10 animate-enter">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[var(--color-text-primary)]">
                {compareIds.size} template{compareIds.size > 1 ? 's' : ''} selected for comparison
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={compareIds.size !== 2} className="text-xs px-4 py-1.5 rounded bg-[var(--color-primary)] text-white disabled:opacity-50 transition-colors">
                Compare Selected
              </button>
              <button onClick={() => setCompareIds(new Set())} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {loadError && !loading && (
          <div className="glass-panel rounded-xl p-6 flex items-center justify-between">
            <p className="text-xs text-red-400">{loadError}</p>
            <button type="button" onClick={() => void loadTemplates()} className="text-xs text-red-400 underline">Retry</button>
          </div>
        )}

        {!loading && !searching && items.length === 0 && !loadError && (
          <div className="glass-panel rounded-xl p-12 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-14 h-14 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
              <LayoutTemplate className="w-7 h-7 text-[var(--color-primary-light)]" />
            </div>
            <p className="text-[var(--color-text-secondary)] text-sm font-medium mb-1">
              {showSearchResults ? "No templates match your search" : "No templates loaded"}
            </p>
            <p className="text-[var(--color-text-tertiary)] text-xs mb-5">
              {showSearchResults
                ? "Try a different search or clear the search box."
                : "Templates come from the registry. Start from a prompt to generate a contract."}
            </p>
            {showSearchResults ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-xs font-medium"
              >
                Clear search
              </button>
            ) : (
              <Link
                href={ROUTES.HOME}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-primary-gradient text-white text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Create from prompt
              </Link>
            )}
          </div>
        )}

        {!loading && !searching && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, idx) => {
              const isSelected = compareIds.has(item.id);
              const difficulty = idx % 3 === 0 ? "Beginner" : idx % 3 === 1 ? "Intermediate" : "Advanced";
              const uses = Math.floor(Math.random() * 1000) + 100;
              
              return (
              <div
                key={item.id}
                className={`glass-panel rounded-xl p-5 transition-all relative overflow-hidden group ${isSelected ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)] bg-[var(--color-primary-alpha-10)]' : 'hover:border-[var(--color-primary-alpha-50)]'}`}
                onMouseEnter={() => setHoveredTemplate(item.id)}
                onMouseLeave={() => setHoveredTemplate(null)}
              >
                <div className="absolute top-3 right-3 z-10" onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCompare(item.id)}
                    className="w-4 h-4 rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-[var(--color-primary)] focus:ring-[var(--color-primary-alpha-50)] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Compare"
                  />
                  {isSelected && <CheckSquare className="w-4 h-4 text-[var(--color-primary)]" />}
                </div>

                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                    <LayoutTemplate className="w-5 h-5 text-[var(--color-primary-light)]" />
                  </div>
                  <div className="min-w-0 flex-1 pr-6">
                    <h3 className="font-medium text-white truncate text-sm">{item.name || item.id}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${difficulty === 'Beginner' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : difficulty === 'Intermediate' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-red-500/30 text-red-400 bg-red-500/10'}`}>
                        {difficulty}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                        <BarChart className="w-3 h-3" /> {uses.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-2 h-8 mb-4">
                  {item.description || "No description"}
                </p>

                {hoveredTemplate === item.id && (
                  <div className="absolute inset-0 bg-[var(--color-bg-panel)] bg-opacity-95 backdrop-blur-sm z-20 p-4 flex flex-col justify-between animate-enter opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="overflow-hidden rounded border border-[var(--color-border-subtle)]">
                      <SyntaxHighlighter
                        language="solidity"
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, padding: '8px', fontSize: '8px', background: 'transparent' }}
                      >
{`contract ${item.name?.replace(/\s/g, '') || 'Template'} {
  uint256 public value;
  
  function initialize() public {
    value = 1;
  }
}`}
                      </SyntaxHighlighter>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Link
                        href={`${ROUTES.HOME}?template=${encodeURIComponent(item.id)}`}
                        className="flex-1 btn-primary-gradient text-white text-xs py-1.5 rounded-lg text-center"
                      >
                        Use Template
                      </Link>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border-subtle)] mt-auto">
                  {item.source ? (
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {item.source}
                    </span>
                  ) : <span />}
                  <Link
                    href={`${ROUTES.HOME}?template=${encodeURIComponent(item.id)}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-light)] hover:text-[#C4B5FD]"
                  >
                    Use template &rarr;
                  </Link>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<div className="p-6 flex items-center justify-center"><Search className="w-6 h-6 animate-pulse text-[var(--color-text-muted)]" /></div>}>
      <TemplatesContent />
    </Suspense>
  );
}
