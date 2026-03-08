"use client";

import { Code2, Shield, Bug, Rocket } from "lucide-react";

export interface StarterCard {
  id: string;
  label: string;
  prompt: string;
  icon: React.ReactNode;
}

const DEFAULT_STARTERS: StarterCard[] = [
  {
    id: "deploy-token",
    label: "Deploy a Token",
    prompt: "Create an ERC20 token with customizable name and symbol",
    icon: <Code2 className="w-6 h-6" />,
  },
  {
    id: "audit-vault",
    label: "Audit a Vault",
    prompt: "Build and audit a secure vault contract for asset management",
    icon: <Shield className="w-6 h-6" />,
  },
  {
    id: "simulate-exploit",
    label: "Simulate an Exploit",
    prompt: "Generate a contract and run exploit simulation",
    icon: <Bug className="w-6 h-6" />,
  },
  {
    id: "deploy-dapp",
    label: "Deploy a dApp",
    prompt: "Create a full dApp with smart contract and frontend",
    icon: <Rocket className="w-6 h-6" />,
  },
];

export interface StarterGridProps {
  onSelect: (prompt: string) => void;
  className?: string;
}

export function StarterGrid({ onSelect, className = "" }: StarterGridProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto ${className}`}>
      {DEFAULT_STARTERS.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onSelect(card.prompt)}
          className="group flex flex-col items-start gap-3 p-6 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/60 backdrop-blur-sm hover:border-[var(--color-primary-alpha-30)] hover:bg-[var(--color-bg-panel)] transition-all duration-200 text-left"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-alpha-15)] text-[var(--color-primary-light)] group-hover:bg-[var(--color-primary-alpha-25)] transition-colors">
            {card.icon}
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{card.label}</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 line-clamp-2">{card.prompt}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
