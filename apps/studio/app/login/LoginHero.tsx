"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  FeatureCarousel,
  type FeatureCarouselItem,
  GradientText,
  LiquidGlass,
  LogoLoop,
  type LogoLoopItem,
  PipelineDemo,
} from "@/components/ui";
import { CLI_VERSION } from "@/constants/routes";

function MythXLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- MythX CDN SVG
    <img
      src="https://mythx.io/static/img/MythX_logo_Horizontal.svg"
      alt="MythX"
      className="h-6 w-auto object-contain opacity-75"
      style={{
        height: 24,
        width: "auto",
        filter: "brightness(0) invert(1)",
      }}
    />
  );
}

const LOGIN_FEATURE_CAROUSEL: FeatureCarouselItem[] = [
  {
    id: "pipeline",
    eyebrow: "End-to-end",
    title: "Spec → audit → simulation → deploy prep",
    description:
      "Natural language in, checked artifacts and deploy readiness on the supported network.",
  },
  {
    id: "byok",
    eyebrow: "Privacy",
    title: "Your keys stay yours (BYOK)",
    description:
      "Wallet plus in-app LLM keys. No server-side model secrets for your runs.",
  },
  {
    id: "v010",
    eyebrow: `What ships in v${CLI_VERSION}`,
    title: "SKALE Base first, multi-chain later",
    description:
      "One reliable path first. More chains after SLOs and observability are solid.",
  },
];

const UPCOMING_LOGOS: LogoLoopItem[] = [
  {
    id: "base",
    node: (
      <Image
        src="/Base_Logo.png"
        alt="Base"
        width={120}
        height={32}
        className="max-h-8 w-auto object-contain opacity-90"
        style={{ width: "auto", height: "auto" }}
      />
    ),
  },
  {
    id: "kite",
    node: (
      <Image
        src="/Kite_LogoWhite.png"
        alt="Kite"
        width={120}
        height={32}
        className="max-h-8 w-auto object-contain opacity-90"
        style={{ width: "auto", height: "auto" }}
      />
    ),
  },
  {
    id: "fil",
    node: (
      <Image
        src="/filecoin-logo.png"
        alt="Filecoin"
        width={140}
        height={32}
        className="max-h-8 w-auto object-contain opacity-90"
        style={{ width: "auto", height: "auto" }}
      />
    ),
  },
  {
    id: "avax",
    node: (
      <Image
        src="/AvalancheLogo_Horizontal_1C_Red.png"
        alt="Avalanche"
        width={160}
        height={32}
        className="max-h-8 w-auto object-contain opacity-90"
        style={{ width: "auto", height: "auto" }}
      />
    ),
  },
];

export function LoginHero() {
  return (
    <div className="hidden h-full min-h-0 w-1/2 flex-col items-start justify-center overflow-hidden px-8 py-5 xl:px-12 lg:flex">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg space-y-3 lg:max-h-full lg:overflow-hidden xl:space-y-4"
      >
        <div className="relative shrink-0">
          <Image
            src="/hyperkit-header-white.svg"
            alt="Hyperkit"
            width={240}
            height={80}
            className="max-h-10 w-auto xl:max-h-12"
            style={{ width: "auto", height: "auto" }}
            priority
          />
        </div>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-base leading-snug text-[var(--color-text-tertiary)] xl:text-lg"
        >
          <GradientText as="span" className="font-semibold">
            AI-powered
          </GradientText>{" "}
          smart contract development platform for SKALE Base.{" "}
          <span className="text-[var(--color-text-primary)] font-medium">
            From spec to checked deploy prep on the current supported network.
          </span>
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5 }}
          className="w-full max-w-md shrink-0"
        >
          <LiquidGlass intensity="soft" className="p-3">
            <FeatureCarousel
              items={LOGIN_FEATURE_CAROUSEL}
              dense
              intervalMs={7000}
            />
          </LiquidGlass>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="shrink-0"
        >
          <PipelineDemo />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex min-h-0 w-full max-w-[460px] flex-col gap-3 overflow-hidden pt-2 xl:gap-4"
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex flex-col items-start gap-2">
              <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Infrastructure by
              </span>
              <div className="flex h-7 items-center gap-3">
                <Image
                  src="/Thirdweb.png"
                  alt="Thirdweb"
                  width={120}
                  height={24}
                  className="max-h-6 w-auto object-contain opacity-75"
                  style={{ width: "auto", height: "auto" }}
                />
                <Image
                  src="/tenderly-logo.png"
                  alt="Tenderly"
                  width={100}
                  height={24}
                  className="max-h-6 w-auto object-contain opacity-75 brightness-0 invert"
                  style={{ width: "auto", height: "auto" }}
                />
                <Image
                  src="/pinata-ipfs.png"
                  alt="Pinata"
                  width={80}
                  height={24}
                  className="max-h-6 w-auto object-contain opacity-75 brightness-0 invert"
                  style={{ width: "auto", height: "auto" }}
                />
                <Image
                  src="/SentientAGI.png"
                  alt="SentientAGI"
                  width={100}
                  height={24}
                  className="max-h-6 w-auto object-contain opacity-75 brightness-0 invert"
                  style={{ width: "auto", height: "auto" }}
                />
              </div>
            </div>

            <div className="flex flex-col items-start gap-2">
              <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Secured by
              </span>
              <div className="flex h-7 items-center gap-3">
                <Image
                  src="/slither-logo.png"
                  alt="Slither"
                  width={160}
                  height={36}
                  className="max-h-9 w-auto object-contain opacity-75 brightness-0 invert [-mt-1]"
                  style={{ width: "auto", height: "auto" }}
                />
                <MythXLogo />
                <Image
                  src="/pashov-logo-white.png"
                  alt="Pashov Audit Group"
                  width={120}
                  height={24}
                  className="max-h-6 w-auto object-contain opacity-75"
                  style={{ width: "auto", height: "auto" }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 w-full overflow-hidden">
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Supported in v0.1.0
            </span>
            <div className="flex flex-col items-start gap-2">
              <Image
                src="/skale-logo.png"
                alt="SKALE"
                width={48}
                height={48}
                className="brightness-0 invert object-contain"
                style={{ width: "auto", height: "auto", maxHeight: "3rem" }}
              />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {`Base (Mainnet & Sepolia)`}
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-2 overflow-hidden">
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Up next
            </span>
            <LogoLoop
              className="min-h-[2.75rem] w-full"
              items={UPCOMING_LOGOS}
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
