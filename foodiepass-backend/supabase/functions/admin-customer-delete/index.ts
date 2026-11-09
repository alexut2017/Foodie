// POST /api/admin/customer-delete — admins only. Body: { userId }.
// Cancels the customer's Stripe subscription and open checkouts first, then deletes the account,
// so a deleted customer can never keep being charged. Admin accounts can't be deleted here.
import { admin, requireUser, audit } from '../_shared/clients.ts';
import { deleteAccount } from '../_shared/account-deletion.ts';
import { json, fail, preflight, logError } from '../_shared/http.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isAdmin = async (id: string) =>
  !!(await admin.from('platform_admins').select('user_id').eq('user_id', id).maybeSingle()).data;

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return fail(req, 'bad_request');
  const caller = await requireUser(req);
  if (!caller) return fail(req, 'unauthenticated');
  if (!(await isAdmin(caller.id))) return json(req, { error: { code: 'not_allowed', message: 'Only admins can delete customers.' } }, 403);

  let userId = '';
  try { userId = String((await req.json()).userId ?? ''); } catch { /* empty */ }
  if (!UUID.test(userId)) return fail(req, 'bad_request');
  if (userId === caller.id || (await isAdmin(userId))) {
    return json(req, { error: { code: 'is_admin', message: 'Admins can’t be deleted here.' } }, 409);
  }

  const { data: found } = await admin.auth.admin.getUserById(userId);
  if (!found?.user) return json(req, { error: { code: 'not_found', message: 'That account was already deleted.' } }, 404);

  try {
    await audit(caller.id, 'admin_deleted_customer', { customer: userId });
    await deleteAccount(userId, 'account_deleted');
    return json(req, { ok: true });
  } catch (e) {
    logError('admin-customer-delete', e, { customer: userId });
    const type = (e as { type?: string })?.type ?? '';
    return fail(req, type.startsWith('Stripe') ? 'provider_unavailable' : 'server_error');
  }
});
