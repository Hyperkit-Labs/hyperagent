"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getConfiguredLLMProviders, getCreditsBalance } from "@/lib/api";
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

function hasSessionKey(): boolean {
  if (typeof window === "undefined") return false;
  const k = getSessionOnlyLLMKey();
  return Boolean(k?.provider && k?.apiKey?.trim());
}

/** Single batched fetch for LLM config + credits. Reduces parallel calls on mount. */
async function fetchByokAndCredits(hasSession: boolean): Promise<{ llmConfigured: boolean; hasCredits: boolean }> {
  const [llmRes, creditsRes] = await Promise.all([
    getConfiguredLLMProviders()
      .then((r) => Array.isArray(r?.configured_providers) && r.configured_providers.length > 0)
      .catch(() => false),
    hasSession ? getCreditsBalance().then((r) => (r.balance ?? 0) > 0).catch(() => false) : Promise.resolve(false),
  ]);
  return { llmConfigured: llmRes, hasCredits: creditsRes };
}

export function useOnboarding() {
  const account = useActiveAccount();
  const { hasSession } = useSession();
  const { workflows } = useWorkflows({ filters: { limit: 1 } });
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [sessionKeyActive, setSessionKeyActive] = useState(false);
  const [hasCredits, setHasCredits] = useState(false);

  const refetchByokAndCredits = useCallback(() => {
    fetchByokAndCredits(!!hasSession).then(({ llmConfigured: l, hasCredits: c }) => {
      setLlmConfigured(l);
      setHasCredits(c);
    });
  }, [hasSession]);

  const refreshSessionKey = useCallback(() => {
    setSessionKeyActive(hasSessionKey());
  }, []);

  const refetchCredits = useCallback(() => {
    refetchByokAndCredits();
  }, [refetchByokAndCredits]);

  useEffect(() => {
    refetchByokAndCredits();
    refreshSessionKey();
  }, [refetchByokAndCredits, refreshSessionKey]);

  useEffect(() => {
    const onByok = () => refetchByokAndCredits();
    const onSession = () => refreshSessionKey();
    window.addEventListener(BYOK_UPDATED_EVENT, onByok);
    window.addEventListener(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT, onSession);
    return () => {
      window.removeEventListener(BYOK_UPDATED_EVENT, onByok);
      window.removeEventListener(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT, onSession);
    };
  }, [refetchByokAndCredits, refreshSessionKey]);

  const step1 = !!account;
  const step2 = llmConfigured === true || sessionKeyActive;
  const step3 = hasCredits;
  const step4 = (workflows?.length ?? 0) > 0;

  const steps: OnboardingStep[] = [
    { id: "connect", label: "Connect wallet", done: step1, href: ROUTES.LOGIN, cta: "Connect wallet" },
    { id: "byok", label: "Add LLM keys", done: step2, href: ROUTES.SETTINGS, cta: "Add keys in Settings" },
    { id: "payment", label: "Add budget (USDC/USDT)", done: step3, href: ROUTES.PAYMENTS, cta: "Add budget in Payment" },
    { id: "workflow", label: "Create first workflow", done: step4, href: ROUTES.HOME, cta: "Create workflow" },
  ];

  const nextStep = steps.find((s) => !s.done) ?? null;
  const completed = steps.every((s) => s.done);

  return { steps, nextStep, completed, refetchCredits };
}
