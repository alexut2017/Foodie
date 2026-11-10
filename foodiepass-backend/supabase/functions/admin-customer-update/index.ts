// POST /api/admin/customer-update — admins only.
// Body: { userId, first_name, last_name, email, phone, address_line1, address_line2, city, state, zip, marketing }.
// Saves through the account's sign-up details, so the profile, the name on the pass and the admin list stay in step.
// A new email becomes the sign-in email straight away and is copied to Stripe for receipts.
import { admin, stripe, requireUser, audit } from '../_shared/clients.ts';
import { json, fail, preflight, logError } from '../_shared/http.ts';
import { userIdByEmail } from '../_shared/signup.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const bad = (req: Request, code: string, message: string, status = 400) => json(req, { error: { code, message } }, status);
const isAdmin = async (id: string) => !!(await admin.from('platform_admins').select('user_id').eq('user_id', id).maybeSingle()).data;

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return fail(req, 'bad_request');
  const caller = await requireUser(req);
  if (!caller) return fail(req, 'unauthenticated');
  if (!(await isAdmin(caller.id))) return bad(req, 'not_allowed', 'Only admins can edit customers.', 403);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return fail(req, 'bad_request'); }
  const userId = String(b.userId ?? '');
  if (!UUID.test(userId)) return fail(req, 'bad_request');

  const d = {
    first_name: clip(b.first_name, 59), last_name: clip(b.last_name, 60),
    address_line1: clip(b.address_line1, 120), address_line2: clip(b.address_line2, 80),
    city: clip(b.city, 80), state: clip(b.state, 2).toUpperCase(), zip: clip(b.zip, 10),
  };
  const email = clip(b.email, 254).toLowerCase();
  const digits = clip(b.phone, 20).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (!d.first_name || !d.last_name) return bad(req, 'invalid', 'Enter a first and last name.');
  if (!EMAIL.test(email)) return bad(req, 'invalid', 'Enter a valid email address.');
  if (digits && digits.length !== 10) return bad(req, 'invalid', 'Enter a 10-digit phone number, or leave it blank.');
  if (d.state && !/^[A-Z]{2}$/.test(d.state)) return bad(req, 'invalid', 'Pick a state.');
  if (d.zip && !/^\d{5}(-\d{4})?$/.test(d.zip)) return bad(req, 'invalid', 'Enter a 5-digit zip code, or leave it blank.');
  const phone = digits ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : '';

  try {
    const { data: found } = await admin.auth.admin.getUserById(userId);
    const user = found?.user;
    if (!user) return bad(req, 'not_found', 'That account no longer exists.', 404);
    const emailChanged = email !== (user.email ?? '').toLowerCase();
    if (emailChanged) {
      const other = await userIdByEmail(email);
      if (other && other !== userId) return bad(req, 'email_taken', 'Another account already uses that email.', 409);
    }

    const full = `${d.first_name} ${d.last_name}`;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ...(emailChanged ? { email, email_confirm: true } : {}),
      user_metadata: { ...d, phone, full_name: full },
    });
    if (error) throw error;

    // Marketing emails: record a new consent row only when the choice changes.
    if (typeof b.marketing === 'boolean') {
      const { data: last } = await admin.from('consents').select('granted').eq('user_id', userId).eq('kind', 'marketing')
        .order('recorded_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
      if ((last?.granted ?? false) !== b.marketing) {
        await admin.from('consents').insert({ user_id: userId, kind: 'marketing', version: 'admin', granted: b.marketing });
      }
    }

    // Keep Stripe's receipts going to the right person. A Stripe hiccup doesn't undo the saved details.
    let stripeUpdated = true;
    const { data: cust } = await admin.from('billing_customers').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
    if (cust) {
      try { await stripe.customers.update(cust.stripe_customer_id, { email, name: full }); } catch (e) { stripeUpdated = false; logError('admin-customer-update.stripe', e); }
    }

    await audit(caller.id, 'admin_updated_customer', { customer: userId, email_changed: emailChanged });
    return json(req, { ok: true, stripe_updated: stripeUpdated, email, phone, full_name: full });
  } catch (e) {
    logError('admin-customer-update', e, { customer: userId });
    return fail(req, 'server_error');
  }
});
