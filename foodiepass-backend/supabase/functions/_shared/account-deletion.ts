// Removes an account in the order that can't leave a charge behind: stop Stripe first, then delete the user.
// Stripe keeps its own payment records for tax/accounting; we keep anonymous audit rows, and purchases and
// gift codes with the user removed.
import { admin, stripe, audit } from './clients.ts';

export async function deleteAccount(userId: string, action: 'account_deleted' | 'unpaid_account_deleted'): Promise<void> {
  // 1. Cancel every live subscription immediately so nothing renews after the account is gone.
  const { data: subs } = await admin.from('subscriptions').select('stripe_subscription_id, provider_status').eq('user_id', userId);
  for (const s of subs ?? []) {
    if (!['canceled', 'incomplete_expired'].includes(s.provider_status)) {
      await stripe.subscriptions.cancel(s.stripe_subscription_id, { invoice_now: false, prorate: false });
    }
  }
  // 2. Expire any open checkout sessions.
  const { data: open } = await admin.from('checkout_attempts').select('stripe_session_id').eq('user_id', userId).eq('status', 'open');
  for (const a of open ?? []) {
    if (a.stripe_session_id) { try { await stripe.checkout.sessions.expire(a.stripe_session_id); } catch { /* already closed */ } }
  }
  // 3. Remove personal details from the Stripe customer (the customer record itself stays for accounting).
  const { data: cust } = await admin.from('billing_customers').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (cust) await stripe.customers.update(cust.stripe_customer_id, { name: '', description: 'deleted account', metadata: { user_id: '', deleted: 'true' } });

  // 4. Delete the account. Foreign keys cascade through our tables or clear the user id.
  await audit(userId, action, { subscriptions_canceled: (subs ?? []).length });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
