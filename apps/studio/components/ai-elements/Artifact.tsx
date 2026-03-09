'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';

export interface ArtifactProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** Root container. Registry-style: header, close, title, actions, content. */
export function ArtifactRoot({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

export function ArtifactHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-4 p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] ${className}`}>
      {children}
    </div>
  );
}

export function ArtifactClose({ onClick, children }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
      aria-label="Close"
    >
      {children ?? <X className="w-4 h-4" />}
    </button>
  );
}

export function ArtifactTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-bold text-[var(--color-text-primary)] truncate ${className}`}>{children}</h3>;
}

export function ArtifactDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-sm text-[var(--color-text-tertiary)] truncate hidden sm:inline ${className}`}>{children}</span>;
}

export function ArtifactActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 shrink-0">{children}</div>;
}

export function ArtifactContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 space-y-4 ${className}`}>{children}</div>;
}

export function Artifact({
  title,
  description,
  children,
  actions,
  defaultOpen = true,
  className = '',
}: ArtifactProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <ArtifactRoot className={className}>
      <ArtifactHeader>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-left min-w-0 flex-1"
        >
          {open ? (
            <ChevronDown className="w-4 h-4 shrink-0 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0 text-[var(--color-text-muted)]" />
          )}
          <ArtifactTitle>{title}</ArtifactTitle>
          {description && <ArtifactDescription>{description}</ArtifactDescription>}
        </button>
        {actions && <ArtifactActions>{actions}</ArtifactActions>}
      </ArtifactHeader>
      {open && <ArtifactContent>{children}</ArtifactContent>}
    </ArtifactRoot>
  );
}
