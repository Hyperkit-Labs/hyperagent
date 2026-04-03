/**
 * Billing API: payments, credits, pricing.
 */

import { fetchJsonAuthed, reportApiError } from './core';

export interface PaymentHistoryItem {
  id?: string;
  amount?: string;
  currency?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface PaymentHistoryResponse {
  items?: PaymentHistoryItem[];
  total?: number;
}

export interface PaymentSummary {
  total?: string;
  currency?: string;
  [key: string]: unknown;
}

export interface SpendingControlWithBudget {
  budget?: string;
  spent?: string;
  currency?: string;
  period?: string;
  alert_threshold_percent?: number;
  [key: string]: unknown;
}

export interface SpendingControlPatchBody {
  budget_amount: number;
  budget_currency?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  alert_threshold_percent?: number;
}

export async function getPaymentHistory(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaymentHistoryResponse> {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return fetchJsonAuthed<PaymentHistoryResponse>(`/payments/history?${qs}`).catch((e) => {
    reportApiError(e, { path: '/payments/history' });
    return { items: [], total: 0 } as PaymentHistoryResponse;
  });
}

export async function getPaymentSummary(): Promise<PaymentSummary> {
  return fetchJsonAuthed<PaymentSummary>('/payments/summary').catch((e) => {
    reportApiError(e, { path: '/payments/summary' });
    return {} as PaymentSummary;
  });
}

export async function getSpendingControlWithBudget(): Promise<SpendingControlWithBudget> {
  return fetchJsonAuthed<SpendingControlWithBudget>('/payments/spending-control').catch((e) => {
    reportApiError(e, { path: '/payments/spending-control' });
    return {} as SpendingControlWithBudget;
  });
}

export async function patchSpendingControl(
  body: SpendingControlPatchBody
): Promise<SpendingControlWithBudget> {
  return fetchJsonAuthed('/payments/spending-control', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export interface CreditsBalance {
  balance: number;
  currency: string;
  user_id?: string;
  message?: string;
}

export interface CreditsTopUpBody {
  amount: number;
  currency?: string;
  reference_id?: string;
  reference_type?: string;
}

export async function getCreditsBalance(): Promise<CreditsBalance> {
  return fetchJsonAuthed<CreditsBalance>('/credits/balance').catch((e) => {
    reportApiError(e, { path: '/credits/balance' });
    return { balance: 0, currency: 'USD' } as CreditsBalance;
  });
}

export async function topUpCredits(
  body: CreditsTopUpBody
): Promise<CreditsBalance & { user_id?: string }> {
  return fetchJsonAuthed('/credits/top-up', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function topUpCreditsWithTx(
  body: CreditsTopUpBody & { tx_hash?: string }
): Promise<CreditsBalance & { user_id?: string }> {
  return topUpCredits({
    ...body,
    reference_id: body.reference_id ?? body.tx_hash,
    reference_type: body.reference_type ?? (body.tx_hash ? 'usdc_transfer' : 'manual'),
  });
}

export interface PricingPlan {
  id: string;
  name: string;
  limits: Record<string, number>;
  enabledPipelines: string[];
  features: string[];
}

export interface PricingResource {
  id: string;
  name: string;
  unit: string;
  description: string;
  unit_price: number;
}

export interface UsageSummary {
  plan: string;
  plan_name: string;
  usage: Record<string, number>;
  limits: Record<string, number>;
  features: string[];
  enabled_pipelines: string[];
}

export async function getPricingPlans(): Promise<{ plans: PricingPlan[] }> {
  return fetchJsonAuthed('/pricing/plans');
}

export async function getPricingResources(): Promise<{ resources: PricingResource[] }> {
  return fetchJsonAuthed('/pricing/resources');
}

export async function getPricingUsage(): Promise<UsageSummary> {
  return fetchJsonAuthed('/pricing/usage');
}
