// Scheduled job (pg_cron every 15 min). Called with the CRON_SECRET header, never from the browser.
// 1. Retry failed / stuck events.  2. Re-sync recently changed subscriptions from Stripe.
// 3. Expire stale checkout attempts.  4. Prune old audit rows.
import { admin, stripe } from '../_shared/clients.ts';
import { runEvent, syncSubscription, handleCheckoutSession } from '../_shared/billing.ts';
import { logError } from '../_shared/http.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const MAX_ATTEMPTS = 8;

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('forbidden', { status: 403 });
  const report = { retried: 0, subs_synced: 0, attempts_closed: 0, errors: 0 };

  try {
    // 1. Failed events, plus anything stuck in 'processing' for 10+ minutes.
    const tenMinAgo = new Date(Date.now() - 600_000).toISOString();
    await admin.from('billing_events').update({ status: 'failed' }).eq('status', 'processing').lt('received_at', tenMinAgo);
    const { data: retry } = await admin.from('billing_events').select('id').in('status', ['pending', 'failed']).lt('attempts', MAX_ATTEMPTS).order('received_at').limit(50);
    for (const e of retry ?? []) { await runEvent(e.id); report.retried++; }

    // 2. Pull the last day of subscription events straight from Stripe, in case a webhook never arrived.
    const since = Math.floor(Date.now() / 1000) - 86400;
    const seen = new Set<string>();
    for await (const ev of stripe.events.list({ created: { gte: since }, types: ['customer.subscription.*', 'invoice.paid', 'invoice.payment_failed'], limit: 100 })) {
      const o = ev.data.object as { id: string; object: string; subscription?: string | null };
      let subId: string | null = o.object === 'subscription' ? o.id : null;
      if (o.object === 'invoice') {
        // Events can arrive in a newer Stripe format, so read the invoice in our pinned format.
        try {
          const s = (await stripe.invoices.retrieve(o.id)).subscription;
          subId = typeof s === 'string' ? s : s?.id ?? null;
        } catch (err) { report.errors++; logError('reconcile.invoice', err, { invoice: o.id }); continue; }
      }
      if (!subId || seen.has(subId)) continue;
      seen.add(subId);
      try { await syncSubscription(subId); report.subs_synced++; } catch (err) { report.errors++; logError('reconcile.sub', err, { sub: subId }); }
    }

    // 3. Open attempts past their expiry: check Stripe once, then close.
    const { data: stale } = await admin.from('checkout_attempts').select('id, stripe_session_id').eq('status', 'open').lt('expires_at', new Date().toISOString()).limit(100);
    for (const a of stale ?? []) {
      if (a.stripe_session_id) {
        try { await handleCheckoutSession(a.stripe_session_id); } catch (err) { report.errors++; logError('reconcile.attempt', err); }
      }
      await admin.from('checkout_attempts').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', a.id).eq('status', 'open');
      report.attempts_closed++;
    }

    // 3b. Pay-first sign-ups past their checkout expiry: create the account if Stripe was paid, otherwise close.
    const { data: staleSignups } = await admin.from('pending_signups').select('id, stripe_session_id').eq('status', 'open').lt('expires_at', new Date().toISOString()).limit(100);
    for (const p of staleSignups ?? []) {
      if (p.stripe_session_id) {
        try { await handleCheckoutSession(p.stripe_session_id); } catch (err) { report.errors++; logError('reconcile.signup', err); }
      }
      await admin.from('pending_signups').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', p.id).eq('status', 'open');
      report.attempts_closed++;
    }

    // 4. Retention. Unpaid sign-up forms hold names and addresses, so they go after 30 days.
    await admin.from('pending_signups').delete().eq('status', 'expired').lt('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());
    await admin.from('audit_log').delete().lt('created_at', new Date(Date.now() - 400 * 86400_000).toISOString());
    await admin.from('billing_events').delete().in('status', ['processed', 'ignored']).lt('received_at', new Date(Date.now() - 90 * 86400_000).toISOString());
  } catch (e) {
    report.errors++;
    logError('billing-reconcile', e);
  }
  return new Response(JSON.stringify(report), { headers: { 'Content-Type': 'application/json' } });
});
