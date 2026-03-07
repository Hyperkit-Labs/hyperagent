"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
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

function fetchLlmConfigured(): Promise<boolean> {
  return getConfiguredLLMProviders()
    .then((r) => Array.isArray(r?.configured_providers) && r.configured_providers.length > 0)
    .catch(() => false);
}

function hasSessionKey(): boolean {
  if (typeof window === "undefined") return false;
  const k = getSessionOnlyLLMKey();
  return Boolean(k?.provider && k?.apiKey?.trim());
}

export function useOnboarding() {
  const account = useActiveAccount();
  const { hasSession } = useSession();
  const { workflows } = useWorkflows({ filters: { limit: 1 } });
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [sessionKeyActive, setSessionKeyActive] = useState(false);

  const refetchByok = useCallback(() => {
    fetchLlmConfigured().then(setLlmConfigured);
  }, []);

  const refreshSessionKey = useCallback(() => {
    setSessionKeyActive(hasSessionKey());
  }, []);

  useEffect(() => {
    refetchByok();
    refreshSessionKey();
  }, [refetchByok, refreshSessionKey, hasSession]);

  useEffect(() => {
    const onByok = () => refetchByok();
    const onSession = () => refreshSessionKey();
    window.addEventListener(BYOK_UPDATED_EVENT, onByok);
    window.addEventListener(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT, onSession);
    return () => {
      window.removeEventListener(BYOK_UPDATED_EVENT, onByok);
      window.removeEventListener(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT, onSession);
    };
  }, [refetchByok, refreshSessionKey]);

  const step1 = !!account;
  const step2 = llmConfigured === true || sessionKeyActive;
  const step3 = (workflows?.length ?? 0) > 0;

  const steps: OnboardingStep[] = [
    { id: "connect", label: "Connect wallet", done: step1, href: ROUTES.LOGIN, cta: "Connect wallet" },
    { id: "byok", label: "Add LLM keys", done: step2, href: ROUTES.SETTINGS, cta: "Add keys in Settings" },
    { id: "workflow", label: "Create first workflow", done: step3, href: ROUTES.HOME, cta: "Create workflow" },
  ];

  const nextStep = steps.find((s) => !s.done) ?? null;
  const completed = steps.every((s) => s.done);

  return { steps, nextStep, completed };
}
