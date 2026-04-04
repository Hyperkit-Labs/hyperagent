"use client";

import { useState, useEffect } from "react";
import {
  getSpendingControlWithBudget,
  patchSpendingControl,
  type SpendingControlWithBudget,
} from "@/lib/api";
import { useSession } from "@/hooks/useSession";

export interface SpendingControlCardProps {
  /** When provided (e.g. from Payments page consolidated fetch), skip internal fetch. */
  controlFromParent?: SpendingControlWithBudget | null;
  /** Called after save so parent can refetch. */
  onRefetch?: () => void;
  /** Called when budget or period changes for live projection. */
  onValuesChange?: (
    budget: string,
    period: "daily" | "weekly" | "monthly",
  ) => void;
}

function initFromControl(data: SpendingControlWithBudget | null) {
  return {
    budgetAmount: data?.budget ?? "0",
    period:
      (data?.period as "daily" | "weekly" | "monthly") ?? ("monthly" as const),
    alertPercent:
      typeof data?.alert_threshold_percent === "number"
        ? data.alert_threshold_percent
        : 80,
  };
}

export function SpendingControlCard({
  controlFromParent,
  onRefetch,
  onValuesChange,
}: SpendingControlCardProps) {
  const { hasSession } = useSession();
  const [control, setControl] = useState<SpendingControlWithBudget | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">(
    "monthly",
  );
  const [alertPercent, setAlertPercent] = useState(80);

  useEffect(() => {
    if (controlFromParent !== undefined) {
      setControl(controlFromParent);
      const init = initFromControl(controlFromParent);
      setBudgetAmount(init.budgetAmount);
      setPeriod(init.period);
      setAlertPercent(init.alertPercent);
      setLoading(false);
      return;
    }
    if (!hasSession) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getSpendingControlWithBudget()
      .then((data) => {
        setControl(data);
        const init = initFromControl(data);
        setBudgetAmount(init.budgetAmount);
        setPeriod(init.period);
        setAlertPercent(init.alertPercent);
      })
      .catch(() => setError("Failed to load spending control"))
      .finally(() => setLoading(false));
  }, [hasSession, controlFromParent]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSession) return;
    const amount = parseFloat(budgetAmount);
    if (Number.isNaN(amount) || amount < 0) {
      setError("Budget must be a non-negative number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await patchSpendingControl({
        budget_amount: amount,
        budget_currency: "USD",
        period,
        alert_threshold_percent: alertPercent,
      });
      setControl(updated);
      onRefetch?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!hasSession) {
    return (
      <p className="text-sm text-[var(--color-text-tertiary)]">
        Sign in with your wallet to view and set spending controls.
      </p>
    );
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Loading spending controls...
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label
            htmlFor="budget"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Budget per period
          </label>
          <input
            id="budget"
            type="number"
            min="0"
            step="0.01"
            value={budgetAmount}
            onChange={(e) => {
              const v = e.target.value;
              setBudgetAmount(v);
              onValuesChange?.(v, period);
            }}
            className="w-full max-w-[200px] px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] text-sm"
          />
          <span className="ml-2 text-xs text-[var(--color-text-muted)]">
            USD
          </span>
        </div>
        <div>
          <label
            htmlFor="period"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Period
          </label>
          <select
            id="period"
            value={period}
            onChange={(e) => {
              const v = e.target.value as "daily" | "weekly" | "monthly";
              setPeriod(v);
              onValuesChange?.(budgetAmount, v);
            }}
            className="w-full max-w-[200px] px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] text-sm"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="alert"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Alert when spending reaches (%)
          </label>
          <input
            id="alert"
            type="number"
            min="0"
            max="100"
            value={alertPercent}
            onChange={(e) => setAlertPercent(parseInt(e.target.value, 10) || 0)}
            className="w-full max-w-[120px] px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] text-sm"
          />
        </div>
        {control?.spent != null && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Spent so far: {control.spent} {control.currency ?? "USD"}
          </p>
        )}
        {error && (
          <p className="text-sm text-[var(--color-semantic-error)]">{error}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}
