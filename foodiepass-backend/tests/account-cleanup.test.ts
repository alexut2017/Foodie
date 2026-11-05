// Run: node --experimental-strip-types --test tests/   (Node 22.6+)   or   deno test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteAccountAfter, NEVER_PAID_DAYS, LAPSED_DAYS } from '../supabase/functions/_shared/account-cleanup.ts';

const DAY = 86_400_000;
const CREATED = Date.UTC(2026, 0, 1);
const base = { createdAt: CREATED, isAdmin: false, liveSubscription: false, checkoutInProgress: false, unusedGift: false, paidDates: [] };

test('the agreed periods', () => {
  assert.equal(NEVER_PAID_DAYS, 2);
  assert.equal(LAPSED_DAYS, 30);
});

test('never paid: deleted 2 days after sign-up', () => {
  assert.equal(deleteAccountAfter(base), CREATED + 2 * DAY);
});

test('lapsed member: deleted 30 days after the latest paid date', () => {
  const end = Date.UTC(2027, 0, 1);
  assert.equal(deleteAccountAfter({ ...base, paidDates: [end - 90 * DAY, end, null] }), end + 30 * DAY);
});

test('a missing date never counts as a payment', () => {
  assert.equal(deleteAccountAfter({ ...base, paidDates: [null, Number.NaN] }), CREATED + 2 * DAY);
});

test('always kept: admins, live subscriptions, checkouts in progress and unused gifts', () => {
  for (const flag of ['isAdmin', 'liveSubscription', 'checkoutInProgress', 'unusedGift']) {
    assert.equal(deleteAccountAfter({ ...base, [flag]: true }), null, flag);
  }
});
