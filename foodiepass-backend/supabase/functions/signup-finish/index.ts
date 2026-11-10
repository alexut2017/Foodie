// POST /api/signup/finish — public. Body: { signupId }. Called by the page Stripe sends the buyer back to.
// Checks the payment with Stripe directly (so it doesn't wait on the webhook) and creates the account.
// It never signs anyone in: the buyer still enters the code emailed to them. The sign-up id is a random
// value only the buyer's browser has, and the answer only says whether it's paid plus the email they typed.
import { admin, stripe } from '../_shared/clients.ts';
import { json, fail, preflight, logError } from '../_shared/http.ts';
import { handleCheckoutSession } from '../_shared/billing.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return fail(req, 'bad_request');
  let signupId = '';
  try { signupId = String((await req.json()).signupId ?? ''); } catch { /* empty */ }
  if (!UUID.test(signupId)) return fail(req, 'bad_request');

  try {
    const { data: p } = await admin.from('pending_signups').select('email, offering_id, status, stripe_session_id, user_id').eq('id', signupId).maybeSingle();
    if (!p || !p.stripe_session_id) return fail(req, 'not_found');
    if (p.status !== 'completed' || !p.user_id) {
      const s = await stripe.checkout.sessions.retrieve(p.stripe_session_id);
      if (s.status === 'complete') await handleCheckoutSession(s.id); // creates the account and grants access
      const { data: again } = await admin.from('pending_signups').select('status, user_id').eq('id', signupId).single();
      if (again.status !== 'completed' || !again.user_id) return json(req, { status: s.status === 'expired' ? 'expired' : 'pending', email: p.email });
    }
    return json(req, { status: 'paid', email: p.email, offering_id: p.offering_id });
  } catch (e) {
    logError('signup-finish', e, { signup: signupId });
    return fail(req, 'server_error');
  }
});
