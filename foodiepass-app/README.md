# GrubScout mobile app (iOS + Android)

One React Native codebase (Expo SDK 56) for both stores. It uses the same Supabase project, data and rules as the website and the web app at `/Foodie/app/`. Version 0.3.0.

## What it does

**Sign-up and sign-in**

1. **Welcome**: "Get started" or "I already have an account".
2. **Phone or email**: phone is the default; we text a 6-digit code (Twilio Verify through Supabase). Email sends a 6-digit code instead. Optional "Continue with Apple" on iPhone.
3. **Code**: six boxes, autofilled from the text on iOS and Android, auto-submits, 60-second resend.
4. **Name and email**: name goes on the pass, email gets receipts; optional marketing opt-in (recorded in `consents`).
5. **Location**: asked only here, only for "near you" sorting. "Not now" is fine.

Returning members skip steps 4 and 5.

**In the app**

- **Explore**: live restaurants and neighborhoods from Supabase, list or map, search, neighborhood chips ("soon" for neighborhoods not live yet), featured first, photos and badges (Featured, New, Founding partner, Dine-in, Pickup).
- **Restaurant**: offer, address, hours, phone, website, directions. Paid members get "I'm here: show my pass"; others get "Activate my pass".
- **My pass**: no pass until the membership is active (`entitlements`, or the billing server once deployed). Paid members see a live member card, pick where they're eating, and the pass opens for 15 minutes. Staff swipe to confirm; the pass turns green with a visit code and is saved to `redemptions`.
- **Account**: details, membership status, referral code and share link, partner application (same `submit_partner_application` RPC as the website), admin dashboard link for admins, Manage billing, sign out (this device or all), delete account.

## Run it on your phone (Expo Go)

```bash
cd foodiepass-app
npm install
npx expo install --fix   # aligns any package with the SDK if Expo asks
npx expo start           # scan the QR code with Expo Go
```

## Installable test builds (EAS, no Mac needed)

You need a free account at expo.dev. Builds run on Expo's servers.

| Build | Command | Needs |
| --- | --- | --- |
| Android test app (.apk you install directly) | `npm run build:android` | Expo account only |
| iPhone simulator build | `npm run build:ios-sim` | Expo account only |
| iPhone test app on real devices | `npm run build:ios` | Apple Developer Program ($99/yr) |
| Store builds | `eas build --profile production --platform all`, then `eas submit` | Apple + Google Play ($25 once) accounts |

First time: `npm i -g eas-cli`, `eas login`, then `eas init` in this folder (links the project to your Expo account).
You can also start builds from expo.dev by connecting the GitHub repo (base directory `foodiepass-app`).

## Sign-in setup (Supabase)

- **Phone**: Authentication → Sign In / Providers → Phone → Twilio Verify. Account SID, Auth Token and Verify Service SID are pasted there by the account owner; they never go in the app or GitHub. On a Twilio trial, codes only go to verified numbers.
- **Email codes**: the "Magic link or OTP" and "Confirm sign up" email templates must include `{{ .Token }}` so members get a code. Until then the email contains only a link, which opens the website, not the app.
- **Android map**: add a Google Maps API key under `android.config.googleMaps.apiKey` in `app.json` before a production build. Test builds show the list view fine.

## Payments in the app

Membership checkout opens Stripe's hosted page in the in-app browser, and the server grants access. GrubScout sells a real-world dining service, which Apple generally allows outside in-app purchase (App Review Guideline 3.1.3(e)); confirm at review. Payments show "opens at launch" until Stripe and the server functions are live.
