// Pure rule for when an unpaid account is deleted. No database or Stripe calls, so it can be tested on its own.
// Keep the two periods in step with the Terms Of Use and the Privacy Policy on the website.
export const NEVER_PAID_DAYS = 2;
export const LAPSED_DAYS = 30;
const DAY = 86_400_000;

export interface AccountFacts {
  createdAt: number;
  isAdmin: boolean;
  liveSubscription: boolean;
  checkoutInProgress: boolean;
  unusedGift: boolean;
  paidDates: Array<number | null>; // entitlement ends, subscription ends and paid purchases
}

/** When the account may be deleted, or null if it must be kept. */
export function deleteAccountAfter(a: AccountFacts): number | null {
  if (a.isAdmin || a.liveSubscription || a.checkoutInProgress || a.unusedGift) return null;
  const paid = a.paidDates.filter((d): d is number => typeof d === 'number' && Number.isFinite(d));
  if (paid.length) return Math.max(...paid) + LAPSED_DAYS * DAY;
  return a.createdAt + NEVER_PAID_DAYS * DAY;
}
