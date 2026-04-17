"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { PipelineDemo } from "@/components/ui";

export function LoginHero() {
  return (
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
            className="max-h-14 xl:max-h-16 w-auto"
            style={{ width: "auto", height: "auto" }}
            priority
          />
        </div>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-xl xl:text-2xl text-[var(--color-text-tertiary)] leading-relaxed"
        >
          AI-powered smart contract development platform for SKALE Base.{" "}
          <span className="text-[var(--color-text-primary)] font-medium">
            From spec to checked deploy prep on the current supported network.
          </span>
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
            <div className="flex flex-col items-start gap-2">
              <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Infrastructure by
              </span>
              <div className="h-8 flex items-center gap-4">
                <Image
                  src="/Thirdweb.png"
                  alt="Thirdweb"
                  width={120}
                  height={24}
                  className="max-h-6 w-auto opacity-75 object-contain"
                  style={{ width: "auto", height: "auto" }}
                />
                <Image
                  src="/tenderly-logo.png"
                  alt="Tenderly"
                  width={100}
                  height={24}
                  className="max-h-6 w-auto opacity-75 object-contain brightness-0 invert"
                  style={{ width: "auto", height: "auto" }}
                />
                <Image
                  src="/pinata-ipfs.png"
                  alt="Pinata"
                  width={80}
                  height={24}
                  className="max-h-6 w-auto opacity-75 object-contain brightness-0 invert"
                  style={{ width: "auto", height: "auto" }}
                />
                <Image
                  src="/SentientAGI.png"
                  alt="SentientAGI"
                  width={100}
                  height={24}
                  className="max-h-6 w-auto opacity-75 object-contain brightness-0 invert"
                  style={{ width: "auto", height: "auto" }}
                />
              </div>
            </div>

            <div className="flex flex-col items-start gap-2">
              <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Secured by
              </span>
              <div className="h-8 flex items-center gap-4">
                <Image
                  src="/slither-logo.png"
                  alt="Slither"
                  width={160}
                  height={36}
                  className="max-h-9 w-auto opacity-75 object-contain brightness-0 invert [-mt-1]"
                  style={{ width: "auto", height: "auto" }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://mythx.io/static/img/MythX_logo_Horizontal.svg"
                  alt="MythX"
                  className="opacity-75 object-contain h-6 w-auto"
                  style={{
                    height: 24,
                    width: "auto",
                    filter: "brightness(0) invert(1)",
                  }}
                />
                <Image
                  src="/pashov-logo-white.png"
                  alt="Pashov Audit Group"
                  width={120}
                  height={24}
                  className="max-h-6 w-auto opacity-75 object-contain"
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

          <div className="flex flex-col items-start gap-3 w-full overflow-hidden">
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Up next
            </span>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <Image
                src="/Base_Logo.png"
                alt="Base"
                width={120}
                height={32}
                className="max-h-8 w-auto object-contain"
                style={{ width: "auto", height: "auto" }}
              />
              <Image
                src="/Kite_LogoWhite.png"
                alt="Kite"
                width={120}
                height={32}
                className="max-h-8 w-auto object-contain"
                style={{ width: "auto", height: "auto" }}
              />
              <Image
                src="/filecoin-logo.png"
                alt="Filecoin"
                width={140}
                height={32}
                className="max-h-8 w-auto object-contain"
                style={{ width: "auto", height: "auto" }}
              />
              <Image
                src="/AvalancheLogo_Horizontal_1C_Red.png"
                alt="Avalanche"
                width={160}
                height={32}
                className="max-h-8 w-auto object-contain"
                style={{ width: "auto", height: "auto" }}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
