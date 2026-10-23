# Vendor-direct staging release execution — 20 October 2026

## Outcome and boundary

The approved staging migration succeeded. The approved artifact was deployed as a READY Vercel Preview. All four payment methods remain disabled. No synthetic accounts/orders, banking details, payment transfers, activation or hosted checkout tests were created or performed. Launch readiness is **not** granted.

An unexpected production-alias metadata discrepancy was detected during final verification. Hosted operations stopped; no automatic repair or rollback was attempted. The production alias still points to its original deployment. See the finding below before further hosted work.

## Migration evidence

- Verified staging: `officebites-staging`, `eyhmarmekioovcjibcbr`, ACTIVE_HEALTHY, PostgreSQL 17.6.
- Exact local SQL: `supabase/migrations/20261020090841_vendor_direct_manual_payments.sql`.
- SHA-256: `b5e3ebbea124fa394c2fd71dba82c24963cb7a02bfeaa0f09b856f833f6e1af3`.
- Hosted migration version: `20261020100740_vendor_direct_manual_payments`. The hosted timestamp differs from the local filename; SQL identity was checked before application. Do not reapply the local migration blindly through CLI migration push.
- All 22 read-only preflight checks passed immediately before application. Dependencies through `20261016103515` were present. Fresh schema/configuration capture matched the reviewed recovery checkpoint, excluding capture timestamp and row ordering.
- Recovery checkpoint SHA-256: `1a96354ef5321bdf8b9811473a188926f3533f585aa11a03f51face6f66031a7`. This captures affected schema/configuration, not a full database backup or independently verified PITR restore.
- All 43 post-application checks passed: seven private tables with RLS and no browser-role CRUD, intended checked SECURITY DEFINER RPC grants with fixed empty search paths and no PUBLIC execution, payment-state/method constraints, recipient snapshot and fulfilment guards, commission uniqueness, provider initiation guards, and preserved service-role historical PayFast callback access. Legacy proof upload remains revoked.
- Existing-record counts and full ordered-row fingerprints matched before/after for all nine checked tables: orders 15, order_items 15, order_suborders 15, profiles 4, vendors 8, payfast_itn_log 4; private payment_attempts, ozow_attempts and ozow_receipts each 0. No historical payment rows were deleted or rewritten.
- Newly installed manual payment profile/order/receivable/refund tables were empty. Delivery enforcement remains disabled with its existing settings.

Read-only settings RPC returned HTTP 200 using the approved staging publishable key:

| Method | Enabled | Ready | Maintenance |
| --- | --- | --- | --- |
| Manual EFT | false | true | false |
| Manual PayShap | false | true | false |
| PayFast | false | true | true |
| Ozow | false | false | true |

Existing provider Edge Functions remain ACTIVE and were not redeployed. Database gates prevent new provider attempts while historical reconciliation remains installed. Historical callbacks were inspected, not executed against operational orders.

Security advisor results were consistent with the reviewed architecture: 31 INFO RLS-without-policy entries for private deny-by-default tables, 10 anonymous and 53 authenticated SECURITY DEFINER execution warnings covering deliberately exposed checked RPCs, and one pre-existing leaked-password-protection warning. Catalog checks establish grants/guards; they do not substitute for authenticated adversarial UAT. No unexplained migration security ERROR was returned.

## Preview and isolation evidence

- URL: https://officebites-dd7kth3is-sp24tg-6983s-projects.vercel.app
- Deployment: `dpl_Ftm1F2a6Ja9vT24eKtpRVaK4HVr6`, state READY, target `null` (Preview).
- Vercel project: `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71`; team: `team_kKRzCLk1pNHoIA4sV1M0ciSg`.
- Uploaded 178 approved build-source files directly; no Git push, production target, promotion, environment update, project-settings override or Edge deployment. No environment files or recovery exports were uploaded.
- Approved source fingerprint: `14eb80a3bb41afe662801faaa9197c447f7749e7287c20223c40f35f9e2bd248`; all 180 manifest entries were revalidated before release (178 source plus two local deployment metadata files).
- Existing Preview environment contained the two relevant Vite Supabase variables. URL exactly matched `https://eyhmarmekioovcjibcbr.supabase.co`; the publishable key matched local staging configuration. Values were compared without printing secrets.
- Served HTML returned HTTP 200. Served `assets/supabaseClient-DFG6VVXv.js` returned HTTP 200, contained the exact approved staging URL and publishable key, and contained only that Supabase host. Production ref `gfzhdkitdyqftealgqfi` was absent.
- All payment function endpoints derive from the same staging client: `https://eyhmarmekioovcjibcbr.supabase.co/functions/v1/<function>`. No initiation endpoint was invoked. Historical provider process URL constants remain inert and were intentionally preserved.
- Vercel build completed successfully, including PWA generation. Fetching static assets does not execute checkout, Auth or order writes.

## Unexpected finding — production alias metadata

Read-only alias inspection before and after Preview access showed `officebites.co.za` still assigned to `dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt`, with the same project and no redirect. However, `updatedAt` changed from `1791629364439` to `1792492251782`, and `protectionBypass` entry count changed from one to zero. The prior entry was an already expired shareable link (expiry 10 October 2026).

No alias mutation, production deployment, production environment update or production HTTP fetch was requested. The authenticated Vercel Preview fetch tool creates/reuses temporary access links; the timing is consistent with metadata cleanup but the cause is **unconfirmed**. Production deployment routing is unchanged, but unchanged production alias metadata cannot be claimed. Hosted operations stopped when the discrepancy was detected. An operator should inspect Vercel audit history/tool behavior before any further hosted work; do not recreate expired links or alter protection automatically.

## Evidence locations

Local, Git-ignored evidence is under `.officebites-local/staging-release-20261020/`: `execution-evidence.json`, `approved-preapply-schema.json`, `approved-preapply-record-fingerprints.json`, `postapply-schema-security-checks.json`, `postapply-record-fingerprints.json`, the reviewed checkpoint and release manifest. Execution evidence contains sanitized alias facts and bundle checks, not access-link tokens or publishable-key values. Existing unrelated uncommitted release-note changes were preserved.

## Readiness and next manual UAT preparation

| Category | Status / required action |
| --- | --- |
| Implemented and verified | Reviewed local test evidence remains in the preparation report; hosted migration, catalog security/state checks, record preservation, settings read, Preview build and compiled staging isolation now verified |
| Implemented, not staging-UAT tested | Guest/member checkout, PayShap/EFT instructions, profile submission/independent approval, recipient snapshots, report/confirm/fulfil/deliver lifecycle, expiry/cancel/refund/dispute paths, commission/reporting, concurrency, unauthorized access and provider rejection through actual user sessions |
| External approval | Further hosted test data/accounts, temporary manual-method activation and end-to-end testing require separate approval; current authority ends here |
| Manual configuration | First investigate alias discrepancy. Then approve a bounded synthetic test plan, designated test-only identities/vendors, independent approver roles, test order classification, fixture cleanup/retention and a closeout disabling both manual methods. Do not change provider secrets or enable provider gateways |
| Vendor onboarding | Synthetic receiving details only for explicitly designated fixtures in staging. Real onboarding later requires independent ownership/capability verification and operational training |
| Legal/commercial | Draft remains unpublished; seller/payment/refund/support disclosures, commission/invoicing/VAT, bank/privacy/retention terms and operational sign-off remain outstanding |

Use the full acceptance matrix in `docs/vendor-direct-staging-readiness-20261020.md` after separate authorization. No real transfers or customer banking details are needed. Do not treat READY deployment or schema checks as launch approval.

## Recovery / rollback procedure

No rollback was performed. All methods are already disabled, so no stop-script write is needed. Keep this state and preserve historical callback functions and records. If later activation must be stopped, obtain explicit staging approval for the reviewed forward-stop SQL, reverify the project ref, and disable all four methods without deleting history. Do not restore old enabled gateway flags, reset staging, drop manual tables or automatically deploy an older gateway-enabled frontend.

Retain the checkpoint and immutable release evidence. A destructive/schema reversal or provider restore requires a separate reviewed operation, independently confirmed backup/restore capability and preservation of any manual obligations. The production-alias metadata discrepancy requires investigation, not a blind rollback. No further hosted operations were performed after detection.
