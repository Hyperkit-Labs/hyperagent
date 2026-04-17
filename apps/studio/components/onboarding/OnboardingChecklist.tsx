"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Check, ArrowRight, X } from "lucide-react";

const DISMISS_KEY = "hyperagent_onboarding_dismissed";

export interface OnboardingChecklistProps {
  onConnectClick?: () => void;
  onByokClick?: () => void;
  onPaymentClick?: () => void;
  onTryItNowClick?: () => void;
  className?: string;
}

export function OnboardingChecklist({
  onConnectClick,
  onByokClick,
  onPaymentClick,
  onTryItNowClick,
  className = "",
}: OnboardingChecklistProps) {
  const { steps, nextStep, completed } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem(DISMISS_KEY) === "1"
    ) {
      setDismissed(true);
    }
  }, []);

  if (completed) {
    return (
      <div
        className={`glass-panel rounded-xl p-4 border border-emerald-500/20 ${className}`.trim()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Check className="w-4 h-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Setup complete
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                You are ready to build. Create a workflow to generate your first
                contract.
              </p>
            </div>
          </div>
          {onTryItNowClick && (
            <button
              type="button"
              onClick={onTryItNowClick}
              className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] text-xs font-medium"
            >
              Try it Now
            </button>
          )}
        </div>
      </div>
    );
  }

  if (dismissed) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const progressPct = Math.round((doneCount / steps.length) * 100);
  const isConnectStep = nextStep?.id === "connect";
  const isByokStep = nextStep?.id === "byok";
  const isPaymentStep = nextStep?.id === "payment";
  const useConnectButton = isConnectStep && onConnectClick;
  const useByokButton = isByokStep && onByokClick;
  const usePaymentButton = isPaymentStep && onPaymentClick;

  const ctaButton =
    nextStep &&
    (useConnectButton ? (
      <button
        type="button"
        onClick={onConnectClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg btn-primary-gradient text-xs font-medium"
      >
        {nextStep.cta}
        <ArrowRight className="w-3 h-3" />
      </button>
    ) : useByokButton ? (
      <button
        type="button"
        onClick={onByokClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg btn-primary-gradient text-xs font-medium"
      >
        {nextStep.cta}
        <ArrowRight className="w-3 h-3" />
      </button>
    ) : usePaymentButton ? (
      <button
        type="button"
        onClick={onPaymentClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg btn-primary-gradient text-xs font-medium"
      >
        {nextStep.cta}
        <ArrowRight className="w-3 h-3" />
      </button>
    ) : (
      <Link
        href={nextStep.href}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg btn-primary-gradient text-xs font-medium"
      >
        {nextStep.cta}
        <ArrowRight className="w-3 h-3" />
      </Link>
    ));

  function handleDismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") sessionStorage.setItem(DISMISS_KEY, "1");
  }

  return (
    <div
      className={`glass-panel rounded-xl p-4 border border-[var(--color-border-subtle)] ${className}`.trim()}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            Getting started
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {doneCount} of {steps.length} complete
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          aria-label="Dismiss onboarding"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-full h-1.5 bg-[var(--color-bg-panel)] rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  step.done
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-[var(--color-bg-panel)] text-[var(--color-text-muted)]"
                }`}
              >
                {step.done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </span>
              <span
                className={`text-xs ${step.done ? "text-[var(--color-text-tertiary)] line-through" : "text-[var(--color-text-secondary)]"}`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
        {ctaButton}
      </div>

      {isByokStep && (
        <div className="mt-2 flex gap-3 text-[10px] text-[var(--color-text-muted)]">
          <span>Get keys:</span>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-primary-light)] underline"
          >
            OpenAI
          </a>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-primary-light)] underline"
          >
            Google
          </a>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-primary-light)] underline"
          >
            Anthropic
          </a>
        </div>
      )}
      {isPaymentStep && (
        <div className="mt-2 flex gap-3 text-[10px] text-[var(--color-text-muted)]">
          <span>
            Payments use x402 on{" "}
            <a
              href="https://skale.space/base"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--color-primary-light)] underline"
            >
              SKALE Base
            </a>
            . Gas is free — only a wallet signature is needed per request.
          </span>
        </div>
      )}
    </div>
  );
}
