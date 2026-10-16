# OfficeBites Preview release — 16 October 2026

Owner authorised committing the reviewed work and pushing only `feat/legal-vendor-corporate-acquisition` to trigger Vercel Preview. Starting HEAD `40974072a5899c96a2e422b175c3f214b9f56b01`. No main push/merge, production deployment, migration, charging activation or legal publication.

## Reviewed scope

Reviewed all modified tracked files, the new repair audit, and the empty starting index; no other nonignored untracked files were present. Existing changes in OFFICEBITES-PREVIEW-PAYMENT-VALIDATION-REPORT.md are included intact (starting SHA-256 D6649A49D732CB9840EC2032DA8CDE70108B1681B06884C9B0A9A74642B2AC75). Ignored environments, historical ZIPs, tools, build output and evidence are preserved and excluded from Git.

Changes cover gateway fail-closed behaviour, no-gateway checkout prevention, explicit Ozow unavailability, vendor payment versus fulfilment labels, customer policy-only navigation, protected vendor legal routes with applicant inline review, grouped admin controls/legal sections, unknown processor-fee display, dialog semantics and regression/visual checks. Detailed file inventory is generated from the reviewed Git candidate list before staging.

## Release validation

- Full `node checks/verify-local.mjs`: passed, including isolated SQL/payment/legal/delivery/security/service/date regressions.
- Full Edge `node checks/verify-browser.mjs`: **37 passed (2.3 minutes)**, including mobile/desktop captures. Synthetic tests block hosted writes; actual signed-out staging read test is separate.
- `vite build --mode staging`: passed; 122 PWA precache entries.
- Repository-wide oxlint: exit 0, no errors, nine existing warnings in unchanged hooks/contexts. Changed sources previously passed targeted lint.
- Frozen Deno check on all six discovered Edge entrypoints: passed. Two earlier command setup failures referenced nonexistent entrypoints; no function was changed or deployed.
- Git whitespace and scoped secret/path scans run before committing. No dependency changes, environment files, private data or credential values included.

## Environment and payment safety

Vercel project `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71`, team `team_kKRzCLk1pNHoIA4sV1M0ciSg`. Preview variable readback matches `https://eyhmarmekioovcjibcbr.supabase.co`; public publishable key matches an active staging key. No feature-branch override was found. Values are not recorded here. Production/development variables were not copied or edited. Local `.env.local` remains preserved; local builds explicitly use staging mode.

Staging gates: PayFast disabled, maintenance true, configuration-ready true; Ozow disabled/not ready. Delivery enforcement and readiness attestations false. Acquisition/standard-breakdown/onboarding flags false. Zero approved legal versions. No merchant secret was retrieved, no payment initiation/notification fabricated, and no existing order status was edited. Merchant sandbox/live credential mode and genuine payment/webhook processing remain unverified; disabled gateways make this a non-transacting inspection Preview.

Production baseline: officebites.co.za alias points to `dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt`; remote main remains `4c4835db62b7db4c7a725c92d7a6294ca523fa57`. The existing feature deployment is Preview; no production target is requested. Current previous-day 19:00 SAST cutoff is unchanged.

## Deployment and hosted verification

Pending the reviewed feature commit/push. Postdeployment results will be appended locally after verifying READY and exact pushed SHA, without a report-only push that would replace the deployment being described.

Authenticated real-account hosted journeys and actual merchant integration require designated sessions and verified sandbox access; they must not be represented as passed by synthetic role fixtures. The reported Preview Paid case still lacks its ticket code; current staging paid orders match stored receipts, which alone do not prove bank settlement.
