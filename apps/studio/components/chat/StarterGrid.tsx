"use client";

import { Code2, Shield, Bug, Rocket } from "lucide-react";
import { motion } from "framer-motion";
import { SpotlightCard } from "@/components/ui";

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
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto ${className}`}
    >
      {DEFAULT_STARTERS.map((card, i) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06 }}
          className="group relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-semantic-violet)] rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
          <SpotlightCard className="relative hover:shadow-[0_0_20px_var(--color-primary-alpha-20)] hover:-translate-y-1 transition-all duration-300 border-[var(--color-border-subtle)] hover:border-[var(--color-primary-alpha-30)]">
            <button
              type="button"
              onClick={() => onSelect(card.prompt)}
              className="flex flex-col items-start gap-3 p-6 w-full text-left"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-alpha-10)] text-[var(--color-primary-light)] group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors shadow-sm">
                {card.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary-light)] transition-colors">
                  {card.label}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 line-clamp-2">
                  {card.prompt}
                </p>
              </div>
            </button>
          </SpotlightCard>
        </motion.div>
      ))}
    </div>
  );
}
