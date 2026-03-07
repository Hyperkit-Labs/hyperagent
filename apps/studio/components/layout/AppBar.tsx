"use client";

import Link from "next/link";
import Image from "next/image";
import { Settings } from "lucide-react";
import { ConnectWalletNav } from "@/components/wallet/ConnectWalletNav";
import { NetworkSelector } from "@/components/layout/NetworkSelector";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { ROUTES } from "@/constants/routes";

export function AppBar() {
  return (
    <header className="h-16 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/90 backdrop-blur-md flex items-center justify-between px-6 z-40 shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        <Link href={ROUTES.HOME} className="flex items-center gap-2 shrink-0">
          <Image
            src="/hyperkit-header-white.svg"
            alt="Hyperkit"
            width={140}
            height={47}
            className="h-9 w-auto object-contain"
          />
        </Link>
      </div>

      <div className="flex items-center justify-end gap-4 shrink-0">
        <NetworkSelector />
        <div className="h-5 w-px bg-[var(--color-border-default)] hidden sm:block" />

        <div className="flex items-center gap-2">
          <NotificationsDropdown />
          <ConnectWalletNav />
          <Link href={ROUTES.SETTINGS} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1" aria-label="Settings">
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
