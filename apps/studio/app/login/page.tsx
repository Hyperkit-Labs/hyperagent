"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { useSession } from "@/hooks/useSession";
import { useTrackRecord } from "@/hooks/useTrackRecord";
import { SessionGate } from "@/components/auth/SessionGate";
import { ROUTES } from "@/constants/routes";
import Image from "next/image";
import { motion } from "framer-motion";

import { PipelineDemo, NumberTicker } from "@/components/ui";
import { useServerStatus } from "@/hooks/useServerStatus";

const CHAIN_LOGOS = [
  { src: "/arbitrum-white.png", alt: "Arbitrum" },
  { src: "/AvalancheLogo_Horizontal_1C_Red.png", alt: "Avalanche" },
  { src: "/Base_Logo.png", alt: "Base" },
  { src: "/bnb-chain-logo.png", alt: "BNB Chain" },
  { src: "/filecoin-logo.png", alt: "Filecoin" },
  { src: "/KITE_AI.png", alt: "KITE AI" },
  { src: "/MantleNetwork-White.png", alt: "Mantle Network" },
  { src: "/skale-logo.png", alt: "SKALE" },
  { src: "/Solana-Logo-white.png", alt: "Solana" },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccount();
  const { hasSession, isReady } = useSession();
  const { trackRecord } = useTrackRecord();
  const serverStatus = useServerStatus();

  useEffect(() => {
    if (!isReady || !hasSession || !account) return;
    const next = searchParams.get("next");
    const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : ROUTES.HOME;
    router.replace(destination);
  }, [isReady, hasSession, account, router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-base)] bg-web3">
      {/* Server status badge — top-right */}
      <div className="fixed top-4 right-4 z-10 flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            serverStatus === "up"
              ? "bg-emerald-500"
              : serverStatus === "down"
                ? "bg-red-500"
                : "animate-pulse bg-amber-500"
          }`}
          aria-hidden
        />
        <span className="text-[var(--color-text-secondary)]">
          Server: {serverStatus === "up" ? "Up" : serverStatus === "down" ? "Down" : "Checking…"}
        </span>
      </div>
      <div className="absolute inset-0 grid-pattern bg-grid" aria-hidden />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[50vw] h-[60vh] max-w-[600px] pointer-events-none hidden lg:block" aria-hidden>
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: "radial-gradient(ellipse 80% 80% at 20% 50%, rgba(124, 58, 237, 0.25) 0%, transparent 60%)",
          }}
        />
      </div>

      <div className="relative flex-1 flex flex-col lg:flex-row min-h-screen items-center justify-center">
        {/* Left panel: hero brand showcase */}
        <div className="hidden lg:flex lg:w-1/2 flex-col items-start justify-center px-12 xl:px-20 py-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8 max-w-lg"
          >
            <div className="relative">
              <Image
                src="/hyperkit-header-white.svg"
                alt="Hyperkit"
                width={240}
                height={80}
                className="h-14 xl:h-16 w-auto"
                priority
              />
            </div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-xl xl:text-2xl text-[var(--color-text-tertiary)] leading-relaxed"
            >
              AI-powered smart contract development platform.{" "}
              <span className="text-[var(--color-text-primary)] font-medium">From spec to production in minutes.</span>
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="mt-6"
            >
              <PipelineDemo />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="pt-8 flex flex-col gap-8 w-full max-w-[480px]"
            >
              <div className="flex flex-wrap items-center gap-x-10 gap-y-8">
                {/* Infrastructure by */}
                <div className="flex flex-col items-start gap-2">
                  <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Infrastructure by</span>
                  <div className="h-8 flex items-center gap-4">
                    <Image src="/Thirdweb.png" alt="Thirdweb" width={120} height={24} className="opacity-75 object-contain" style={{ height: 24, width: "auto" }} />
                    <Image src="/tenderly-logo.png" alt="Tenderly" width={100} height={24} className="opacity-75 object-contain brightness-0 invert" style={{ height: 24, width: "auto" }} />
                    <Image src="/pinata-ipfs.png" alt="Pinata" width={80} height={24} className="opacity-75 object-contain brightness-0 invert" style={{ height: 24, width: "auto" }} />
                    <Image src="/SentientAGI.png" alt="SentientAGI" width={100} height={24} className="opacity-75 object-contain brightness-0 invert" style={{ height: 24, width: "auto" }} />
                  </div>
                </div>

                {/* Secured by (Slither + MythX + Pashov) */}
                <div className="flex flex-col items-start gap-2">
                  <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Secured by</span>
                  <div className="h-8 flex items-center gap-4">
                    <Image src="/slither-logo.png" alt="Slither" width={160} height={36} className="opacity-75 object-contain brightness-0 invert" style={{ height: 36, width: "auto", marginTop: "-4px" }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://mythx.io/static/img/MythX_logo_Horizontal.svg" alt="MythX" className="opacity-75 object-contain h-6 w-auto" style={{ height: 24, width: "auto", filter: "brightness(0) invert(1)" }} />
                    <Image src="/pashov-logo-white.png" alt="Pashov Audit Group" width={120} height={24} className="opacity-75 object-contain" style={{ height: 24, width: "auto" }} />
                  </div>
                </div>
              </div>

              {/* Multi-chain */}
              <div className="flex flex-col items-start gap-2 w-full overflow-hidden">
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Multi-chain</span>
                <div className="w-full relative" style={{ maskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)" }}>
                  <motion.div
                    className="flex items-center gap-8 pr-8 w-max"
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{ repeat: Infinity, ease: "linear", duration: 20 }}
                  >
                    {[...CHAIN_LOGOS, ...CHAIN_LOGOS].map((chain, i) => (
                      <Image
                        key={`${chain.alt}-${i}`}
                        src={chain.src}
                        alt={chain.alt}
                        width={80}
                        height={24}
                        className={`opacity-75 object-contain shrink-0 ${['SKALE', 'KITE AI'].includes(chain.alt) ? 'brightness-0 invert' : ''}`}
                        style={{ height: 24, width: "auto", maxWidth: 80 }}
                      />
                    ))}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Right panel: auth + value props — vertically centered with left */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-8 w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <div className="lg:hidden text-center mb-8">
              <Image src="/hyperkit-header-white.svg" alt="Hyperkit" width={160} height={52} className="h-10 w-auto mx-auto" priority />
              <p className="text-sm text-[var(--color-text-tertiary)] mt-2">AI-powered smart contract development platform</p>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-[var(--color-primary-alpha-10)]">
              {/* Top half: Login */}
              <div className="p-6 lg:p-8 relative">
                {/* Subtle top glow */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary-alpha-50)] to-transparent" />
                <SessionGate
                  title="Sign in to get started"
                  description="Connect your wallet to start building. No gas fees."
                  noWrapper={true}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--color-border-subtle)] border-dashed opacity-50" />

              {/* Bottom half: Track Record */}
              <div className="bg-[var(--color-bg-panel)]/30 p-6 lg:p-8">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Track Record</p>
                <div className="grid grid-cols-2 gap-3">
                  {trackRecord.map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.25 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                      className="group relative flex flex-col items-start rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/50 p-4 transition-all duration-300 hover:border-[var(--color-primary-alpha-50)] hover:shadow-[0_0_0_1px_var(--color-primary-alpha-30),0_0_20px_var(--color-primary-alpha-20),0_0_40px_var(--color-primary-alpha-10)]"
                    >
                      <p className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">
                        {item.prefix}
                        <NumberTicker value={item.value} />
                        {item.suffix}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-0.5">{item.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)]" />}>
      <LoginContent />
    </Suspense>
  );
}
