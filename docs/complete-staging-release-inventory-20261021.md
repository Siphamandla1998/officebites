# Complete staging release inventory — 21 October 2026

Initial branch: feat/vendor-direct-launch-payments; HEAD bb074addb7f9a348f72f6946dfdef32580044083. 54 modified/untracked files inventoried individually; no deleted files. Feature branch has no upstream and no remote head in read-only ls-remote; remote main is 4c4835db62b7db4c7a725c92d7a6294ca523fa57. No fetch/merge/push.

## Inclusion decisions

| Exact file | Disposition | Evidence / reason |
| --- | --- | --- |
| OFFICEBITES-PREVIEW-RELEASE-20261016.md | Exclude / preserve | Older active release notes; unrelated edits retained |
| checks/browser-harness.jsx | Include: admin safety | Reviewed local component, tests or design only |
| checks/checkout-browser.spec.mjs | Include: regression / applied-SQL provenance | Reviewed local regression or migration evidence; no hosted operation |
| checks/checkout-database.mjs | Include: regression / applied-SQL provenance | Stage manual-payment import only; retain two UAT imports unstaged |
| checks/checkout-repair.mjs | Include: regression / applied-SQL provenance | Reviewed local regression or migration evidence; no hosted operation |
| checks/recovery-browser.spec.mjs | Include: regression / applied-SQL provenance | Reviewed local regression or migration evidence; no hosted operation |
| playwright.config.mjs | Include: admin safety | Reviewed local component, tests or design only |
| src/components/features/CartDrawer.jsx | Include: verified deployed foundation | Matches retained Preview (normalised line endings) |
| src/components/features/CheckoutControls.jsx | Include: verified deployed foundation | Matches retained Preview (normalised line endings) |
| src/context/CartContext.jsx | Include: verified deployed foundation | Matches retained Preview (normalised line endings) |
| src/pages/admin/AdminPayments.jsx | Include: verified deployed foundation | Matches retained Preview (normalised line endings) |
| src/pages/customer/OrderTracking.jsx | Include: verified deployed foundation | Matches retained Preview (normalised line endings) |
| src/pages/vendor/VendorOrders.jsx | Include: verified deployed foundation | Matches retained Preview (normalised line endings) |
| src/pages/vendor/VendorRevenue.jsx | Include: verified deployed foundation | Matches retained Preview (normalised line endings) |
| src/pages/vendor/VendorSettings.jsx | Include: verified deployed foundation | Matches retained Preview (normalised line endings) |
| checks/admin-settings-browser.spec.mjs | Include: admin safety | Reviewed local component, tests or design only |
| checks/fixtures/manual-settings-baseline-20261021.json | Include: regression / applied-SQL provenance | Reviewed local regression or migration evidence; no hosted operation |
| checks/manual-payments-database.mjs | Include: regression / applied-SQL provenance | Reviewed local regression or migration evidence; no hosted operation |
| checks/manual-payments-staging-preflight.sql | Exclude / preserve | Manual operations tooling not needed in frontend artifact |
| checks/manual-payments-staging-stop.sql | Exclude / preserve | Manual operations tooling not needed in frontend artifact |
| checks/manual-settings-singleton.mjs | Include: regression / applied-SQL provenance | Reviewed local regression or migration evidence; no hosted operation |
| checks/prepare-manual-staging-release.mjs | Exclude / preserve | Manual operations tooling not needed in frontend artifact |
| checks/uat/checkpoint.example.json | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| checks/uat/fixtures/auth-baseline-20261021.json | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| checks/uat/fixtures/recovery-baseline.json | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| checks/uat/provision-core.mjs | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| checks/uat/provision-core.test.mjs | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| checks/uat/provision-staging.mjs | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| checks/uat/recovery-database.mjs | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| checks/uat/recovery.mjs | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| checks/uat/security-database.mjs | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| checks/uat/staging-security.sql | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| checks/uat/verify-recovery.mjs | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| docs/admin-payment-settings-safety-design-20261021.md | Include: admin safety | Reviewed local component, tests or design only |
| docs/admin-payment-settings-ui-review-20261021.md | Include: admin safety | Reviewed local component, tests or design only |
| docs/marketplace-architecture-design-20261021.md | Include: design documentation | Architecture proposal only; no Phase 2 code |
| docs/vendor-direct-launch-audit.md | Exclude / preserve | Historical launch/operations report; not needed for this reviewed frontend release |
| docs/vendor-direct-launch-handoff.md | Exclude / preserve | Historical launch/operations report; not needed for this reviewed frontend release |
| docs/vendor-direct-legal-review-DRAFT.md | Exclude / preserve | Unapproved legal draft |
| docs/vendor-direct-manual-settings-singleton-fix-20261021.md | Include: regression / applied-SQL provenance | Reviewed local regression or migration evidence; no hosted operation |
| docs/vendor-direct-manual-settings-staging-results-20261021.md | Include: regression / applied-SQL provenance | Reviewed local regression or migration evidence; no hosted operation |
| docs/vendor-direct-staging-readiness-20261020.md | Exclude / preserve | Historical launch/operations report; not needed for this reviewed frontend release |
| docs/vendor-direct-staging-release-results-20261020.md | Exclude / preserve | Historical launch/operations report; not needed for this reviewed frontend release |
| docs/vendor-direct-uat-OB-UAT-20261020.md | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| docs/vendor-direct-uat-blocker-resolution.md | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| docs/vendor-direct-uat-operator-checklist.md | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| docs/vendor-direct-uat-prerequisites-20261021.md | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| docs/vendor-direct-uat-recovery-validation.md | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| docs/vendor-direct-uat-security-local.md | Exclude / preserve | Security/provisioning installation remains blocked; separate scope |
| src/components/features/ManualPaymentStatus.jsx | Include: verified deployed foundation | Matches retained Preview (normalised line endings) |
| src/components/features/ManualPaymentWorkspace.jsx | Include: verified deployed foundation | Retained pre-safety source in prerequisite; safety replacement separately |
| src/components/features/ManualSettingsForm.jsx | Include: admin safety | Reviewed local component, tests or design only |
| supabase/migrations/20261020090841_vendor_direct_manual_payments.sql | Include: regression / applied-SQL provenance | Already reviewed staging SQL; never applied by this release |
| supabase/migrations/20261021094956_fix_admin_manual_settings_singleton.sql | Include: regression / applied-SQL provenance | Already reviewed staging SQL; never applied by this release |

Additional release-test files: checks/manual-profile-browser.spec.mjs, with synthetic-only browser submit/approval fixtures in checks/browser-harness.jsx and one playwright.config.mjs registration. This inventory/report is included as release documentation. No environment files, generated output, browser sessions or actual vendor/customer bank data enter Git. Clearly labelled synthetic fixtures are test code only, blocked from hosted Supabase; no synthetic account/profile/transaction database data is uploaded. Credential-pattern scans passed on the entire inventoried set and must also pass each staged diff and runtime artifact. Pattern scanning is not a claim that arbitrary prose is a secret scanner.

## Source and environment comparison

The retained READY Preview is dpl_9wMycwDjkKDYPxKjmjBw5RcpFxLL, officebites-12do63zmj-sp24tg-6983s-projects.vercel.app. Its retained source manifest is 25b7fac7509cfad1a7eef85e2f03ff3295ce334182cbcad56b3564e40fded816. All ten foundation source paths are verified against that manifest; nine match current source, and the workspace's only subsequent differences are the reviewed settings-form replacement. The only runtime additions to this deployed baseline are ManualSettingsForm and its integration. Package lock and dependencies unchanged.

Production custom domains officebites.co.za, www.officebites.co.za and officebites-pi.vercel.app currently route to dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt (officebites-ms6sjgmw8-sp24tg-6983s-projects.vercel.app). Project latestDeployment independently reports a different production-target deployment dpl_5yg6d96GReA9Bnp2GSd1WDrxKtuH; do not confuse it with custom-domain routing. Both are pre-existing read-only observations. Production source tree shows older services and no manualPaymentService; nested source and direct source reads are truncated, so a complete production source comparison is unavailable. No guessed production-source baseline is used to construct this release. Preserve and compare current routing/project/environment metadata before/after deployment.

Staging independently confirmed as eyhmarmekioovcjibcbr, officebites-staging, ACTIVE_HEALTHY. All four methods disabled, 15 minutes/R500, 15 orders, zero payment profiles/manual payments/provider attempts at preflight. Preview environment list contains only public Supabase URL/key; exact URL verified and key privately matched against this staging project's publishable keys. No branch override or Preview payment credentials observed. Production environment values were not decrypted or changed.

## Git scopes and migration boundaries

Prerequisite 0e8f560e858f79ca5522920a6f3a0463162deae4 captures exactly ten verified foundation files using index blobs from retained source, without touching working files or absorbing safety code. Safety commit e804462b036ffb2f93ac5cf43daa60cbb375da57 contains exactly the seven previously approved files. Additional regression/SQL provenance and documentation commits are separate.

Reviewed SQL filenames map to hosted versions 20261020100740 (manual payments) and 20261021100655 (singleton fix). Recording those source files does not authorise db push, ledger repair, migration execution or production installation. Security gate/Auth hooks/provisioning remain excluded and uninstalled. Architecture documentation introduces no multi-vendor code. Backend revision/idempotency/activation interlock remains design-only.

Runtime deployment artifact must be exported only from the final commit's src, public and explicit root build/config files. Exclude .env*, .git, checks, docs, supabase, node_modules, logs and local fixtures. Build with privately verified staging public values, no production/service-role/provider credentials. Deployment is Preview only with explicit Git SHA metadata, no Git push, domain/protection/share-link operation or migration.

## Validation and handoff

Final counts, commit SHAs, deployment evidence and remaining operational blockers are recorded in the release results report. No launch-readiness claim: notification isolation, effective PostgREST configuration, protected operator access and separately authorised synthetic onboarding/UAT remain prerequisites.
