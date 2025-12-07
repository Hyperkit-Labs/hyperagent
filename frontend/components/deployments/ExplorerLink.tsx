'use client';

import { getExplorerUrl } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface ExplorerLinkProps {
  network: string;
  type: 'tx' | 'address';
  value: string;
  label?: string;
}

export function ExplorerLink({ network, type, value, label }: ExplorerLinkProps) {
  const url = getExplorerUrl(network, type, value);

  if (!url) {
    return <span className="text-gray-500">{value}</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
    >
      {label || value}
      <ExternalLink className="w-4 h-4" />
    </a>
  );
}

