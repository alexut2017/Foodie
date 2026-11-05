// Scheduled job (pg_cron daily). Called with the CRON_SECRET header, never from the browser.
// Deletes accounts that never paid after 2 days, and lapsed accounts 30 days after their access ended.
// It only reports what it would delete unless ACCOUNT_CLEANUP_ENABLED is exactly 'true', and it never runs
// while checkout is off, because nobody could have paid.
import { admin, stripe, CHECKOUT_ENABLED } from '../_shared/clients.ts';
import { deleteAccount } from '../_shared/account-deletion.ts';
import { deleteAccountAfter } from '../_shared/account-cleanup.ts';
import { logError } from '../_shared/http.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const CLEANUP_ENABLED = Deno.env.get('ACCOUNT_CLEANUP_ENABLED') === 'true';
const MAX_DELETES_PER_RUN = 50; // a bad rule or bad data can't remove every account in one run
const LIVE = ['active', 'trialing', 'past_due', 'unpaid', 'paused'];
const when = (d: string | null) => (d ? Date.parse(d) : null);

async function eligible(userId: string, createdAt: string, now: number): Promise<boolean> {
  const [adminRow, subs, attempts, gifts, entitlements, purchases, customer] = await Promise.all([
    admin.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
    admin.from('subscriptions').select('provider_status, paid_through, ended_at').eq('user_id', userId),
    admin.from('checkout_attempts').select('status, expires_at').eq('user_id', userId).in('status', ['open', 'completed']),
    admin.from('gift_codes').select('code').eq('purchaser_id', userId).is('redeemed_at', null).eq('revoked', false).limit(1),
    admin.from('entitlements').select('access_expires_at, grace_expires_at').eq('user_id', userId),
    admin.from('purchases').select('created_at').eq('user_id', userId).eq('payment_status', 'paid'),
    admin.from('billing_customers').select('stripe_customer_id').eq('user_id', userId).maybeSingle(),
  ]);
  // If any lookup failed, we don't know enough to delete anything.
  const failed = [adminRow, subs, attempts, gifts, entitlements, purchases, customer].find((r) => r.error);
  if (failed) throw failed.error;

  const deleteAfter = deleteAccountAfter({
    createdAt: Date.parse(createdAt),
    isAdmin: !!adminRow.data,
    liveSubscription: (subs.data ?? []).some((s) => LIVE.includes(s.provider_status)),
    // A completed attempt counts too: its payment may simply not have reached our tables yet.
    checkoutInProgress: (attempts.data ?? []).some((a) => a.status === 'completed' || Date.parse(a.expires_at) > now),
    unusedGift: (gifts.data ?? []).length > 0,
    paidDates: [
      ...(entitlements.data ?? []).flatMap((e) => [when(e.access_expires_at), when(e.grace_expires_at)]),
      ...(subs.data ?? []).flatMap((s) => [when(s.paid_through), when(s.ended_at)]),
      ...(purchases.data ?? []).map((p) => when(p.created_at)),
    ],
  });
  if (deleteAfter === null || deleteAfter > now) return false;

  // Last check with Stripe itself, in case a webhook never arrived.
  if (customer.data) {
    const list = await stripe.subscriptions.list({ customer: customer.data.stripe_customer_id, status: 'all', limit: 100 });
    if (list.data.some((s) => LIVE.includes(s.status))) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('forbidden', { status: 403 });
  const report = { dry_run: !CLEANUP_ENABLED, checked: 0, eligible: 0, deleted: 0, stopped_at_limit: false, errors: 0 };
  if (!CHECKOUT_ENABLED) return new Response(JSON.stringify({ ...report, skipped: 'checkout_disabled' }), { headers: { 'Content-Type': 'application/json' } });

  const now = Date.now();
  try {
    pages: for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users) {
        report.checked++;
        try {
          if (!(await eligible(u.id, u.created_at, now))) continue;
          report.eligible++;
          if (!CLEANUP_ENABLED) continue;
          if (report.deleted >= MAX_DELETES_PER_RUN) { report.stopped_at_limit = true; break pages; }
          await deleteAccount(u.id, 'unpaid_account_deleted');
          report.deleted++;
        } catch (err) {
          report.errors++;
          logError('account-cleanup.user', err, { user: u.id });
        }
      }
      if (data.users.length < 1000) break;
    }
  } catch (e) {
    report.errors++;
    logError('account-cleanup', e);
  }
  return new Response(JSON.stringify(report), { headers: { 'Content-Type': 'application/json' } });
});
