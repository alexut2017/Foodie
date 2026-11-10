// Pay-first sign-up: the account is created only after Stripe confirms the payment.
// finishSignup is idempotent, so the webhook, the finish page and the reconcile job can all call it safely.
import { admin, stripe, audit } from './clients.ts';
import { recordReferral } from './referrals.ts';

export type SignupDetails = {
  first_name: string; last_name: string; phone: string;
  address_line1: string; address_line2: string; city: string; state: string; zip: string;
};

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

/** Cleans the Join form details. Returns null when something required is missing. */
export function cleanDetails(raw: Record<string, unknown> | null | undefined): SignupDetails | null {
  const r = raw ?? {};
  const d: SignupDetails = {
    first_name: clip(r.first_name, 59), last_name: clip(r.last_name, 60),
    phone: clip(r.phone, 20).replace(/[^\d+()\- .]/g, ''),
    address_line1: clip(r.address_line1, 120), address_line2: clip(r.address_line2, 80),
    city: clip(r.city, 80), state: clip(r.state, 2).toUpperCase(), zip: clip(r.zip, 10),
  };
  const digits = d.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (!d.first_name || !d.last_name || digits.length !== 10) return null;
  if (!d.address_line1 || !d.city || !/^[A-Z]{2}$/.test(d.state) || !/^\d{5}(-\d{4})?$/.test(d.zip)) return null;
  d.phone = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return d;
}

export async function userIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await admin.rpc('user_id_by_email', { p_email: email });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** A Checkout Session is paid when Stripe says so (cards are immediate; slower methods finish later). */
export function sessionPaid(s: { status: string | null; payment_status: string }): boolean {
  return s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required');
}

/**
 * Creates (or finds) the account for a paid pending sign-up and links it to the Stripe customer and purchase.
 * Returns the user id, or null if this session isn't a pay-first sign-up or isn't paid yet.
 */
export async function finishSignup(session: {
  id: string; status: string | null; payment_status: string;
  customer: string | { id: string } | null; metadata: Record<string, string> | null;
}): Promise<string | null> {
  const pendingId = session.metadata?.pending_signup_id;
  if (!pendingId) return null;
  const { data: p } = await admin.from('pending_signups').select('*').eq('id', pendingId).maybeSingle();
  if (!p) return null;
  if (!sessionPaid(session)) {
    if (session.status === 'expired') {
      await admin.from('pending_signups').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', pendingId).eq('status', 'open');
    }
    return null;
  }
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

  let userId: string | null = p.user_id;
  if (!userId) {
    const d = p.details as SignupDetails;
    const metadata = {
      ...d,
      full_name: `${d.first_name} ${d.last_name}`.trim(),
      terms_version: p.terms_version ?? undefined,
      terms_accepted_at: p.created_at,
      marketing_opt_in: !!p.marketing,
      referred_by: p.referred_by ?? undefined,
    };
    userId = await userIdByEmail(p.email);
    if (userId) {
      // Signed up before without paying: keep the account and refresh its details.
      await admin.auth.admin.updateUserById(userId, { user_metadata: metadata });
    } else {
      // The email isn't confirmed yet; the member confirms it with the code they enter to open their pass.
      const { data, error } = await admin.auth.admin.createUser({ email: p.email, email_confirm: false, user_metadata: metadata });
      if (error) {
        userId = await userIdByEmail(p.email); // created at the same moment by another caller
        if (!userId) throw error;
      } else userId = data.user!.id;
    }
  }

  if (customerId) {
    const { error } = await admin.from('billing_customers').insert({ user_id: userId, stripe_customer_id: customerId });
    if (error && error.code !== '23505') throw error;
    await stripe.customers.update(customerId, { metadata: { user_id: userId } });
  }
  if (p.purchase_id) await admin.from('purchases').update({ user_id: userId }).eq('id', p.purchase_id).is('user_id', null);
  if (p.referred_by) await recordReferral(userId, p.referred_by); // months are granted once the membership is synced

  if (p.status !== 'completed' || p.user_id !== userId) {
    await admin.from('pending_signups').update({ user_id: userId, status: 'completed', updated_at: new Date().toISOString() }).eq('id', pendingId);
    await audit(userId, 'signup_paid', { pending_signup_id: pendingId, offering_id: p.offering_id });
  }
  return userId;
}
