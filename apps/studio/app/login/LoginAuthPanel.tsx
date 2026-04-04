"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { SessionGate } from "@/components/auth/SessionGate";
import { useTrackRecord } from "@/hooks/useTrackRecord";
import { NumberTicker } from "@/components/ui";

export function LoginAuthPanel() {
  const { trackRecord } = useTrackRecord();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-8 w-full max-w-md">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
      >
        <div className="lg:hidden text-center mb-8">
          <Image
            src="/hyperkit-header-white.svg"
            alt="Hyperkit"
            width={160}
            height={52}
            className="h-10 w-auto mx-auto"
            priority
          />
          <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
            AI-powered smart contract development platform
          </p>
        </div>

        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-[var(--color-primary-alpha-10)]">
          <div className="p-6 lg:p-8 relative">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary-alpha-50)] to-transparent" />
            <SessionGate
              title="Sign in to get started"
              description="Connect your wallet to start building. No gas fees."
              noWrapper={true}
            />
          </div>

          <div className="border-t border-[var(--color-border-subtle)] border-dashed opacity-50" />

          <div className="bg-[var(--color-bg-panel)]/30 p-6 lg:p-8">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
              Track Record
            </p>
            <div className="grid grid-cols-2 gap-3">
              {trackRecord.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.25 + i * 0.08,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="group relative flex flex-col items-start rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/50 p-4 transition-all duration-300 hover:border-[var(--color-primary-alpha-50)] hover:shadow-[0_0_0_1px_var(--color-primary-alpha-30),0_0_20px_var(--color-primary-alpha-20),0_0_40px_var(--color-primary-alpha-10)]"
                >
                  <p className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">
                    {item.prefix}
                    <NumberTicker value={item.value} />
                    {item.suffix}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-0.5">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
