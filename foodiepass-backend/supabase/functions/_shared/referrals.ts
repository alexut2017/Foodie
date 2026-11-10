// Referral rewards: when a referred friend's membership is paid, the friend gets one extra month (13 months for
// the first year) and the member who shared the code gets one extra month.
// For a renewing membership the extra month moves the next Stripe charge back by a month (a free period on the
// subscription), so the member really gets 13 months before paying again. Other memberships (gifts) get a
// one-month access row on top. Each side is granted at most once, so retries are safe.
import { admin, stripe, audit } from './clients.ts';
import { syncSubscription } from './billing.ts';

const addMonth = (ms: number) => { const d = new Date(ms); d.setUTCMonth(d.getUTCMonth() + 1); return d.getTime(); };

/** Records that a pay-first sign-up came from a referral code. Never blocks the sign-up. */
export async function recordReferral(referredId: string, code: string | null | undefined): Promise<void> {
  const c = String(code ?? '').trim().toUpperCase();
  if (!/^GS-[0-9A-F]{6}$/.test(c)) return;
  try {
    const { data: referrer } = await admin.rpc('referrer_for_code', { p_code: c });
    if (!referrer || referrer === referredId) return;
    await admin.from('referrals').insert({ referred_id: referredId, referrer_id: referrer, code: c });
  } catch (e) {
    console.error(JSON.stringify({ where: 'recordReferral', message: String((e as Error)?.message ?? e).slice(0, 300) }));
  }
}

/** Adds one month to a member's access. Returns 'stripe', 'entitlement' or 'skipped:<reason>'. */
async function grantMonth(userId: string, referredId: string, side: 'referred' | 'referrer'): Promise<string> {
  const { data: isAdmin } = await admin.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (isAdmin) return 'skipped:admin';

  const { data: subs } = await admin.from('subscriptions').select('stripe_subscription_id')
    .eq('user_id', userId).in('provider_status', ['active', 'trialing']).not('paid_through', 'is', null).limit(1);
  if (subs && subs.length) {
    const id = subs[0].stripe_subscription_id;
    const s = await stripe.subscriptions.retrieve(id);
    const base = (s.status === 'trialing' && s.trial_end ? s.trial_end : s.current_period_end) * 1000;
    await stripe.subscriptions.update(id, { trial_end: Math.floor(addMonth(base) / 1000), proration_behavior: 'none' },
      { idempotencyKey: `referral-${referredId}-${side}` });
    await syncSubscription(id);
    return 'stripe';
  }

  // No renewing membership: add a month on top of any other access they have (for example a gift).
  const { data: rows } = await admin.from('entitlements').select('access_expires_at').eq('user_id', userId).eq('feature', 'membership');
  const end = Math.max(0, ...(rows ?? []).map((r) => Date.parse(r.access_expires_at)));
  if (end <= Date.now()) return 'skipped:no_active_membership';
  await admin.from('entitlements').upsert({
    user_id: userId, feature: 'membership', source: `referral:${referredId}:${side}`,
    access_expires_at: new Date(addMonth(end)).toISOString(), grace_expires_at: null, updated_at: new Date().toISOString(),
  });
  return 'entitlement';
}

/**
 * Grants the referral months for this member once their membership is paid. Safe to call any time:
 * it does nothing without a pending referral, waits until the friend has paid, and never grants a side twice.
 */
export async function rewardReferral(referredId: string): Promise<void> {
  const { data: r } = await admin.from('referrals').select('*').eq('referred_id', referredId).maybeSingle();
  if (!r || r.status !== 'pending') return;
  // Only a paid renewing membership earns the reward (not a gift someone redeemed).
  const { data: paid } = await admin.from('subscriptions').select('stripe_subscription_id')
    .eq('user_id', referredId).in('provider_status', ['active', 'trialing']).not('paid_through', 'is', null).limit(1);
  if (!paid || !paid.length) return;

  // Claim it so two callers can't grant at the same time.
  const { data: claimed } = await admin.from('referrals').update({ status: 'processing' })
    .eq('referred_id', referredId).eq('status', 'pending').select('referred_bonus, referrer_bonus, referrer_id').maybeSingle();
  if (!claimed) return;
  try {
    let referredBonus = claimed.referred_bonus, referrerBonus = claimed.referrer_bonus;
    if (!referredBonus) {
      referredBonus = await grantMonth(referredId, referredId, 'referred');
      await admin.from('referrals').update({ referred_bonus: referredBonus }).eq('referred_id', referredId);
    }
    if (!referrerBonus) {
      referrerBonus = claimed.referrer_id ? await grantMonth(claimed.referrer_id, referredId, 'referrer') : 'skipped:referrer_deleted';
      await admin.from('referrals').update({ referrer_bonus: referrerBonus }).eq('referred_id', referredId);
    }
    await admin.from('referrals').update({ status: 'rewarded', rewarded_at: new Date().toISOString() }).eq('referred_id', referredId);
    await audit(referredId, 'referral_rewarded', { referrer: claimed.referrer_id, referred_bonus: referredBonus, referrer_bonus: referrerBonus });
  } catch (e) {
    await admin.from('referrals').update({ status: 'pending' }).eq('referred_id', referredId).eq('status', 'processing');
    throw e;
  }
}

/** For callers that must not fail because of a referral problem (checkout, status). */
export async function rewardReferralQuietly(referredId: string | null | undefined): Promise<void> {
  if (!referredId) return;
  try { await rewardReferral(referredId); } catch (e) {
    console.error(JSON.stringify({ where: 'rewardReferral', referred: referredId, message: String((e as Error)?.message ?? e).slice(0, 300) }));
  }
}
