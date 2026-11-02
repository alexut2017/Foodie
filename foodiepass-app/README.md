# FoodiePass mobile app (iOS + Android)

One React Native codebase (Expo) for both stores. It uses the same Supabase project, data and server functions as the website.

## What it does

**Sign-up (inKind-style, phone first)**

1. **Welcome**: "Get started" or "I already have an account" (same flow).
2. **Phone number**: we text a 6-digit code. Optional "Continue with Apple" on iPhone.
3. **Code**: six boxes, autofilled from the text message on iOS and Android, auto-submits, 60-second resend.
4. **Name and email**: name goes on the pass, email gets receipts; optional marketing opt-in (recorded as its own consent).
5. **Location**: asked only here, and only for "near you" sorting. "Not now" is fine.

Returning members skip steps 4 and 5.

**In the app**

- **Explore**: list or map, search, neighborhood chips, sorted by distance when location is allowed.
- **Restaurant**: offer and details; "Show my pass" for paid members, "Join to use this offer" otherwise.
- **My pass**: no pass until the membership is paid. Paid members show one screen with their name, paid-through date and a live clock that proves it isn't a screenshot. Staff only look at it; visits aren't tracked.
- **Account**: details, membership status, Manage billing (Stripe portal), sign out (this device or all), delete account.

## Run it

```bash
cd foodiepass-app
npm install
npm run setup      # installs the Expo modules at the versions that match the SDK
npx expo start     # scan the QR code with Expo Go on your phone
```

If `expo` reports version mismatches, run `npx expo install --fix`. The project targets Expo SDK 56; SDK 57 is a drop-in upgrade (`npx expo install expo@latest --fix`).

## Turn on phone sign-up (needs an SMS service)

1. Create a Twilio account and a Messaging Service (or Twilio Verify).
2. In Supabase go to **Authentication → Sign In / Providers → Phone** and turn it on. Choose Twilio and paste the Account SID, Auth Token and Messaging Service SID **yourself**. These are secrets, so they never go in the app or GitHub.
3. For testing without sending texts, add test numbers under **Phone → Test OTP** (for example `17135550100=123456`).
4. Run `foodiepass-backend/supabase/migrations/20261102000000_app_consent.sql` (lets members record their marketing choice).

## Optional: Sign in with Apple

Set up the Apple provider in Supabase with the bundle ID `com.foodiepass.app`, then set `"appleSignIn": true` in `app.json`. Apple requires this button if you add other third-party sign-ins (Google, Facebook) later.

## Build for the stores

1. **Accounts (yours):** Apple Developer Program ($99/year) and Google Play Console (one-time $25).
2. Run `npm i -g eas-cli`, then `eas login`, then `eas build:configure`.
3. **Test builds:** run `eas build --profile preview --platform android` for an installable APK, or `--platform ios` for TestFlight.
4. **Store builds:** run `eas build --profile production --platform all`, then `eas submit`.
5. **Android map:** add a Google Maps API key under `android.config.googleMaps.apiKey` in `app.json` before the production build. Expo Go works without it.

## Payments in the app

Membership checkout opens Stripe's hosted page in the in-app browser, and the server grants access. FoodiePass sells a real-world dining service, which Apple generally allows outside in-app purchase (App Review Guideline 3.1.3(e)), but confirm with App Review at submission. Payments show "opens at launch" until Stripe and the server functions are live.
