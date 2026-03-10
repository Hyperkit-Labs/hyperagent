'use client';

import { getExplorerUrl } from '@/lib/utils';
import { ExternalLink } from 'lucide-react'

interface ExplorerLinkProps {
  network: string;
  type: 'tx' | 'address';
  value: string;
  label?: string;
}

export function ExplorerLink({ network, type, value, label }: ExplorerLinkProps) {
  const url = getExplorerUrl(network, type, value);

  if (!url) {
    return <span className="text-[var(--color-text-muted)]">{value}</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[var(--color-primary-light)] hover:text-[var(--color-primary)] hover:underline"
    >
      {label || value}
      <ExternalLink className="w-4 h-4" />
    </a>
  );
}

