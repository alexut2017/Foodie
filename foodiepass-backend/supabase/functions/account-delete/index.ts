// POST /api/account/delete — authenticated, requires a sign-in within the last 10 minutes.
import { requireUser, secondsSinceAuthentication } from '../_shared/clients.ts';
import { deleteAccount } from '../_shared/account-deletion.ts';
import { json, fail, preflight, logError } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return fail(req, 'bad_request');
  const user = await requireUser(req);
  if (!user) return fail(req, 'unauthenticated');
  if (secondsSinceAuthentication(req) > 600) return fail(req, 'reauth_required');

  let confirm = '';
  try { confirm = String((await req.json()).confirm ?? ''); } catch { /* empty */ }
  if (confirm !== 'DELETE') return fail(req, 'bad_request');

  try {
    await deleteAccount(user.id, 'account_deleted');
    return json(req, { ok: true });
  } catch (e) {
    logError('account-delete', e);
    return fail(req, 'server_error');
  }
});
