# OfficeBites production repair — 28 October 2026

Production ordering is still blocked by missing backend contracts. Code changes
in this release branch do not repair the currently served deployment until the
reviewed database changes, approved legal documents, verified banking and frontend
release are installed. No production business data, settings or deployment changed.

## Verified failures and fixes

Production is `gfzhdkitdyqftealgqfi`; staging is `eyhmarmekioovcjibcbr`.
The inspected live deployment is `dpl_6MGnguqN7HkhPMpsyGYvA7bcf2hm`, commit
`4b94fbe89e8b5a672e4f308701df61c1224580fd`. Fresh production metadata reports
**38 migrations**, ending `20261010101910`, and **32 orders**: 31 pending payment,
one preparing. The user's 37-migration figure is superseded by this readback.

| Journey | Live result | Release verification / repair |
|---|---|---|
| Admin login, profile role, session restoration, token refresh, logout | PASS using supplied account | Real Auth/API checks; mobile live browser login and reload also pass |
| Customer/vendor login | Password authentication PASS; requested happy paths FAIL: the supplied “customer” is a vendor and both vendor storefronts are suspended | Admin-scoped read confirms the cause. Existing RLS correctly denies access. No unsuspension or role change performed; valid active accounts needed for happy-path UAT |
| Mobile guest menu → cart → checkout | PASS at 390px; cart retained | Live test reaches disabled Place order; zero orders submitted |
| Switching accounts / protected routes | Hosted cross-role testing incomplete | PASS locally: clear the previous account before resolving the next profile; block protected content while loading; reject unknown roles/unlinked vendor profiles |
| Password recovery | Email delivery and successful hosted password change NOT TESTED | PASS for recovery redirect/error contracts and expired-link UI. Handle session lookup rejection, revoke form readiness on logout, and guard submission without a session |
| Checkout → vendor EFT/PayShap → reference → pending → confirmation | FAIL live | Missing manual/legal functions confirmed through catalog and HTTP. Local guest checkout, protected bank snapshots, reporting and review screens pass. No real order or bank transfer submitted |
| Banking verification and payment review | FAIL live | Essential workspace/profile/verification RPCs absent. Local pending profiles, independent review, forbidden self-approval, settings CAS and review screens pass |
| Vendor compliance / approval / restoration | FAIL live for new compliance workflow | Missing compliance/agreement foundation. Local evidence, scoped assignments, expiry/revocation, independent review and guarded approval screens pass |
| Legal documents / acknowledgements | FAIL live for new approved-version flow | Missing legal store/RPCs; live `/admin/legal` is 404. Candidate implements the route and approved-version flow; public documents, vendor agreement and explicit customer consent tests pass. No draft approved or acceptance fabricated |
| Vendor/customer management writes | Hosted mutations NOT PERFORMED | Fix false success on zero-row vendor approve/restore/reject/suspend and customer suspension. Require a returned row; customer action also filters customer role |
| History, notifications, data isolation | Managed customer/vendor regression NOT CERTIFIED | Existing order tables and RLS remain. Local role/race, notification and historical-order evidence has limits below; preserve hosted data and test with corrected accounts after backend installation |

All supplied passwords authenticate after correction. The customer/vendor profile
queries return `PGRST116` because the restrictive `active_account_access` policy
requires `private.active_account()`, which rejects suspended vendor storefronts.
An ordinary supplied-admin read verified both vendor ownership links and suspended
statuses. There are no Auth users without profiles in production. This is expected
access denial, not a reason to create replacement profiles, trust user metadata,
change roles or weaken RLS. The frontend now gives account-unavailable/support
guidance for a hidden/missing profile instead of encouraging repeated refreshes.

The missing APIs are physical catalog omissions, not just PostgREST cache errors.
Live browser probes returned `404/PGRST202` for `get_payment_gateways`,
`get_vendor_manual_methods` and `manual_payment_workspace`; the live app also calls
absent `get_delivery_settings`. The release ordering flow removes that delivery
dependency and retains ordinary typed delivery. It never enables an unverified
bank destination or falls back to marking an order paid.
The actual guest checkout also returned 404 for `get_order_assistance_options`
and `get_collection_options`; those excluded workflow calls are removed from the
release checkout. Cart-to-checkout succeeds, but the Place order button is disabled.

`frontend-dependencies-20261028.json` inventories 58 literal RPC dependencies,
including unused service methods, plus table/bucket and Edge Function references.
**28 launch-active RPCs are missing live; all 28 are present in the composed
candidate's catalog.** All directly referenced application tables exist with RLS;
the new compliance Storage bucket/policies require step 4 below. Inactive delivery,
provider and acquisition methods are identified separately. This static inventory
does not certify managed API transport or every nested select. Existing
`admin-account-removal` is deployed; absent Ozow initiation is excluded from launch.

## Checks actually completed

- Existing release browser suite: **70 passed**.
- Extended suite: **76 passed, one failed** because the new auth fixture lacked
  the query builder's `limit()` method. Added that fixture method, rebuilt, then
  **all seven auth browser cases passed**, including the customer case. These are
  77 distinct passing cases across runs, not a single clean 77-case run.
- Auth service: **18 assertions passed** for three roles, unavailable profiles,
  suspended/deleted accounts, missing sessions, expired refresh tokens and password
  recovery/update contracts. Auth switch/signout races: **three scenarios passed**.
- Management actions: **17 assertions passed**; zero-row responses cannot report
  success. Production grant candidate: **18 PGlite assertions passed**.
- Baseline database/accounting/role checks: **73 PGlite assertions passed**.
  Missing-contract/error checks: **nine passed**.
- Lint: zero errors, nine existing React/context warnings.
- Full production-target PWA build passed; compiled JavaScript targets only
  `gfzhdkitdyqftealgqfi.supabase.co`; service worker generated. No deployment.
- All four candidate SQL SHA-256 values match the existing reviewed manifest.
  Current migration count/latest and all three security-function hashes still
  match step 1 guards. Managed Storage ownership remains `supabase_storage_admin`.
- Before/after hashes of every existing order, suborder and order item are equal;
  all 32 orders and their statuses are unchanged. See the preservation artifact.

The earlier native package rehearsal recorded 119 passing assertions, including
concurrent checkout/receipt/settings cases. It was **not rerun successfully today**:
the local native PostgreSQL executable cannot start because its Windows runtime
dependencies are unavailable. PGlite checks today do not replace that concurrency
rehearsal or a managed Supabase restore/UAT. No SQL candidate changed in this repair.
Real customer/vendor sessions, recovery-email delivery, Realtime notification
delivery, Storage upload transport and physical devices remain unverified.

Credentials were read only from an ignored local file. No passwords, tokens,
browser storage, screenshots or traces are included in these evidence artifacts.
Auth testing creates/revokes test sessions; it does not write orders or payments.

## Exact database release sequence

Use only the files below, in this order, with SHA-256 values from
[`release/production-migration-manifest.json`](release/production-migration-manifest.json).
They are already committed in the integration branch; this repair preserves their
bytes. One transaction per file; reconcile success and record its new migration
history entry with the authorized runner before continuing.

| Step | File under `release/production-candidates/` | Executor / resulting history |
|---|---|---|
| 1 | `20261027093453_production_launch_browser_grants.sql` | Application postgres; 38 → 39 |
| 2 | `20261027112327_production_minimum_manual_legal_foundation.sql` | Application postgres; 39 → 40 |
| 3 | `20261027112437_production_checked_settings.sql` | Application postgres; 40 → 41 |
| 4 | `20261027115843_production_compliance_storage_owner_policies.sql` | Supported managed Storage-owner executor; 41 → 42 |

Do not run `supabase db push`, replay staging history, or install the standalone
`20261027094852` transition guard: it is already composed into step 3. The package
must fail on staging's different ledger. Do not drop/recreate existing order data.

**Installation is not authorized or ready yet.** Before executing, verify an
available production backup/PITR and usable restore evidence, including Storage
bytes/configuration, and agree the recovery point/window. Obtain a supported
Storage-owner execution path and approval for the exact four-file hashes/target.
No backup existence or recovery drill has been inferred from project health.
Ordinary postgres must not gain managed-role membership or have guards removed.

Immediately before installation rerun `checks/production-launch-preflight.sql` and
`checks/integrated-release-rpc-preflight.sql`, verify target in the control plane,
compare complete ledger/object/security metadata, and refresh preservation digests.
Stop on drift. After each file verify recorded history and expected objects; after
all four verify grants/RLS, effective PostgREST exposure, Storage policies and
unchanged existing data. Keep rollout and payment initiation closed.

## Frontend deployment order and go-live boundary

1. Push only `release/vendor-eft-legal-launch`. Its committed `vercel.json` disables
   automatic deployment for this branch; the only GitHub workflow is manually
   dispatched. Do not merge, change production branch, invoke a deploy hook or alias.
2. Complete the database sequence and authenticated managed UAT first. Configure a
   production build for project `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71`, team
   `team_kKRzCLk1pNHoIA4sV1M0ciSg`, exact reviewed release SHA and production public
   Supabase pair. Verify `vercel --help`/installed CLI and environment before use.
3. With release authorization, `vercel pull --yes --environment=production`,
   `vercel build --prod`, then `vercel deploy --prebuilt --prod --skip-domain`.
   Verify the unaliased candidate's bundle host, Auth/roles, legal/version evidence,
   private banking, history and API behavior. Keep the current live aliases intact.
4. Legal owners must approve actual public/vendor document versions and verified
   disclosures. The vendor must accept its assigned agreement; an independent
   administrator must verify the current banking/compliance evidence. Confirm
   payment/commission/refund operations. No migration supplies these approvals.
5. Only after those gates and explicit launch authorization enable the intended
   EFT/PayShap settings through the checked workflow, run approved no-funds UAT,
   and promote the exact tested production candidate using `vercel promote URL`.
   Verify live guest/member mobile checkout, order references, report-unpaid state,
   independent confirmation, notifications/history and isolation before sign-off.

Retain the prior live deployment ID for frontend rollback. A failed SQL transaction
rolls back; after commit prefer authorized forward containment of new ordering.
Do not drop legal/payment evidence, rewrite historical snapshots, mark pending
orders paid, or restore a database over new customer activity without reconciliation.

## Evidence

Current artifacts in `docs/release/`: `live-critical-catalog-20261028.json`,
`live-preflight-20261028.json`, `frontend-dependencies-20261028.json`,
`hosted-auth-results-20261028.json`, `hosted-browser-results-20261028.json`,
`live-guest-journey-20261028.json`, `production-build-20261028.json`,
`data-preservation-20261028.json`. The existing four-file SQL/RPC manifests and
`INTEGRATED-CHECKOUT-COMPATIBILITY-REPAIR-20261027.md` supply the candidate's detailed
security/financial contracts and previous native-test evidence.
