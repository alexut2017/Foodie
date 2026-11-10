import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { CONFIG, FN_URL } from './config';

// Calls the same Supabase Edge Functions the website uses (see foodiepass-backend/).
export type ApiError = { code: string; message: string };
const NET: ApiError = { code: 'network', message: 'We couldn’t reach LocalScout. Check your connection and try again.' };

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

// If the server functions can't be reached, the member's own entitlement rows still prove access (same rule as the website).
async function statusFromEntitlements(userId: string): Promise<BillingStatus | null> {
  const { data, error } = await supabase.from('entitlements').select('source, access_expires_at, grace_expires_at').eq('user_id', userId).eq('feature', 'membership');
  if (error || !data) return null;
  const now = Date.now();
  const rows = data.filter((r) => r.source === 'admin' || Math.max(Date.parse(r.access_expires_at), r.grace_expires_at ? Date.parse(r.grace_expires_at) : 0) > now);
  if (!rows.length) return null;
  const isAdmin = rows.some((r) => r.source === 'admin');
  const until = isAdmin ? now + 365 * 86400000 : Math.max(...rows.map((r) => Date.parse(r.access_expires_at)));
  const inGrace = until <= now;
  return {
    membership: { active: true, access_until: new Date(until).toISOString(), in_grace: inGrace, grace_until: inGrace ? rows.map((r) => r.grace_expires_at).filter(Boolean).sort().pop() ?? null : null, source: isAdmin ? 'admin' : 'other' },
    subscription: null, gift_codes: [], can_manage_billing: false, attempt_status: null,
  };
}
export async function getStatusOrEntitlements(userId: string): Promise<BillingStatus | null> {
  try { return await getStatus(); } catch { return statusFromEntitlements(userId); }
}

// Pay-first join (same as the website): no account until Stripe confirms the payment.
export type SignupDetails = { first_name: string; last_name: string; phone: string; address_line1: string; address_line2: string; city: string; state: string; zip: string };
export const startSignupCheckout = (body: { offeringId: string; signupId: string; email: string; details: SignupDetails; marketing: boolean; termsVersion: string; referredBy?: string }) =>
  api<{ url: string }>('signup-checkout', { method: 'POST', body: { ...body, returnTo: 'app', hp: '' }, auth: false });
export const finishSignup = (signupId: string) =>
  api<{ status: 'paid' | 'pending' | 'expired'; email: string; offering_id?: string }>('signup-finish', { method: 'POST', body: { signupId }, auth: false });

export const startCheckout = (offeringId: string, attemptId: string) => api<{ url: string }>('billing-checkout', { method: 'POST', body: { offeringId, attemptId } });
export const openPortal = () => api<{ url: string }>('billing-portal', { method: 'POST' });
export const redeemGift = (code: string) => api<{ access_until: string }>('gift-redeem', { method: 'POST', body: { code } });
export const deleteAccount = () => api<{ ok: true }>('account-delete', { method: 'POST', body: { confirm: 'DELETE' } });

export const newId = (): string => Crypto.randomUUID();

export const errText = (e: unknown) => ((e as ApiError)?.message ? (e as ApiError).message : NET.message);
