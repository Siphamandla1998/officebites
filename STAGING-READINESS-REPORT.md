# Staging readiness — 16 October 2026

## Current continuation status

This section supersedes the earlier baseline narrative below. Working tree started clean on `feat/checkout-ozow-distance-admin-controls`; `c5891ab` and `742ba10` were verified. Origin/main remains `4c4835d`. The owner reconfirmed Vercel Production Branch Tracking is main (the connector cannot independently expose that setting). Existing feature commits were pushed normally. Vercel returned a READY **preview**, target null, for `742ba109d433ab0c0035e4ce92805ad8c35698f2`: https://officebites-73898hklk-sp24tg-6983s-projects.vercel.app. No production deployment was requested.

The two installed migrations `20261016080056` and `20261016081551` were reconfirmed and never replayed. New source `20261016083644_ozow_attempts_subscription_approval.sql` was dry-run and applied transactionally **only to staging**, recorded by the connector as **20261016084712**. This mapping must be reconciled before future CLI migration workflows; do not recreate it or run blanket db push. Staging's actual preparation definition, method constraints, financial view and prerequisites were inspected before application. Existing methods are preserved; old local schemas' PayFast-only CHECK gains Ozow. Twelve existing and sixteen new native synthetic assertions passed inside rollback transactions. Final QA Auth-row count is zero.

Staging-only `ozow-initiate`, `ozow-webhook`, `ozow-reconcile` v1 are deployed, using the pinned shared SDK/runtime and handler dependencies. Initiation is guest-proof/member-authenticated in the function/RPC (`verify_jwt=false`); webhook authenticates raw-body Svix signatures (`false`); reconciliation requires platform JWT plus active administrator (`true`). Empty HTTP probes returned 503 configuration required, 503 configuration required, and 401 missing authorization, respectively. No merchant secret was requested/read/set, no provider request was sent, and no gateway was enabled. These probes establish gates, not transacting integration.

Read-only postchecks: all five new private tables have RLS and no anonymous SELECT/member INSERT privileges. Service-only receipt RPCs and guarded owner/admin subscription RPCs were checked. Ozow disabled/unready, delivery enforcement disabled, retention disabled, zero saleable plans. Existing PayFast settings and historical financial snapshots remain intact. Security advisor reports nine intentional private RLS/no-policy INFO findings, seven anonymous and 34 authenticated SECURITY DEFINER warnings requiring explicit guards/ACLs, and existing leaked-password protection disabled. See https://supabase.com/docs/guides/database/database-linter and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

Blockers now are commercial/provider configuration and hosted verification, rather than missing attempt persistence/confirmation code: Ozow One API staging credentials/site/permissions, thin webhook registration/signing secret, provider reconciliation/retry/concurrency tests and owner activation approval; administrator-entered delivery settings and operational GPS tests; subscription benefits/refund/re-approval terms and billing integration. R200/month is confirmed, but no 30-day term, benefit or re-approval price is inferred. Financial fee policy remains untouched; unknown Ozow fees stay unresolved.

## Earlier baseline and first implementation evidence

Repository origin is Siphamandla1998/officebites. Starting local main was f5db4af; fetched origin/main is `4c4835db62b7db4c7a725c92d7a6294ca523fa57`. The working tree started clean. Feature branch `feat/checkout-ozow-distance-admin-controls` starts at verified origin/main. Production-recovery points to that same commit; audit-cleanup is an older unmerged branch. No branch newer than current main was found. No reset, main push, merge or production deployment is authorized for this work.

## Actual staging inspection

Project `eyhmarmekioovcjibcbr`, officebites-staging, is ACTIVE_HEALTHY, PostgreSQL 17.6.1.166. No customer rows were copied from live.

History now includes October 10 catalog/identity prerequisites, order/chat alignment, scoped names, atomic support/feedback, financial ledger, account security and production-audit cleanup. This differs from the October 8 staging failure. Actual columns, enums, function bodies/arguments/ACLs, public/Storage policies, triggers, indexes and table grants were captured read-only in session memory, rather than trusting names alone. Staging includes 22 public tables, financial/private helpers, payment preparation, audit cleanup and receipt-reporting RPCs. Messages and notifications are published to Realtime. Retention is disabled. Authenticated users cannot update order or suborder status directly; anonymous users cannot insert orders directly.

Existing Edge Functions: payfast-initiate v18 (uses prepare_payfast_order), payfast-notify v18, admin-account-removal v1. The main repository's older initiation code directly updated orders; the feature reconciles this with the staged RPC preparation behavior rather than overwriting backend functions with the old main implementation. PayFast signature encoding and notify verification remain preserved.

The actual staging financial/cleanup function definitions still need to be reconciled into repository history before any blanket CLI push. Old migration filenames have known differing installed timestamps and staging-specific prerequisites. Only the reviewed new feature migration may be applied; do not replay historical migrations.

## Environment isolation

An ignored `.env.staging.local` contains ONLY staging's project URL and enabled public publishable key. Existing `.env.local` was preserved; it targets live, so do not use default dev mode for hosted staging checks. Use `npm run dev -- --mode staging` / `npm run build -- --mode staging`. No service credential belongs in frontend configuration. Vercel's preview URL variable was inspected read-only and points to staging, not live. Production environment/settings were not changed. Hosted preview build/auth/browser flows still require separate evidence.

## Baseline and blockers

Locked dependency installation passed (442 packages). Existing local regression suite passed on current main. Initial lint/build attempts overlapped the still-running npm install and could not find tools; after installation, lint/build passed. Deno's default local npm resolution conflicted with the unpinned JSR SDK; isolated `--node-modules-dir=none --no-lock` checking avoids modifying application dependencies. See TEST-RESULTS.md for final results.

Remaining blockers: Ozow merchant One API staging access/client/site/scope/signing secret and webhook registration; complete owner delivery policy (coordinate supplied, “10 KM” alone does not define both radii/fee); hosted disposable Auth/Storage tests; native concurrent confirmation/cancellation testing; PWA upgrade/mobile permission testing. Delivery enforcement and Ozow remain disabled by default. No staging or production readiness is claimed from mocked or PGlite results.

## Reviewed staging application

Only the new feature migrations were applied transactionally to staging:

| Source file | Installed history version |
| --- | --- |
| 20261016074256_checkout_recovery_mobile_delivery_gateways.sql | 20261016080056 |
| 20261016081336_booking_mobile_validation.sql | 20261016081551 |

The second migration fixes explicit international-mode SQL regex escaping found by an additional booking contact test and protects new/changed event_booking_requests.contact_phone values. The already-applied first migration is preserved verbatim; it is not replayed. Definitions, RLS, RPC grants and Data API availability were checked. Private settings/attempt/quote tables have RLS and no public grants; privileged functions check active administrator identity. Ozow is disabled/unready, delivery enforcement disabled, retention disabled. PayFast retains the existing enabled path; its ready flag is a compatibility gate, not evidence of merchant approval or a successful payment.

Twelve native staging assertions passed inside an explicit rollback transaction, using only synthetic Auth rows, profiles, vendors, meals, orders and SQL payment confirmations. These exercised Auth database registration triggers, guest proof, cancellation/issued/paid cases, commission snapshots, authoritative delivery fees and reconciliation. No provider API transaction was initiated. A fixture concatenation typo was corrected before the passing run. Final inspection found zero remaining synthetic test Auth rows. This is not GoTrue sign-up/email, real SDK login, hosted webhook delivery or native concurrent-session testing.

Staging HTTP: public gateway/delivery RPCs returned 200; an unproved cancellation and anonymous admin update returned 401. Public preview Vercel URL configuration and local staging mode both reference staging. The reviewed PayFast initiation source is committed but NOT redeployed to staging; deployed v18 already uses the now-updated preparation RPC. No Ozow endpoints were deployed.

Security advisors: four informational RLS-without-policy findings correspond to intentionally inaccessible private tables. Callable SECURITY DEFINER APIs remain warnings and require their explicit body checks/ACLs; leaked-password protection remains disabled. Performance advisors previously reported 24 unused-index informational findings; no automatic index deletion or unrelated settings changes were made. Remediation references: https://supabase.com/docs/guides/database/database-linter and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
