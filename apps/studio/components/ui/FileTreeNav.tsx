"use client";

import { useState } from "react";
import { ChevronRight, FileCode, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileTreeNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
}

function TreeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isFolder = node.type === "folder";
  const sel = selectedId === node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isFolder) setOpen(!open);
          else onSelect(node.id);
        }}
        className={cn(
          "flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-[12px] transition-colors",
          sel
            ? "bg-[var(--color-bg-panel)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-panel)] hover:text-[var(--color-text-primary)]",
        )}
        style={{ paddingLeft: 6 + depth * 10 }}
      >
        {isFolder ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              open && "rotate-90",
            )}
            aria-hidden
          />
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden />
        )}
        {isFolder ? (
          <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
        ) : (
          <FileCode className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary-light)]" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isFolder && open && node.children?.length ? (
        <div>
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FileTreeNav({
  nodes,
  selectedId,
  onSelect,
  className = "",
}: {
  nodes: FileTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <nav className={cn("space-y-0.5", className)} aria-label="File tree">
      {nodes.map((n) => (
        <TreeRow
          key={n.id}
          node={n}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}
