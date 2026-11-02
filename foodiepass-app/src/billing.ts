import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { CONFIG, FN_URL } from './config';

// Calls the same Supabase Edge Functions the website uses (see foodiepass-backend/).
export type ApiError = { code: string; message: string };
const NET: ApiError = { code: 'network', message: 'We couldn’t reach FoodiePass. Check your connection and try again.' };

async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: CONFIG.supabaseKey };
  if (init.auth !== false) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = 'Bearer ' + data.session.access_token;
  }
  let res: Response;
  try {
    res = await fetch(FN_URL + '/' + path, { method: init.method ?? 'GET', headers, body: init.body ? JSON.stringify(init.body) : undefined });
  } catch {
    throw NET;
  }
  let json: unknown = null;
  try { json = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw ((json as { error?: ApiError })?.error ?? { code: 'server_error', message: 'Something went wrong on our side. Please try again.' });
  return json as T;
}

export type BillingConfig = { checkout_enabled: boolean; offerings: { id: string; name: string; amount_cents: number }[] };
export type BillingStatus = {
  membership: { active: boolean; access_until: string | null; in_grace: boolean; grace_until: string | null; source: string | null };
  subscription: null | { status: string; renews: boolean; cancel_at_period_end: boolean; current_period_end: string | null; payment_problem: boolean };
  gift_codes: { code: string; redeemed: boolean; revoked: boolean }[];
  can_manage_billing: boolean;
  attempt_status: string | null;
};

export const getConfig = () => api<BillingConfig>('billing-config', { auth: false });
export const getStatus = (attempt?: string) => api<BillingStatus>('billing-status' + (attempt ? '?attempt=' + encodeURIComponent(attempt) : ''));
export const startCheckout = (offeringId: string, attemptId: string) => api<{ url: string }>('billing-checkout', { method: 'POST', body: { offeringId, attemptId } });
export const openPortal = () => api<{ url: string }>('billing-portal', { method: 'POST' });
export const redeemGift = (code: string) => api<{ access_until: string }>('gift-redeem', { method: 'POST', body: { code } });
export const deleteAccount = () => api<{ ok: true }>('account-delete', { method: 'POST', body: { confirm: 'DELETE' } });

export const newId = (): string => Crypto.randomUUID();

export const errText = (e: unknown) => ((e as ApiError)?.message ? (e as ApiError).message : NET.message);
