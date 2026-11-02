# Foodie login and payments specification

Version 1.1 · October 25, 2026 · Proposed implementation requirements

## 1. Outcome and scope

People can join Foodie using an account they already have, return without remembering another password, and pay through a trusted checkout. Their saved content, preferences, and purchases remain connected across devices and sign-in methods.

This is a standalone specification for the Foodie app. Foodie's codebase, current technology stack, pricing, and business model have not been verified. The files inspected earlier belong to a different project and are not evidence of Foodie's implementation.

Proposed architecture: Supabase Auth/Postgres for accounts and data, a server API for protected operations, and Stripe Checkout and Customer Portal for web payments. Adapt these components to Foodie's existing stack before implementation. All endpoint and table names below are proposed contracts.

Account creation is free and does not require a payment card. Preserve the user's current activity across login. Payment should appear when the user chooses a paid offering, not automatically after registration.

### Payment scope to finalize

Support secure one-time purchases as the baseline payment flow. Enable recurring subscriptions only if Foodie offers a membership; the subscription sections below define that optional module. No price, trial, membership benefit, food-ordering workflow, delivery service, or marketplace payout model is assumed. If Foodie collects money for restaurants or other sellers, specify seller onboarding, merchant responsibility, commissions, payouts, and refunds before implementing that additional scope.

## 2. Sign-up and login experience

Use one account screen for both new and returning users. Heading: **Join Foodie** during onboarding; **Welcome back** when opened from login.

| Method | Launch behavior |
| --- | --- |
| Google | Prominent “Continue with Google” button |
| Facebook | Prominent “Continue with Facebook” button |
| Apple | Prominent “Continue with Apple” button; first on Apple devices |
| Email | “Continue with email,” followed by a one-time code |
| Existing password | “Use password instead” under email; retain recovery |
| Microsoft | Next supported provider, behind a feature flag |

Use provider-approved button branding, accessible labels, visible keyboard focus, and at least 44-pixel tap targets. Avoid a separate registration form for social users. Request only identity information needed for login; never request friend lists, posting permissions, contacts, or advertising access.

Show terms and privacy links before account creation. Record acceptance of current terms separately from optional marketing consent. Request optional personalization or location permissions separately, only when the relevant feature needs them. No payment card is required to create an account.

### Main journeys

1. New visitor selects “Join Foodie” or reaches an action that requires an account, chooses a provider, completes authentication and applicable consent, and resumes that action.
2. Returning user selects a method and lands on their existing account. Preserve an intended internal destination through authentication.
3. User selects email, receives a single-use code, enters it, and continues. Set a 10-minute expiry and 60-second resend cooldown; enforce rate limits on the server/provider, not only in the interface. Show a neutral delivery message that does not disclose account existence.
4. User cancels provider authentication or loses connectivity. Return to the account screen with their in-progress activity intact and allow retry or another method.

If Facebook supplies no usable email, allow account creation through its provider identity, then request and verify a contact email before billing. Accept Apple private relay addresses. Never require an existing social user to invent a Foodie password.

## 3. Identity, sessions, and recovery

Supabase user UUID is the permanent account identifier. Email is a mutable contact attribute; provider identities and billing records attach to the UUID.

- Use the supported Supabase OAuth authorization-code/PKCE flow, SDK validation, exact callback allowlists, and HTTPS in hosted environments. Return paths must be approved internal routes, not arbitrary supplied URLs.
- Validate the access token server-side for every protected API. Enforce ownership and subscription access server-side; UI visibility is not authorization.
- Let the SDK manage session renewal. Clear account-specific caches on sign-out or account switch. Never log tokens, OAuth codes, passwords, or email codes.
- If Foodie uses a single-page web app, use the supported browser SDK session model, with a restrictive content security policy and no unsafe HTML rendering. A future server-session implementation must use Secure, HttpOnly cookies and CSRF protections; do not claim browser SDK tokens are HttpOnly.
- Require recent authentication before linking/unlinking methods, changing contact email, exporting private data, or deleting an account. Verify new email addresses before making them primary.
- Offer “Sign out on this device” and “Sign out on all devices.” Document and test the short remaining lifetime of already-issued access tokens after refresh-session revocation.
- Require MFA for administrative access. User passkeys and optional MFA are follow-up work, subject to SDK/platform validation.

### Linking and duplicate accounts

Supabase supports automatic identity linking for matching email identities and manual linking for signed-in users. Use its documented verification safeguards; never implement a custom merge based solely on an email string. Manual linking is currently documented as beta and needs an explicit integration test and recovery path. [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)

Settings → Account lists connected providers and offers “Add sign-in method.” Require recent authentication plus successful authentication with the new provider. Do not allow removal of the last usable method. If two established accounts already exist, require proof of control of both and a deliberate merge workflow; never silently combine private data or purchases.

### Preserve in-progress activity

If Foodie uses anonymous Supabase sessions, link the new identity to preserve the UUID where supported. If the provider belongs to an existing account, authenticate that account and offer to import the current draft. Preserve existing saved data unless the user chooses replacement. Transfer through a server-validated, short-lived, single-use handoff bound to the source draft and authenticated destination; a caller-supplied source UUID is insufficient. Test retries and interrupted redirects. Do not place private preferences or draft content in URLs or provider metadata.

## 4. Provider and email setup

Keep development, staging, and production credentials and callback lists separate. Each provider is enabled only after a real end-to-end test; hide methods that are not configured.

| Integration | Required setup |
| --- | --- |
| Google | Configure OAuth consent/branding, authorized origins, web client credentials, and the exact Supabase callback; complete verification if required for the selected configuration |
| Facebook | Configure a Meta app with Facebook Login, valid OAuth redirect URI, required public policy/deletion information, and live-mode/review requirements applicable to requested permissions; test with an ordinary non-developer account |
| Apple | Configure the applicable app/service identifiers, callback/domain, signing key and secret lifecycle; test private relay and first-login-only profile fields |
| Email | Configure production SMTP, sender authentication, code templates, delivery monitoring, expiry, resend throttling, and abuse controls |
| Supabase | Set site URL and approved app redirects, enable providers and anonymous conversion/manual linking as needed, verify email policy, and test production session behavior |

Provider secrets and service-role credentials remain server-side or in provider dashboards. Only Supabase URL and publishable key belong in browser configuration. Schedule secret-rotation ownership and alerts. Setup references: [Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Facebook](https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook), and [supported providers](https://supabase.com/docs/guides/auth/social-sign-in).

## 5. Offerings and checkout

Foodie's prices, currency, paid offerings, and subscription intervals are **TBD**. Configure them centrally; do not reuse another app's prices. No free trial by default. Show the full amount, currency, tax treatment, and refund/cancellation terms before purchase. For memberships, also show the renewal interval and recurring charge clearly.

### One-time purchases

1. The signed-in user selects an offering. The server validates its availability and computes the amount from trusted product records; never trust a client-supplied total.
2. Create an account-bound purchase record and a Stripe Checkout Session in one-time payment mode, using a stable idempotency key for that purchase attempt.
3. On return, display “Confirming your payment.” Fulfill only after server-side confirmation of successful payment; delayed methods remain pending until confirmed.
4. Process signed payment events exactly once per purchase. Failed or abandoned attempts remain unpaid and can be retried without duplicate charges or fulfillment.
5. Show receipt, purchase status, and support/refund entry points in Account → Payments. Define the actual fulfillment action for each Foodie offering before launch.

### Optional recurring membership

1. Signed-in user selects a plan. Anonymous users must finish registration; users without verified contact email must verify it.
2. Server maps a trusted plan code to a configured Stripe recurring Price ID. Ignore client-supplied prices, customer IDs, amounts, and entitlement claims.
3. Server resolves the account's stored Stripe customer ID and creates or reuses the current checkout attempt.
4. Stripe-hosted Checkout collects payment and handles supported authentication steps. Offer cards and eligible wallets such as Apple Pay/Google Pay when available for the merchant, device, and location; availability is not guaranteed.
5. On return, show “Confirming your subscription” until the server confirms access. A success URL alone never grants access. On delay, let the user leave and return without paying again.
6. Cancellation or abandoned checkout preserves the account and saved content. Retry resumes an eligible open session or creates a new attempt after expiry.

Use a database uniqueness constraint for one Stripe customer mapping per user and a lock/unique active attempt to prevent concurrent purchases. Use stable idempotency keys per operation/attempt. A time-bucket key and a preflight subscription lookup alone are insufficient to prevent races.

In Settings → Subscription, show plan, next renewal or access-end date, status, payment-management link, and cancellation action. Use the Stripe Customer Portal for payment method updates, invoices, and cancellation. Launch with cancellation at period end and plan changes at renewal; immediate changes/proration require a separately specified policy. [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions)

## 6. Payment events and optional membership access rules

Persist purchase and billing state locally for dependable fulfillment and authorization. For one-time purchases, track pending, paid, fulfilled, failed, and refunded states; enforce a unique fulfillment record per purchase. Partial refunds must retain the refunded amount and remaining balance. The access table below applies only to memberships. Stripe is authoritative for billing; Foodie's server translates verified state into feature entitlements.

Implement a webhook endpoint that verifies the Stripe signature against the raw request body before parsing. Persist each event ID uniquely, queue durable processing, and acknowledge promptly only after durable acceptance. Retry failed processing and alert on exhausted retries. Duplicate deliveries must have no additional effect. Resolve out-of-order deliveries by retrieving authoritative current objects and applying changes transactionally.

Handle `checkout.session.completed`, asynchronous checkout success/failure where enabled, `invoice.paid`, `invoice.payment_failed`, and subscription created/updated/deleted events. Subscribe to refund/dispute events for support review and the approved refund policy. Checkout completion does not by itself establish that funds were collected. [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)

| Verified condition | Proposed access policy |
| --- | --- |
| Initial payment pending, incomplete, failed, or expired | Free access; no paid grant |
| Paid invoice for valid subscription period | Grant access through the paid-through timestamp |
| Renewal fails after a previously paid period | Three-day grace after paid-through expiry, with payment-update notice |
| Grace expires, unpaid, or paused without paid coverage | Free access; preserve saved data |
| Cancel scheduled | Retain paid access until paid-through expiry |
| Subscription ended | Remove paid access at its effective access-end time |
| Refund/dispute | Record and route for policy-based handling; do not automatically delete the account |

The three-day grace period is a proposed product default. No trial entitlement exists unless trials are deliberately enabled later. Run daily reconciliation and on-demand repair to recover missed events; alert on unexplained mismatches. During provider outages retain already-verified access until its stored expiry/grace deadline, but do not grant new access from unverified client claims.

## 7. Data and API contract

Add versioned database migrations with owner-read policies and server-only billing writes.

| Record | Minimum fields and constraints |
| --- | --- |
| Billing customer | Unique user UUID and unique Stripe customer ID |
| Purchase | Unique purchase UUID, user UUID, offering, amount/currency, unique provider payment ID, payment/fulfillment status, refunded amount, timestamps |
| Subscription (optional) | Unique provider subscription ID, user UUID, price/plan, provider status, paid-through, cancellation timestamp/flag, updated timestamp |
| Checkout attempt | Attempt UUID, user UUID, purchase or membership reference, unique session ID, lifecycle status, expiry, idempotency key |
| Billing event | Unique provider event ID, type, processing status, attempts, received/processed timestamps, sanitized error |
| Entitlement | User UUID, feature/product, access expiry, grace expiry, source subscription |
| Consent/audit | Versioned consent records plus minimal security/billing action audit with retention policy |

Retain only necessary billing metadata; never store card numbers/CVC or put private preferences or content in Stripe metadata. Protect any retained webhook payload with restricted access and bounded retention.

| Endpoint | Contract |
| --- | --- |
| `GET /api/billing/config` | Public offerings, prices, and availability; no secrets |
| `POST /api/billing/checkout` | Authenticated `{offeringId, attemptId}`; returns hosted URL; server binds attempt to user |
| `POST /api/billing/portal` | Authenticated; returns portal URL for the caller's stored customer only |
| `GET /api/billing/status` | Authenticated purchase status and, when applicable, membership plan, dates, and entitlements; must not create a customer |
| `POST /api/billing/webhook` | Stripe-signature authentication, raw body, replay-safe processing; no user bearer token required |

Use consistent error codes for unauthenticated, email-unverified, already-subscribed, invalid-plan, rate-limited, and provider-unavailable cases. Sanitize provider errors shown to customers. Enforce paid access on every paid API, including background-job creation and retrieval where applicable.

## 8. Mobile and account deletion

Web Stripe checkout is the initial purchase channel. If Foodie ships a native iOS app, do not assume web checkout can be reused unchanged for native digital subscriptions. Define the storefront-specific purchase approach before release; use StoreKit in-app purchase where required, with server verification, restore purchases, and notification-driven entitlements. Purchases of physical goods or real-world services require a separate checkout policy from digital features. Keep the entitlement model provider-aware and prevent duplicate cross-platform subscriptions.

Include Sign in with Apple as the planned equivalent privacy-preserving login on iOS. Review current exceptions and regional purchase/link rules at release time. [Apple App Review Guidelines, sections 3.1 and 4.8](https://developer.apple.com/app-store/review/guidelines/)

Account deletion must explicitly explain subscription consequences, authenticate the request, stop Stripe renewals before removing the customer mapping, and handle external-store cancellation instructions where applicable. Use a retryable deletion workflow, revoke sessions/provider connections as applicable, delete personal app data, and retain only records required by the approved retention policy. Do not silently leave recurring charges attached to an inaccessible account.

## 9. Delivery and acceptance

**Phase 1 — Account experience:** provider setup; reusable account screen; email codes; callback handling; preservation of in-progress activity; identity management and recovery. If password accounts already exist, keep them functional.

**Phase 2 — Billing reliability:** persisted customer/subscription mappings, stable Price IDs, checkout concurrency protection, signed webhooks, entitlements, portal, and reconciliation. If billing already exists, backfill customers, purchases, and subscriptions in a dry run; flag duplicates for review before enabling restrictions.

**Phase 3 — Launch:** production credential configuration, provider reviews, email delivery checks, monitoring, support runbook, and staged rollout. Use separate flags for each login provider, checkout availability, and paid-feature enforcement. Disabling new checkout must not stop webhooks or cancellation access.

Release acceptance tests:

1. Google, Facebook, Apple, and email each support new and returning users on desktop/mobile browsers; keyboard and screen-reader flows work.
2. Provider denial, missing email, expired code, refresh, and interrupted callback preserve in-progress activity and give a recoverable error.
3. Same-email provider linking, different-email manual linking, existing-account collisions, Apple relay, and last-method removal behave as specified.
4. Existing accounts and saved content survive any migration; one user cannot access another's records or billing portal.
5. One-time checkout and any enabled membership intervals handle successful payment, decline, required authentication, cancellation, and duplicate concurrent clicks without duplicate charges, fulfillment, or subscriptions.
6. Forged callbacks and invalid webhook signatures grant no access. Replayed/out-of-order events, delayed payment, and missed-event reconciliation produce the correct access state.
7. Renewal failure, grace expiry, cancellation, refund review, and account deletion produce the stated behavior without losing saved content unexpectedly.
8. The selected hosting and API deployments preserve webhook raw bodies, durable processing, ownership checks, and environment isolation.

Track sign-in completion by provider, callback errors, email delivery failure, checkout conversion, webhook processing lag/failures, duplicate mappings, and entitlement mismatches. Exclude credentials and private preferences and user content from analytics. Proposed operating targets: alert when a durable webhook remains unprocessed for five minutes or reconciliation finds a billing/access mismatch.

Before paid launch, the owner must finalize the actual Foodie stack, one-time versus membership scope, offerings and prices, fulfillment responsibilities, launch countries/tax handling, cancellation/refund policy, grace-period acceptance, and native-app purchase scope. Credentials and provider approvals are deployment dependencies; they are not supplied by this specification.
