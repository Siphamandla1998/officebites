# OfficeBites staging release review — 20 October 2026

**Decision: prepared locally; hosted release and native staging tests await approval. Not launch-ready.**

This report supersedes the earlier handoff where defaults or test counts differ. It authorises no production action, real payment, real banking-data entry, legal publication, provider reactivation, secret change, historical-record deletion or unrelated Git change.

## Verified environment and release identity

| Item | Evidence |
| --- | --- |
| Working branch / starting HEAD | `feat/vendor-direct-launch-payments` / `b7c2d3b4b0b530a2710b5de97e912f59f8d53c60`; implementation remains uncommitted; branch has no remote deployment |
| Preserved unrelated edit | `OFFICEBITES-PREVIEW-RELEASE-20261016.md`, SHA-256 `bff59a97f6217077e2106ad3c60c867d7193781359970b295246e9305432e5bb`; excluded from the release source |
| Supabase | Connected project listing confirms **`officebites-staging`**, **`eyhmarmekioovcjibcbr`**, active, PostgreSQL 17.6 |
| Staging schema | Latest migration `20261016103515_repair_order_policy_helper_access`; manual migration absent; **22/22 read-only dependency checks passed** |
| Staging providers | PayFast currently enabled/ready, maintenance off. Ozow disabled/unready. These settings were read, not modified |
| Staging delivery | Enforcement disabled; 0.5 km free / 5 km max / R15 outer fee; unchanged |
| Historical record counts | 15 orders, 4 PayFast ITN records, 0 Ozow receipts at preflight; no row contents or bank data exported |
| Vercel | Project `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71` (`officebites`), team `team_kKRzCLk1pNHoIA4sV1M0ciSg` |
| Preview configuration | Inherited Preview `VITE_SUPABASE_URL` exactly matches staging; Preview frontend key has publishable-key format; no branch override found. Values/secrets were not printed or changed; active-key validation remains a hosted smoke check |
| Existing Preview | `dpl_ZGxYvQjxdGY74s7Lhx1J1RVEQEvz`, READY, target `null` (Preview), branch `feat/legal-vendor-corporate-acquisition`, source `9b1623680afe6530c7282ed2be6754cd4947d373`; it does **not** contain this candidate |

No production database was accessed. Vercel metadata inspection did not deploy, promote or change an alias. The local `.env.staging.local` points to the same staging host; it is excluded from the prepared source.

## Findings fixed before proposing migration

1. A completed/declined refund could be moved back to processing. Added explicit refund transitions; a new request is required after a terminal event, while an exact retry remains idempotent.
2. Unconfirmed/late refund evidence could accept sub-cent values that rounded to zero. Amounts and product allocations now require valid whole cents even without a receivable.
3. Resolving a dispute could allow preparation after a full refund. Fulfilment now independently checks full refund totals; clearing a dispute does not remove that financial hold. Full-refund cancellation remains an audited admin action.
4. Creation now locks the selected availability row and checks the method against the exact approved profile being snapshotted, reducing profile/configuration-change races. Dispute and reconciliation mutations follow parent-order-first locking.
5. Installation now leaves **all four payment methods disabled**. Technical `ready` on a manual method is not vendor eligibility or live authorisation.
6. Ordinary queues correctly excluded test orders but provided no way to verify them through the new operator screens. Added an explicit, ownership-scoped synthetic-only view. Normal statements remain test-free; test CSVs have a separate filename and data-scope column. Failed refreshes block statement exports.

Tests reproduced the refund-transition failure before the SQL fix. The new tests then passed. The original migration filename is retained because it has never been applied; its reviewed content has changed and must be approved by hash below.

## Migration review

- **Banking / RLS:** all seven new tables are in `private`, RLS enabled, with no direct `PUBLIC`, `anon` or `authenticated` table privileges. Narrow RPCs enforce active stored identities, vendor ownership/admin checks and fixed search paths. No public bank catalogue or bank data in generic order JSON. Customers require a random order capability or the authenticated owner session.
- **Approval / snapshots:** vendor submissions create new versions, approval requires an independent admin and evidence, pending edits leave approved records in use, approved profiles and assigned destinations cannot be rewritten. Compatibility flags on the selected version are checked.
- **Verification / money:** customer reporting remains unpaid. Only assigned vendor/admin identities verify receipt. Order-row locks, idempotent state handling, a unique verified vendor bank reference and one receivable per order prevent duplicate accrual. High-value/mismatch/suspicion/expiry/cancellation remain review cases. Existing commission snapshots and product-only calculation are reused; no extra 17%, marketing fee or VAT is added.
- **Refunds / disputes:** separate append-only evidence and credits preserve paid history. Refund limits/product-versus-delivery allocations and full-refund fulfilment hold are checked. No API moves bank funds. Late/unconfirmed refunds do not create fictitious paid orders or commissions.
- **Historical compatibility:** no order/receipt backfill, drop, truncate or reset. Existing provider callback/signing code remains unchanged. A synthetic pre-existing PayFast order still reconciles in isolated tests after the new initiation block. The gateway financial view excludes only orders assigned new manual instructions.
- **Breaking checkout boundary:** the old creation core is kept privately; stale clients must refresh instead of creating gateway orders. Coordinate the Preview/schema rollout. Existing tracking and historical reconciliation remain available.
- **Dependencies:** read-only preflight checked 11 required function signatures, financial view, constraints, cancellation insertion marker, transition-trigger scope, commission/order columns, revoked legacy proof upload and unchanged delivery/Ozow states. Historical migration timestamps differ between repository and staging: apply the single reviewed migration, **never blanket `db push`**.

Supabase advisor baseline has 24 informational private-RLS/no-policy findings, 7 anonymous and 40 authenticated SECURITY DEFINER warnings, and one leaked-password-protection warning. The private deny-by-default tables and intentional guest/admin RPCs require explicit review rather than permissive policies. Password protection is an existing Auth configuration concern to resolve separately before an operational launch; no Auth setting was changed. See [private RLS guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [anonymous RPC guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated RPC guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Advisors must be rerun after installation; the current findings do not inspect the uninstalled migration.

## Validation evidence

| Check | Result / limit |
| --- | --- |
| `checks/verify-local.mjs` | Passed, including **109 manual SQL assertions**, existing account/payment/ledger/delivery/legal/CORS tests, and four-timezone regressions; isolated data only |
| Complete local browser regression | **43 passed**; hosted-data test explicitly excluded, Supabase calls blocked |
| Final manual browser suite | **6 passed**, including synthetic-view/CSV-scope and failed-refresh regression; frontend services mocked |
| Lint | Passed with existing provider/export/hook warnings; no errors |
| Staging-mode build | Passed; manifest and service worker generated locally |
| Read-only hosted preflight | **22 passed**; no settings/data writes |
| Forward stop | Executed in isolated database; all methods disabled, historical order snapshots unchanged, existing protected instructions readable, new checkout rejected |

Logs, the read-only schema checkpoint, preflight results and candidate manifest are in `.officebites-local/staging-release-20261020/` (Git-ignored). PGlite is not native concurrency, actual Supabase Auth/PostgREST, webhook processing, banking or installed-device evidence. **No complete hosted staging order flow has run.**

## Current UAT security prerequisite assessment — 21 October 2026

The migration/Preview preparation below is historical. The latest [operator prerequisite report](vendor-direct-uat-prerequisites-20261021.md) and [operator checklist](vendor-direct-uat-operator-checklist.md) govern current UAT security readiness. Local implementation/security/recovery and Auth/SMTP baseline/source review are complete. Fresh staging reads confirm all four methods disabled, UAT security absent, six Edge Functions inventoried and no native cron/network extensions. **NO-GO for hosted security installation** until effective PostgREST service/pre-config attestation and remaining outside-hook notification inventory are complete. No hosted settings were changed or completed regression suites repeated during this assessment.

## Approved execution follow-up

The subsequently approved staging migration and conditional Preview deployment were executed on 20 October 2026. See [the execution handoff](vendor-direct-staging-release-results-20261020.md) for actual results, the READY Preview URL, all-disabled payment status, and an unexpected alias-metadata discrepancy that stopped further hosted operations. The approval-request text below is retained as the original preparation record; it is superseded for operations A/B by that execution handoff. Synthetic testing and activation remain separately gated.

## Readiness categories

| Category | Current status / next action |
| --- | --- |
| Implemented and verified locally | Guest/method/instruction UI; profiles, role isolation, snapshots, customer reporting, vendor receipt checks, fulfilment, expiry/cancellation/refund/dispute guards, commission/reconciliation, test exclusion, CSV and provider blocks as above |
| Implemented but not yet tested in staging | All new RPCs and new UI-to-Supabase persistence, real synthetic logins, native concurrent create/verify/cancel/refund, schema-cache exposure, delivery/PWA device behaviour and historical callback execution after installation |
| Blocked by hosted-change approval | Applying the migration, creating a Preview, and persistent synthetic accounts/orders/configuration. Current permission ends at this preparation/review step |
| Manual configuration | Review checkpoint/stop procedure; provision designated synthetic login identities through approved Auth tools without sending email; classify test orders before confirming payment; enable manual methods only in the explicitly approved synthetic test window; close them afterwards |
| Vendor onboarding | Only fake receiving details in staging. A real pilot later requires independent seller/account ownership and PayShap capability checks and authorised verifier identities; none are claimed here |
| Legal / commercial review | Unpublished draft remains unpublished. Seller/refund/support disclosures, commission eligibility, delivery receipts, invoicing/VAT, privacy retention and bank permissions require human sign-off. Provider permission is not inferred from credentials or public terms |

## Concrete release candidate and approval boundary

Prepared 178 build-source files plus two hashed local deployment metadata files (180 total) with no `.env`, credentials, database exports, test harness or unrelated release-note edit. Fixed local project metadata names the Vercel team/project above. No Git push or production-branch operation is needed: a direct **Preview** upload can use this isolated source tree and inherited Preview environment.

- Source tree: `.officebites-local/staging-release-20261020/candidate-14eb80a3bb41/`.
- Source SHA-256 manifest fingerprint: `14eb80a3bb41afe662801faaa9197c447f7749e7287c20223c40f35f9e2bd248`.
- Migration: `supabase/migrations/20261020090841_vendor_direct_manual_payments.sql`.
- Migration SHA-256: `b5e3ebbea124fa394c2fd71dba82c24963cb7a02bfeaa0f09b856f833f6e1af3`.
- Schema checkpoint SHA-256: `1a96354ef5321bdf8b9811473a188926f3533f585aa11a03f51face6f66031a7`.

**Approval request, operations A and B only:**

**A.** Reverify project/ref, current checkpoint/dependencies and candidate hash, then apply exactly this one migration with `project_id=eyhmarmekioovcjibcbr`. It atomically sets PayFast/Ozow disabled with maintenance on, inserts manual EFT/PayShap disabled/ready with maintenance off, and installs the reviewed schema/guards. Recheck preserved historical rows/definitions, RLS/grants and advisors; verify all methods remain disabled. No secrets, delivery settings, legal publications or real-bank details are touched.

**B.** Only after A passes, upload the prepared source as a **Vercel Preview** to the exact team/project above, using inherited Preview variables that target staging. Do not supply a production target, promote, move a production alias or push a Git branch. Verify the deployed bundle/backend host and that checkout is unavailable until synthetic testing is explicitly enabled. Preserve old provider callbacks and CORS; this release requires no new Edge deployment or CORS relaxation.

**C remains separately gated:** a complete hosted synthetic test window needs test-account/data provisioning and temporarily enabled manual methods. Before that operation, record the designated synthetic identities/vendors and require that all approved manual profiles belong only to those synthetic fixtures. No existing seller receives fake recipient details. Bank confirmations/refunds are simulated evidence, never transfers. Readiness is not granted by approving A/B.

## Hosted synthetic acceptance plan (not executed)

After approval/provisioning, test guest and member EFT/PayShap through actual Auth/PostgREST and the new Preview; submit profiles as synthetic vendors and approve independently as synthetic admins. Check missing/unapproved/unsupported profiles, exact recipient snapshots, changed-profile isolation, reference/price/quantity enforcement and duplicate submission. Mark synthetic orders as test before payment confirmation, and use the explicit test view for operator actions.

Validate reporting versus confirmation, wrong-vendor/anonymous/suspended access, high-value review, duplicate bank references and one commission entry. Advance a confirmed order through acceptance/preparation/ready/collection or delivery/completion. Cover expiry, unpaid cancellation, reported-payment cancellation refusal, under/overpayment, late receipt/refund, dispute holds, full refunds and admin cancellation, partial credits and commission collections/returns. Verify normal reports remain test-free and test CSVs are labelled. Use independent native connections for concurrent operations. Check PayFast/Ozow preparation rejection and rollback-only historical callback fixtures; never fabricate a provider payment against an existing operational order.

Delivery enforcement remains off: do not activate the unfinished radius gate just to obtain a pass. Test preserved quotation code in isolated/rollback fixtures and distinguish that from actual operational radius enforcement. Device GPS, installed PWA/offline/update and banking-app-return testing remain separate operational checks; no real transfer is authorised in this staging exercise.

## Recoverable rollback / stop strategy

The captured checkpoint contains seven affected public function definitions/ACLs, the financial view, original constraints and gateway settings, timestamped from the verified staging project. It contains no customer rows, bank records or secrets. **It is a schema/configuration recovery checkpoint, not a full database backup or tested provider restore.** Automated-backup/PITR availability was not independently verifiable with the connected tools. A provider-managed backup/restore attestation remains required before any destructive or data-rewriting follow-up; neither is proposed here.

Before commit, the migration's transaction rolls back on failure. After a successful install, prefer the verified **forward stop**: apply `checks/manual-payments-staging-stop.sql` only with explicit staging project selection and approval. It disables all four methods and adds an audit event without deleting history or changing risk/delivery policy. Keep the Preview in checkout-unavailable mode; retain reconciliation and existing protected instructions. Already known bank details cannot revoke a bank transfer, so existing transfers still require vendor/support reconciliation.

Do not restore the old enabled PayFast flag, blindly reverse schema, drop manual tables, reset staging, or deploy the old gateway-enabled UI as rollback. A schema restoration after manual orders exist requires a separately reviewed forward migration preserving all obligations. Refresh the checkpoint immediately before A and stop if drift is found.
