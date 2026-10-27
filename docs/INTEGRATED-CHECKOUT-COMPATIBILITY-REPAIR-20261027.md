# Integrated checkout and database compatibility repair

27 October 2026. **Local repair and review: GO. Protected staging UAT, hosted installation and real-money launch: NO-GO.**

This report supersedes the earlier readiness report and its incomplete foundation
plan. A four-file production-specific candidate now installs and passes native
regressions. It is not approved for installation and is not a staging installer.
No hosted SQL mutation, order, notification, deployment, alias/environment change,
publication, activation, push, merge or commit was performed.

## Confirmed cause and current boundaries

Fresh Vercel inspection confirms `dpl_6MGnguqN7HkhPMpsyGYvA7bcf2hm`, production
target, the `officebites.co.za` aliases, payment branch and commit
`4b94fbe89e8b5a672e4f308701df61c1224580fd`. That commit exists locally. The earlier
unavailable-production-SHA blocker is superseded. `repair-deployment.json` and
`repair-source-comparison.json` record the new source basis and a complete comparison
of 181 deployed runtime/configuration paths. The release branch remains based on
`4c4835db62b7db4c7a725c92d7a6294ca523fa57`; it was not reset or rebased.

Production `gfzhdkitdyqftealgqfi` remains at **38 migrations**, ending
`20261010101910_production_audit_cleanup`. Fresh catalog queries found none of the
seven reported RPCs. This confirms missing backend foundations, not merely a stale
schema cache. Reloading PostgREST alone cannot create them. Checkout correctly
cannot issue instructions or enable ordering; the admin workspace cannot load its
missing RPC. Local changes do not repair the currently served hosted application.

Staging `eyhmarmekioovcjibcbr` remains at **54 migrations**, ending
`20261021100655_fix_admin_manual_settings_singleton`. At **11:53:51 UTC**:

| Method | Enabled | Ready | Maintenance |
|---|---|---|---|
| EFT | false | true | false |
| PayShap | false | true | false |
| PayFast | false | true | false |
| Ozow | false | false | true |

Staging has zero banking profiles, zero approved profiles and zero approved legal
versions; deadline 15 minutes and threshold R500. These are staging facts, not proof
of production flags. Production has no corresponding gateway-settings foundation.
No inference of disabled external provider accounts is made.

Fresh project identities, full histories, RPC catalogs and aggregate staging state
are recorded in `docs/release/repair-*.json`. No real bank destinations or customer
records were fetched. Previously captured production schema metadata is supplemented
with freshly read public/private function definitions. This is a sanitized catalog
reconstruction with synthetic records, not a restored production backup.

## Essential and excluded contracts

| Reported RPC | Launch treatment |
|---|---|
| `get_vendor_manual_methods(uuid)` | Essential; returns safe booleans only after server-owned payment, vendor, legal, compliance and accepted-fee prerequisites |
| `manual_payment_workspace(boolean)` | Essential for operational/admin payment review and checked-settings revision |
| `get_payment_gateways()` | Small safe compatibility read over required disabled settings; never sufficient checkout eligibility |
| `get_collection_options()` | Excluded; no collection installer or launch-screen call |
| `get_delivery_settings()` | Excluded; no new distance/quote/delivery settings workflow |
| `get_order_assistance_options()` | Excluded; no assisted-order creation or controls |
| `admin_delivery_origin_queue()` | Excluded; no new origin-approval workflow |

The launch uses the production core's ordinary typed fulfilment, server pricing,
availability/date and prior-day 19:00 SAST cutoff contract. It rejects quote IDs,
collection payloads, nonmanual methods and multiple vendors. It does **not** add or
activate Eduvos collection, R10/R15 delivery, booking, Ozow attempts, automatic splits
or corporate acquisition to silence missing RPC errors. Existing settlement/callback
paths remain distinguishable from disabled new provider initiation.

Exact argument names/types, return types, owners, SECURITY DEFINER status, search
paths, ACLs and function-definition digests are in
`docs/release/production-delta-rpc-manifest.json`, from the final native catalog.
`checks/integrated-release-rpc-preflight.sql` is SELECT-only and classifies required
versus excluded contracts. Authenticated role membership is not proof of admin:
admin/settings/compliance RPCs additionally check the active database account.

Key public signatures include:

```text
get_vendor_manual_methods(p_vendor_id uuid) -> jsonb                 anon/authenticated
manual_payment_workspace(p_test_only boolean default false) -> jsonb authenticated/service_role; scoped inside
admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text) -> void authenticated; active-admin + CAS
create_order_with_legal(p_order jsonb,p_legal jsonb) -> jsonb          anon/authenticated
create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid) -> jsonb anon/authenticated; deferred legal gate
get_manual_payment(p_order_id uuid,p_token uuid default null) -> jsonb anon/authenticated; ownership/capability
report_manual_payment(p_order_id uuid,p_token uuid default null) -> void anon/authenticated; never marks paid
verify_manual_payment(uuid,numeric,text,boolean default false) -> text authenticated; assigned operator/receipt checks
```

Private core creators and renamed bypass helpers are not browser executable. New
private evidence/financial tables have RLS and narrow/no direct browser grants;
service-role direct access to the manual tables is also revoked by the launch guard.
The complete manifest is authoritative for the remaining legal/compliance signatures.

## Local repairs

* Missing-function errors preserve machine-readable codes but display safe retry/
  support guidance. There is no fallback write or successful-empty-response shim.
* Checkout requires enabled, ready legal review and an explicit unchecked-to-checked
  acknowledgement, independently of payment availability. The Place order button
  remains disabled when any prerequisite is absent. Unavailable checkout offers a
  keyboard-accessible recheck, support link and saved-cart/menu recovery.
* Admin controls cannot save until their workspace loads. Existing CAS, reload,
  offline, duplicate request and account-switch protections are retained.
* Privacy navigation remains **Privacy**. The legacy application acknowledgement
  also now says Privacy; the POPIA disclosures and consent evidence were retained.
* Already deployed one-vendor cart handling, multi-vendor saved-cart guidance,
  dialog semantics, paid/status-review badges and persistent-image fixes were
  preserved from verified commit 4b94fbe. New delivery/geolocation workflows and
  assisted-order imports were not carried across with them.
* The minimum legal store has no invented company/tax defaults or approved text.
  It reuses `legal_versions`, `vendor_legal_acceptances`, assigned schedules and
  Phase E order receipts. No second acceptance system, draft publication or automatic
  acceptance/enrollment/approval was introduced.
* Pending owners can submit private compliance and versioned banking evidence;
  independent admin review, expiration/revocation and activation stay separate.
* New manual orders retain the accepted vendor receipt and immutable fee snapshot:
  15% platform + 2% transaction-related rate, combined 17%, marketing disabled,
  schedule version/hash and unresolved VAT treatment. The paid transition uses that
  issued-order rate; later vendor rate edits cannot reprice it. New manual eligibility
  closes when the current launch rate differs from 17%. Existing negotiated vendor
  records are not rewritten. Historical nonmanual behavior is preserved.
* “I've paid” changes a report state only. Receipt amount/reference, independent
  operator, risk/deadline handling, uniqueness, audit and receivable evidence remain
  server-owned. Deferred guards reject the old admin-paid bypass and evidence expiry
  before commit. Refund status records verified bank activity; no automatic transfer,
  refund, invoice or instant settlement is claimed.

## Exact production migration sequence

All paths below are under `release/production-candidates/`. The SHA-256 values and
dependency edges are in `docs/release/production-migration-manifest.json`.

| Order | Candidate | Executor and dependency |
|---|---|---|
| 1 | `20261027093453_production_launch_browser_grants.sql` | Non-superuser application postgres; exact captured production 38-row ledger, security hashes, owners/RLS; revoke browser TRUNCATE/TRIGGER/REFERENCES and direct profile/vendor INSERT |
| 2 | `20261027112327_production_minimum_manual_legal_foundation.sql` | Postgres; recorded step 1/history 39; minimum core wrapper, disabled flags, existing legal store, immutable banking/instructions, receipts/receivables/refunds/cancellation |
| 3 | `20261027112437_production_checked_settings.sql` | Postgres; recorded step 2/history 40; corrected singleton, B–E, activation/receipt guards, immutable accepted-fee snapshot, revision/CAS; no managed Storage DDL |
| 4 | `20261027115843_production_compliance_storage_owner_policies.sql` | Separately approved managed `supabase_storage_admin` owner execution after step 3/history 41; private bucket and six restrictive/scoped policies |

Expected ledger path: **38 -> 39 -> 40 -> 41 -> 42**. One transaction per file.
Record each new migration through the authorized runner after success; never invent
old history rows. The guarded sequence was tested with ledger recording between
steps. No blanket `db push` is proposed. The standalone
`20261027094852_production_manual_legal_transition_guards.sql` is a source input to
step 3 and **must not be installed again**. Original source candidates and reference
fixtures are not extra installation steps. CLI-generated new filenames were moved
out of automatic discovery into this explicit review package.

Fresh production metadata shows `storage.objects`/`storage.buckets` owned by
`supabase_storage_admin`; ordinary postgres is not a member. Storage's schema is
owned by `supabase_admin`, with managed-owner CREATE/USAGE grants. Standard native
PostgreSQL correctly rejects application execution of the managed-owner step. The
managed Supabase runner/privileged tooling path remains unverified: ask the platform
owner/Support which supported executor can apply it. Do not grant postgres managed
role membership, transfer hosted ownership or weaken the guard to make it pass.
Step 3 grants the managed owner only private-schema USAGE and execution of the
existing scoped Storage-policy predicate, not private-table access or app admin
rights. These explicit new object grants require Security/DBA review.

The compliance bucket is created only in step 4; all legal/payment rollout remains
closed across partial installation. Do not expose onboarding or run UAT until all
four steps, exact policies and effective API permissions are verified.

## Staging compatibility and Preview

Production and staging ledgers are different; the four-file production package must
fail on staging. Staging already has recovery/delivery, legal/commercial and manual
foundations. Its singleton version is `20261021100655`; the source equivalent is
`20261021094956`. Production financial migrations also have different historical
IDs from local source equivalents and are deliberately not replayed.

A staging delta needs its own definition/owner/ACL preflight: existing corrected
singleton -> B -> C -> D application objects -> E -> launch/fee guards -> checked
settings -> managed-owner Storage policies. Use existing foundations rather than
recreating them. The archived B–E inputs identify exact dependencies, but the
**current 54-history staging schema has not received or natively rehearsed that
separate delta**. This is an explicit remaining engineering prerequisite for hosted
staging UAT, not a claim that the production installer applies there.

`checks/build-protected-staging.mjs` built the final app locally with the public URL
and publishable key independently retrieved for staging. It rejects production,
unknown hosts and a mismatched key fingerprint, then inspects compiled JavaScript.
`docs/release/protected-staging-build.json` records staging as the sole compiled
Supabase host and includes asset digests. Only process environment was used: no
production credentials or .env file were copied, and no key value is in this report.
There is no deployed Preview from this task and no claim that existing Vercel
Preview environment variables/protection are correct. A build succeeding does not
verify Auth, PostgREST, notification isolation or actual hosted checkout.

## Validation and limits

| Check | Result |
|---|---|
| Native PostgreSQL 17.10, final four-file package | **119 assertions passed** in a new identity-verified loopback database; real non-superuser postgres/BYPASSRLS, separate managed Storage owner, application rejection of owner step and six installed policies |
| Security/financial native scenarios | Signup escalation denied; privileged vendor INSERT/update denied; cross-vendor access denied; pending banking/self-review; independent approval; scoped assigned acceptance; guest/member EFT/PayShap; stale documents; reporting remains unpaid; old paid bypass denied; receipt uniqueness; 17% snapshot despite later rate edit; expiry before COMMIT rolls back; cancellation/report protection; immutable receipts/audit; duplicate refund/commission-credit evidence |
| Real concurrent native sessions | Same checkout request creates one order/evidence set; duplicate receipt creates one paid event/receivable; two settings writers yield one success and one `40001` stale-revision failure |
| Existing vendor/order compatibility | Synthetic retained vendor, order, suborder and item values survive installation; no silent enrollment; historical PayFast receipt reconciliation remains functional without new initiation |
| Browser full integration run | **69 passed**, including admin save/failure/reload/stale/account switch, legal review, compliance, vendor acceptance, banking and mobile/keyboard flows |
| Browser after preserving live cart/UI fixes | **34 passed**, covering checkout/payment/legal groups plus the new saved multi-vendor cart regression; 70 distinct cases across runs, not a single 70-case run |
| Availability error unit cases | **9 assertions passed** |
| Public configuration self-test | **6 assertions passed** |
| Final staging-target build | Passed; one verified staging hostname, PWA build complete; no deployment |
| Final lint / standard `git diff --check` | Passed; nine existing React/context warnings, zero lint errors; CRLF conversion notices are not failed checks |
| Original worktree preservation | All 93 original input hashes still match; original payment worktree is clean, legal worktree retained; no original source writes |

Native fixtures use sanitized captured application metadata and synthetic records.
Managed Auth, Storage object transport, JWT verification, PostgREST/schema cache,
Realtime and external providers/workers are not installed there. Role-switch tests
use trusted test claims, not real hosted tokens. This is substantially broader than
PGlite but is not a managed Supabase end-to-end certification or a backup restore.
The final fixture uses a separate bootstrap administrator; it does not give the
application owner superuser, managed-owner membership or server-settings access.

Initial environment/harness failures were corrected: missing portable Node PATH;
CRLF false positives from an artificial `core.autocrlf=false` diff check; native
bootstrap-superuser immutability and restricted settings inspection; role/schema
fixtures missing the freshly verified managed/browser privileges. Earlier partial
superuser native results are superseded by the final ownership-accurate run.
No authorization check was bypassed in application/migration code to obtain a pass.

Still unverified: real JWT/Auth-hook/guest-capability API transport, all bank-revocation/
owner-transfer/assignment/publication/receipt-versus-cancellation race interleavings,
managed Storage bytes/malware/retention behavior, actual screen readers and real
iOS/Android devices. The earlier environment-dependent live fetch failure is not
claimed resolved; a correctly targeted build and mocked browser tests do not
reproduce that hosted network incident.

## Preflight, release order and containment

1. DBA/release owner reviews the exact SQL/hash manifest, source comparison and
   supported application/managed-owner execution paths. Refresh project identity,
   complete ledger, required columns/functions, ownership, RLS/grants/defaults and
   existing-data aggregate contracts using the two SELECT-only preflight files.
   Any drift, unsupported owner, unexpected enabled state or partial application stops.
2. Obtain effective PostgREST exposed schemas, role/hook/pre-config precedence and
   reload evidence; Auth hooks/fallbacks and service-role consumer inventory. Catalog
   settings and physical function existence alone do not prove managed API behavior.
   Platform owner/Support supplies runtime evidence unavailable in Dashboard.
3. Before any synthetic hosted operation, notification/worker/provider owners attest
   sinks/blocks, queues, retries/forwarding, email/SMS/push and Vercel/Edge routes.
   Recovery owner supplies usable backup/PITR, accepted RPO/RTO, disposable restore
   evidence and separate Storage-byte/Auth/config/Edge recovery. Accept a named
   maintenance window and old-client impact. No such attestation was fabricated here.
4. Prepare/rehearse staging's own delta, then separately approve its installation,
   protected staging-only Preview and no-funds UAT. Verify the served bundle's target
   before auth/order tests. Use approved synthetic identities/documents/bank fixtures
   and non-delivery channels; never real banking or production credentials.
5. After UAT and independent approval, re-preflight production and install only the
   exact four-step candidate in the approved window. Reconcile each commit/history
   result before continuing. Verify policy/function/grant digests, unchanged existing
   records and closed flags. Reload/check API exposure only through the supported,
   separately approved procedure. Do not deploy a dependent frontend first.
6. Separately approve production frontend release while ordering stays closed; check
   bundle host, missing/unready states, guest recovery and historical reconciliation.
   Later, legal owners approve exact public/vendor versions and real schedules;
   independent admins verify identity/food/premises/CoA applicability/operations/bank,
   signer acceptance and each explicit legacy transition. Publication, assent rollout,
   vendor activation and EFT/PayShap activation each need separate authorization.
7. Accounting must approve VAT/invoice treatment, fee base/rounding and commission
   collection/refund SOPs. Fulfilment/service-area availability and support capacity
   must be operationally approved: typed locations are not automated delivery quotes.
   PayFast/Ozow, marketing, splits and excluded booking/delivery stay off.

On a failed migration transaction, stop and retain evidence; do not edit old IDs or
remove guards. After commit, use separately approved forward containment of new
initiation/rollout, preserve historical payment instructions, evidence, audit,
receivables and legitimate callbacks. Do not drop acceptance/financial tables,
retroactively reprice existing orders or reopen unsafe old checkout as a rollback.
If the managed owner step fails, keep the release closed and investigate; do not
replace it with broad Storage policies. Whole-database restore after real activity
requires a tested, separately approved reconciliation/recovery decision.

## Remaining blockers and decisions

| Priority / owner | Required evidence or safe resolution | Decision dependency |
|---|---|---|
| P0 DBA + Supabase platform/Support | Supported managed-owner execution and ledger path; exact four-file review; staging-specific 54-history compatibility delta/rehearsal | Any hosted installation/UAT |
| P0 Platform/Auth owners | Effective managed PostgREST/Auth/Storage/Realtime/privileged-consumer evidence, actual API grants/cache behavior | Hosted UAT |
| P0 Notification and recovery owners | Signed channel isolation, backup/restore/RPO/RTO and maintenance acceptance | Hosted synthetic operations and installation approval |
| P0 Legal/privacy/company owner | Complete approved six public documents, vendor Agreement/Standards, verified disclosures/notices, vendor-specific fee schedules and final hashes | Publication/assent and real vendors |
| P0 Vendor + independent compliance admin | Real identity, bank receiving capabilities, applicable food/premises/CoA, operations, signer authority, expiry/revocation and explicit transition | Vendor activation |
| P0 Accounting/operations | VAT/invoices/rounding, vendor-direct commission collection, bank receipt/refund/cancellation SOPs, historic pending-order reconciliation and fulfilment scope | Real-money launch |
| P1 Test/accessibility owner | Managed API/JWT/browser UAT, remaining race matrix, real-device/screen-reader review and incident reproduction | Release sign-off |

**GO:** local code/SQL review and staging-target build preparation.
**NO-GO:** protected staging authenticated/order UAT today; hosted migration execution;
publication/assent rollout; vendor/payment activation; production deployment or
real-money launch. The shortest next action is DBA/platform review of the hashed
four-file package and the managed-owner/staging compatibility requirements, followed
by the operator evidence above. This report authorizes none of those hosted actions.

## File manifest

All integration files and SHA-256 values are listed in
`docs/release/repair-file-manifest.json`; migration order/hashes in
`production-migration-manifest.json`; final SQL/RPC ACLs in
`production-delta-rpc-manifest.json`. Older manifests are historical evidence.

Application paths changed in this repair:

```text
src/pages/customer/Checkout.jsx
src/components/features/ManualPaymentWorkspace.jsx
src/components/features/VendorConsent.jsx
src/services/manualPaymentService.js
src/services/commercialService.js
src/utils/releaseAvailability.js
src/components/features/CartDrawer.jsx
src/context/CartContext.jsx
src/components/ui/Modal.jsx
src/components/ui/StatusBadge.jsx
src/components/features/MealFormModal.jsx
src/components/forms/FileUpload.jsx
src/components/ui/Avatar.jsx
```

New verification/composition tools: `checks/prepare-production-foundation.mjs`,
`prepare-production-legal-delta.mjs`, `native-production-release.mjs`,
`native-release-scenarios.mjs`, `build-protected-staging.mjs`,
`release-availability.test.mjs`, `release-artifact-manifest.mjs`, and
`integrated-release-rpc-preflight.sql`. Updated test inputs:
`checks/browser-harness.jsx`, `manual-payments-browser.spec.mjs`,
`legal-readiness-browser.spec.mjs`, `launch-scope-browser.spec.mjs`.
New SQL files are steps 2–4 above; step 1 and the standalone source guard are
preserved. Fresh `docs/release/repair-*` evidence, native/RPC/build manifests, this
report and the candidate README are local artifacts. Earlier reports have prominent
supersession notices. No original payment/legal worktree file was changed.
