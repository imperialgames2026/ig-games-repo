# Imperial Games KYC — Sumsub-only decision (2026-10-17)

**Decision:** Use Sumsub directly in the existing Imperial Games **Account** screen. **Do not create a separate Imperial Verify app, custom face-matching or document-recognition system, or Cloudflare Worker for KYC.**

## Current code and status

- UI: `src/components/KYCVerificationPanel.tsx`, mounted by `src/App.tsx`. Government ID + selfie/liveness review through provider SDK, and independent phone confirmation through Supabase Auth.
- Staging status table: `public.kyc_verifications` (RLS: own status read only; backend-only writes). Does **not** contain government ID photos, selfie bytes, biometric templates, uploaded documents or one-time passwords.
- Draft Sumsub handlers: `supabase/functions/kyc-start-v1/index.ts` and `supabase/functions/kyc-sumsub-webhook/index.ts`. Code has **not** passed authenticated provider sandbox E2E or deployment acceptance tests. No claim is made that they work with a real provider configuration.
- Feature flags: `VITE_KYC_DOCUMENTS_ENABLED`, `VITE_KYC_PHONE_SMS_ENABLED` default false. Backend `KYC_PROVIDER_READY` must not be enabled until signed webhook and identity mapping are audited.
- No Sumsub account or paid plan was purchased by this repository change; no API token or secret is stored in GitHub.

## Recommended deployment topology

```
Imperial Games Account (React)
  -> (authenticated) Supabase Edge Function generates short-lived Sumsub SDK token
  -> hosted Sumsub SDK collects and verifies ID + selfie directly
  -> authenticated/HMAC-verified Sumsub webhook -> Supabase status (server only)
  -> user sees verified/pending/rejected status in Account

Independent SMS verification -> Supabase Auth phone_confirmed_at
Fully verified = accepted provider identity/document/selfie checks AND confirmed phone.
```

## Before enabling real identity submissions

1. Create an official Sumsub account, choose sandbox/test mode, and configure a verification level that explicitly requires a government ID document **and** selfie/liveness. Verify its exact policy and coverage, including age check and geo/compliance requirements, with Sumsub and legal counsel.
2. Supply Sumsub **sandbox** app token, API signing secret, webhook signing secret, and level name through Supabase Edge Function secret manager — never in Vite env, GitHub, chat, or frontend.
3. Validate the webhook design against the Sumsub *documented* applicantReviewed event format, HMAC algorithm, timestamp parsing, replay/idempotency, record-to-applicant binding, and vendor retrieval/verification of the applicant + completed required steps. A signed summary status must not automatically imply both ID and selfie passed without a verified level and step completion. Sandbox approvals are not production verification.
4. Check vendor WebSDK version, script URL, token refresh behavior and CSP. Add full integration tests for approve/reject/retry, session replay, cross-account substitutions, concurrent sessions, disabled state, and rate limits.
5. Configure privacy disclosures, legal basis/consent where required, minimization, retention/deletion and appeal process; avoid returning sensitive KYC data in errors or logs.
6. Enable phone OTP only after an SMS provider is configured in Supabase Auth. SMS verification alone does not establish identity, age or KYC completion.
7. Do not turn KYC status into permission to deposit, wager, redeem or trade until separate financial compliance, age, jurisdiction and platform controls are independently reviewed and implemented.
8. Leave the feature **off** until all above acceptance gates are met. Keep integration branch out of production until CI/test gates pass.

References: https://docs.sumsub.com/reference/generate-access-token, https://docs.sumsub.com/reference/authentication, https://docs.sumsub.com/docs/user-verification-webhooks .
