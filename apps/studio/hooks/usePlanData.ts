/**
 * usePlanData
 *
 * Single batched fetch for Settings plan tab. Replaces three parallel calls
 * (getPricingPlans, getPricingResources, getPricingUsage) with one Promise.all.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getPricingPlans,
  getPricingResources,
  getPricingUsage,
  getErrorMessage,
} from '@/lib/api';
import type { PricingPlan, PricingResource, UsageSummary } from '@/lib/api';

export interface UsePlanDataOptions {
  enabled?: boolean;
}

export interface UsePlanDataReturn {
  plans: PricingPlan[];
  resources: PricingResource[];
  usage: UsageSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePlanData(options: UsePlanDataOptions = {}): UsePlanDataReturn {
  const { enabled = true } = options;
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [resources, setResources] = useState<PricingResource[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [plansRes, resourcesRes, usageRes] = await Promise.all([
        getPricingPlans(),
        getPricingResources(),
        getPricingUsage(),
      ]);
      setPlans(plansRes?.plans ?? []);
      setResources(resourcesRes?.resources ?? []);
      setUsage(usageRes ?? null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load plan data'));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) void fetchAll();
  }, [enabled, fetchAll]);

  return { plans, resources, usage, loading, error, refetch: fetchAll };
}
