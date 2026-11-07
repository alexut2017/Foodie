import Constants from 'expo-constants';

// Public values only. The publishable key is designed to be in client apps (row-level security protects data).
// Never put the service-role key, Stripe secret keys or Twilio credentials in the app.
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

export const CONFIG = {
  supabaseUrl: String(extra.supabaseUrl ?? ''),
  supabaseKey: String(extra.supabasePublishableKey ?? ''),
  siteUrl: String(extra.siteUrl ?? 'https://wuemilyy-stack.github.io/Foodie/'),
  termsVersion: String(extra.termsVersion ?? '2026-11-04'),
  appleSignIn: extra.appleSignIn === true,
  resendSeconds: 60,
  passMinutes: 15,
  version: String(Constants.expoConfig?.version ?? '0.3.0'),
};

export const FN_URL = CONFIG.supabaseUrl.replace(/\/+$/, '') + '/functions/v1';
export const siteLink = (hash: string) => CONFIG.siteUrl.replace(/#.*$/, '') + '#' + hash;
