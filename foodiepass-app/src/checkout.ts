import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStatus, newId, startCheckout, openPortal, type BillingStatus } from './billing';

// Membership checkout opens Stripe's hosted page in the in-app browser (a real-world dining service, not a
// digital good; confirm App Store guideline 3.1.3(e) at review time). Access is granted only by the server.
const ATTEMPT_KEY = 'fp-attempt-membership_annual';

export async function payForMembership(): Promise<BillingStatus | null> {
  let attempt = await AsyncStorage.getItem(ATTEMPT_KEY);
  if (!attempt) { attempt = newId(); await AsyncStorage.setItem(ATTEMPT_KEY, attempt); }
  const { url } = await startCheckout('membership_annual', attempt); // throws ApiError (already_subscribed, etc.)
  await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'done' });
  // Back in the app: confirm with the server for up to ~30 seconds.
  for (let i = 0; i < 15; i++) {
    const s = await getStatus(attempt).catch(() => null);
    if (s && (s.membership.active || s.attempt_status === 'completed')) { await AsyncStorage.removeItem(ATTEMPT_KEY); return s; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

export async function manageBilling() {
  const { url } = await openPortal();
  await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'done' });
}
