"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { useSession } from "@/hooks/useSession";
import { SessionGate } from "@/components/auth/SessionGate";
import { ROUTES } from "@/constants/routes";
import { Zap, Shield, Globe, Clock } from "lucide-react";

const VALUE_PROPS = [
  { icon: Zap, title: "Build in seconds", desc: "Generate production-grade smart contracts from a single prompt" },
  { icon: Shield, title: "Auto-audited", desc: "Every contract scanned by Slither and simulated on Tenderly" },
  { icon: Globe, title: "Multi-chain", desc: "Deploy across EVM networks with one click" },
  { icon: Clock, title: "Full pipeline", desc: "Spec, design, codegen, audit, simulate, deploy. All automated" },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccount();
  const { hasSession, isReady } = useSession();

  useEffect(() => {
    if (!isReady || !hasSession || !account) return;
    const next = searchParams.get("next");
    const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : ROUTES.HOME;
    router.replace(destination);
  }, [isReady, hasSession, account, router, searchParams]);

  return (
    <div className="min-h-screen flex bg-[var(--color-bg-base)]">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Hyperkit</h1>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-2">AI-powered smart contract development platform</p>
          </div>

          <SessionGate
            title="Sign in to get started"
            description="Connect your wallet to securely manage workflows, LLM keys, and deployments. No gas fees to sign in."
          />

          <div className="grid grid-cols-2 gap-3">
            {VALUE_PROPS.map((vp) => {
              const Icon = vp.icon;
              return (
                <div key={vp.title} className="glass-panel rounded-lg p-3">
                  <Icon className="w-4 h-4 text-purple-400 mb-2" />
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">{vp.title}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{vp.desc}</p>
                </div>
              );
            })}
          </div>
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
