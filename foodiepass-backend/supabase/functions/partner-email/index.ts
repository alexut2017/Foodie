// POST /functions/v1/partner-email  (deployed with "Verify JWT" off; admin calls are checked below)
//   { kind: 'received', email }        public, sent by the website right after a partner application.
//                                      Emails the applicant once, only for an application made in the last 15 minutes.
//   { kind: 'approved', restaurantId } admins only (Authorization: Bearer <session token>).
//                                      Emails the restaurant contact: owner page sign-in, staff PIN, staff guide.
// Mail goes out over SMTP on port 465 (Supabase blocks 25 and 587). Secrets: SMTP_USER, SMTP_PASS,
// optional SMTP_HOST (default smtp.gmail.com), MAIL_REPLY_TO (default joinlocalscout@outlook.com), SITE_URL.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import nodemailer from 'npm:nodemailer@6.9.16';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SITE = (Deno.env.get('SITE_URL') ?? 'https://joinlocalscout.com').replace(/\/+$/, '');
const SMTP_USER = Deno.env.get('SMTP_USER') ?? '';
const REPLY_TO = Deno.env.get('MAIL_REPLY_TO') ?? 'joinlocalscout@outlook.com';
const mailer = nodemailer.createTransport({
  host: Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com', port: 465, secure: true,
  auth: { user: SMTP_USER, pass: Deno.env.get('SMTP_PASS') ?? '' },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function layout(title: string, inner: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#172A2A;background:#F6F4EF">
  <p style="font-size:22px;font-weight:800;margin:0 0 16px">Local<span style="color:#E2552B">Scout</span></p>
  <h2 style="font-size:20px;margin:0 0 12px">${title}</h2>${inner}
  <p style="font-size:13px;color:#4A5857;margin:24px 0 0">Questions? Just reply to this email.</p></div>`;
}
const p = (s: string) => `<p style="font-size:16px;line-height:1.5;margin:0 0 12px">${s}</p>`;
const btn = (href: string, label: string) => `<p style="margin:16px 0"><a href="${href}" style="background:#E2552B;color:#172A2A;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px;display:inline-block">${label}</a></p>`;

async function send(to: string, subject: string, html: string) {
  await mailer.sendMail({ from: `LocalScout <${SMTP_USER}>`, replyTo: REPLY_TO, to, subject, html });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: { code: 'bad_request' } }, 400);
  if (!SMTP_USER) return reply({ error: { code: 'email_not_configured', message: 'Email sending is not set up yet.' } }, 503);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: { code: 'bad_request' } }, 400); }

  try {
    if (body.kind === 'received') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ ok: true }); // nothing to do
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { data: app } = await admin.from('partner_applications').select('id, restaurant_name, first_name, email')
        .ilike('email', email).is('confirmation_sent_at', null).gte('created_at', since)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!app) return reply({ ok: true }); // already sent, too old, or no such application: say nothing either way
      await send(app.email, `We got your LocalScout application for ${app.restaurant_name}`, layout('Thanks for applying!',
        p(`Hi ${esc(app.first_name || 'there')},`) +
        p(`We received your application for <b>${esc(app.restaurant_name)}</b>. Our team reviews every restaurant and usually replies within a few business days.`) +
        p('If you’re approved, we’ll email you a link to your owner page, where you set your member offer, hours, photo and a 4-digit staff PIN.') +
        p('Joining is free for restaurants.')));
      await admin.from('partner_applications').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', app.id);
      return reply({ ok: true });
    }

    if (body.kind === 'approved') {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      const { data: u } = await admin.auth.getUser(token);
      const uid = u?.user?.id;
      const { data: isAdmin } = uid ? await admin.from('platform_admins').select('user_id').eq('user_id', uid).maybeSingle() : { data: null };
      if (!isAdmin) return reply({ error: { code: 'not_allowed', message: 'Admins only.' } }, 403);
      const restaurantId = String(body.restaurantId ?? '');
      const [{ data: r }, { data: c }] = await Promise.all([
        admin.from('restaurants').select('id, name').eq('id', restaurantId).maybeSingle(),
        admin.from('restaurant_contacts').select('first_name, email').eq('restaurant_id', restaurantId).maybeSingle(),
      ]);
      if (!r) return reply({ error: { code: 'not_found', message: 'Restaurant not found.' } }, 404);
      if (!c?.email) return reply({ error: { code: 'no_contact_email', message: 'Add the contact email on this restaurant first.' } }, 400);
      await send(c.email, `You’re approved: ${r.name} is on LocalScout`, layout(`Welcome to LocalScout, ${esc(r.name)}!`,
        p(`Hi ${esc(c.first_name || 'there')},`) +
        p('You’re approved. Here’s how to get ready for your first LocalScout diners:') +
        p(`<b>1. Open your owner page.</b> Sign in with <b>${esc(c.email)}</b>. We’ll email you a 6-digit code, no password needed.`) +
        btn(`${SITE}/#owner`, 'Open My Owner Page') +
        p('<b>2. Set your 4-digit staff PIN.</b> When a member shows their pass, your server types this PIN on the member’s phone to confirm the visit. Share it with your staff only.') +
        p('<b>3. Check your offer, hours and photo.</b> You can change them any time on the owner page, and you’ll see how many members visit each week.') +
        p(`<b>4. Print the staff guide</b> and keep it by the register: <a href="${SITE}/#staff-guide" style="color:#B5401C">How to accept a LocalScout pass</a>.`)));
      await admin.from('partner_applications').update({ approved_email_sent_at: new Date().toISOString() }).eq('restaurant_id', restaurantId);
      return reply({ ok: true, to: c.email });
    }
    return reply({ error: { code: 'bad_request' } }, 400);
  } catch (e) {
    console.error('partner-email failed', e);
    return reply({ error: { code: 'send_failed', message: 'The email couldn’t be sent. Check the email settings and try again.' } }, 502);
  }
});
