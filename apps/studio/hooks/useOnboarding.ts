"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveAccount, useActiveWalletChain } from "thirdweb/react";
import { getConfiguredLLMProviders } from "@/lib/api";
import { useWorkflows } from "@/hooks/useWorkflows";
import { useSession } from "@/hooks/useSession";
import { ROUTES } from "@/constants/routes";
import {
  BYOK_UPDATED_EVENT,
  SESSION_LLM_PASS_THROUGH_UPDATED_EVENT,
  getSessionOnlyLLMKey,
} from "@/lib/session-store";

export interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

/**
 * Chain IDs where x402 payment is supported for v0.1.0.
 * Source of truth: infra/registries/network/chains.yaml (hyperagent.capabilities.x402: true)
 * and docs/architecture/networks.md (v0.1.0 launch targets).
 */
const X402_SUPPORTED_CHAIN_IDS = new Set([
  1187947933, // SKALE Base Mainnet
  324705682, // SKALE Base Sepolia
]);

function hasSessionKey(): boolean {
  if (typeof window === "undefined") return false;
  const k = getSessionOnlyLLMKey();
  return Boolean(k?.provider && k?.apiKey?.trim());
}

async function fetchLlmConfig(): Promise<boolean> {
  return getConfiguredLLMProviders()
    .then(
      (r) =>
        Array.isArray(r?.configured_providers) &&
        r.configured_providers.length > 0,
    )
    .catch(() => false);
}

export function useOnboarding() {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const { hasSession } = useSession();
  const { workflows } = useWorkflows({ filters: { limit: 1 } });
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [sessionKeyActive, setSessionKeyActive] = useState(false);

  const refetchLlm = useCallback(() => {
    fetchLlmConfig().then(setLlmConfigured);
  }, []);

  const refreshSessionKey = useCallback(() => {
    setSessionKeyActive(hasSessionKey());
  }, []);

  // Expose a stable refetch handle (previously called refetchCredits; name kept for
  // backward compat with any consumers that destructure it).
  const refetchCredits = useCallback(() => {
    refetchLlm();
  }, [refetchLlm]);

  useEffect(() => {
    if (hasSession) refetchLlm();
    refreshSessionKey();
  }, [hasSession, refetchLlm, refreshSessionKey]);

  useEffect(() => {
    const onByok = () => refetchLlm();
    const onSession = () => refreshSessionKey();
    window.addEventListener(BYOK_UPDATED_EVENT, onByok);
    window.addEventListener(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT, onSession);
    return () => {
      window.removeEventListener(BYOK_UPDATED_EVENT, onByok);
      window.removeEventListener(
        SESSION_LLM_PASS_THROUGH_UPDATED_EVENT,
        onSession,
      );
    };
  }, [refetchLlm, refreshSessionKey]);

  const step1 = !!account;
  const step2 = llmConfigured === true || sessionKeyActive;
  // x402 payment is automatic via wallet signature on supported networks.
  // Step 3 is complete once the wallet is connected on a SKALE Base network
  // (mainnet or sepolia) — the two v0.1.0 launch targets defined in the
  // chain registry. No separate credit deposit is required.
  const step3 = !!account && X402_SUPPORTED_CHAIN_IDS.has(activeChain?.id ?? 0);
  const step4 = (workflows?.length ?? 0) > 0;

  const steps: OnboardingStep[] = [
    {
      id: "connect",
      label: "Connect wallet",
      done: step1,
      href: ROUTES.LOGIN,
      cta: "Connect wallet",
    },
    {
      id: "byok",
      label: "Add LLM keys",
      done: step2,
      href: ROUTES.SETTINGS,
      cta: "Add keys in Settings",
    },
    {
      id: "payment",
      label: "Switch to SKALE Base",
      done: step3,
      href: ROUTES.NETWORKS,
      cta: "Switch network",
    },
    {
      id: "workflow",
      label: "Create first workflow",
      done: step4,
      href: ROUTES.HOME,
      cta: "Create workflow",
    },
  ];

  const nextStep = steps.find((s) => !s.done) ?? null;
  const completed = steps.every((s) => s.done);

  return { steps, nextStep, completed, refetchCredits };
}
