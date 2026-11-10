// POST /api/signup/checkout — public (no account yet). Body: { offeringId, signupId, email, details, marketing, termsVersion, referredBy, hp }.
// Saves the Join form and opens Stripe Checkout straight away. The account is created after payment (see _shared/signup.ts).
import { admin, stripe, SITE_URL, CHECKOUT_ENABLED } from '../_shared/clients.ts';
import { json, fail, preflight, logError } from '../_shared/http.ts';
import { cleanDetails, userIdByEmail } from '../_shared/signup.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const err = (req: Request, code: string, message: string, status: number) => json(req, { error: { code, message } }, status);

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return fail(req, 'bad_request');
  if (!CHECKOUT_ENABLED) return fail(req, 'checkout_disabled');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail(req, 'bad_request'); }
  if (String(body.hp ?? '') !== '') return json(req, { url: `${SITE_URL}/#join` }); // bot filled the hidden field

  const signupId = String(body.signupId ?? '');
  const offeringId = String(body.offeringId ?? '');
  const email = String(body.email ?? '').trim().toLowerCase();
  const details = cleanDetails(body.details as Record<string, unknown>);
  if (!UUID.test(signupId) || !offeringId) return fail(req, 'bad_request');
  if (!EMAIL.test(email) || email.length > 254) return err(req, 'invalid_email', 'Enter a valid email address, like name@example.com.', 400);
  if (!details) return err(req, 'invalid_details', 'Fill in your name, phone and full address.', 400);
  const referredBy = /^GS-[0-9A-F]{6}$/i.test(String(body.referredBy ?? '')) ? String(body.referredBy).toUpperCase() : null;

  try {
    // Same form submitted twice (double click, back button): reuse its open checkout.
    const { data: same } = await admin.from('pending_signups').select('*').eq('id', signupId).maybeSingle();
    if (same) {
      if (same.email !== email || same.offering_id !== offeringId) return fail(req, 'bad_request');
      if (same.status === 'open' && same.session_url && Date.parse(same.expires_at) > Date.now()) return json(req, { url: same.session_url });
      if (same.status === 'completed') return err(req, 'already_paid', 'This payment already went through. Sign in with your email to open your pass.', 409);
      return fail(req, 'bad_request'); // expired: the page makes a new sign-up id
    }

    // Light limits, since anyone can call this: 5 tries per email and 120 overall per hour.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const [{ count: mine }, { count: all }] = await Promise.all([
      admin.from('pending_signups').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', hourAgo),
      admin.from('pending_signups').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo),
    ]);
    if ((mine ?? 0) >= 5 || (all ?? 0) >= 120) return fail(req, 'rate_limited');

    const { data: offering } = await admin.from('offerings').select('*').eq('id', offeringId).eq('active', true).maybeSingle();
    if (!offering || !offering.stripe_price_id) return fail(req, 'invalid_plan');

    // An existing account: members sign in instead; an unpaid or lapsed account keeps its Stripe customer.
    const existing = await userIdByEmail(email);
    let customerId: string | null = null;
    if (existing) {
      if (offering.kind === 'membership') {
        const { data: active } = await admin.rpc('has_membership', { p_user: existing });
        const { data: liveSub } = await admin.from('subscriptions').select('stripe_subscription_id')
          .eq('user_id', existing).in('provider_status', ['active', 'trialing', 'past_due', 'unpaid', 'paused']).limit(1);
        if (active || (liveSub && liveSub.length)) return err(req, 'already_member', 'You’re already a member. Sign in with your email to open your pass.', 409);
      }
      const { data: cust } = await admin.from('billing_customers').select('stripe_customer_id').eq('user_id', existing).maybeSingle();
      customerId = cust?.stripe_customer_id ?? null;
    }

    const { error: insErr } = await admin.from('pending_signups').insert({
      id: signupId, email, details, marketing: body.marketing === true,
      terms_version: String(body.termsVersion ?? '').slice(0, 40) || null, referred_by: referredBy, offering_id: offeringId,
    });
    if (insErr) throw insErr;

    let purchaseId: string | null = null;
    if (offering.kind === 'one_time') {
      const { data: pur, error } = await admin.from('purchases').insert({
        user_id: null, offering_id: offeringId, amount_cents: offering.amount_cents, currency: offering.currency,
      }).select('id').single();
      if (error) throw error;
      purchaseId = pur.id;
    }

    const metadata = { pending_signup_id: signupId, offering_id: offeringId };
    const session = await stripe.checkout.sessions.create({
      mode: offering.kind === 'membership' ? 'subscription' : 'payment',
      ...(customerId ? { customer: customerId } : { customer_email: email }),
      ...(offering.kind === 'one_time' && !customerId ? { customer_creation: 'always' as const } : {}),
      client_reference_id: signupId,
      line_items: [{ price: offering.stripe_price_id, quantity: 1 }],
      success_url: `${SITE_URL}/?checkout=success&signup=${signupId}#pass`,
      cancel_url: `${SITE_URL}/?checkout=canceled#join`,
      metadata: { ...metadata, ...(purchaseId ? { purchase_id: purchaseId } : {}) },
      ...(offering.kind === 'membership'
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata: { ...metadata, purchase_id: purchaseId! } } }),
      allow_promotion_codes: true,
      automatic_tax: { enabled: (Deno.env.get('STRIPE_AUTOMATIC_TAX') ?? 'false') === 'true' },
    }, { idempotencyKey: `signup-${signupId}` });

    await admin.from('pending_signups').update({
      stripe_session_id: session.id, session_url: session.url, purchase_id: purchaseId,
      expires_at: new Date(session.expires_at * 1000).toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', signupId);
    if (purchaseId) await admin.from('purchases').update({ stripe_checkout_session_id: session.id }).eq('id', purchaseId);

    return json(req, { url: session.url });
  } catch (e) {
    logError('signup-checkout', e, { signup: signupId });
    await admin.from('pending_signups').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', signupId).is('stripe_session_id', null);
    const type = (e as { type?: string })?.type ?? '';
    return fail(req, type.startsWith('Stripe') ? 'provider_unavailable' : 'server_error');
  }
});
