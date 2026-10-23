# OfficeBites committed staging Preview release — 22 October 2026

Outcome: reviewed runtime deployed to a new READY Preview; production unchanged. This is a UI release, not payment activation or launch approval. No Git push, database migration, hosted mutation, account/profile/order creation, payment transaction, provider-secret change, protection/share-link operation or production deployment was performed.

## Inventory and Git history

The committed exact-file inventory is `docs/complete-staging-release-inventory-20261021.md`: 54 initial modified/untracked paths, per-file include/exclude decisions, source provenance and migration-version mapping. It also records the two added local profile workflow tests and the dependency correction. No deleted files were present. The active older `OFFICEBITES-PREVIEW-RELEASE-20261016.md` edits remain untouched.

| Scope | Full commit SHA |
| --- | --- |
| Verified existing Preview foundation, ten source files | `0e8f560e858f79ca5522920a6f3a0463162deae4` |
| Reviewed seven-file admin settings safety change | `e804462b036ffb2f93ac5cf43daa60cbb375da57` |
| Existing manual-payment regressions, historical SQL provenance and two local profile UI tests | `9ca5614f191d28f81b01e98436840445e148743f` |
| Release inventory and design-only marketplace architecture | `d5a77d8bbfdd6622dd194babcb62886aeae056f5` |
| Required local stop-SQL test dependency and inventory correction — deployed source commit | `695e5e19cf581f6202dcc058afad1ee2fba23208` |

The foundation used retained manifest-verified Git index blobs, preserving the current workspace safety edits until the second commit. No safety code entered the prerequisite. All source changes already present in the READY Preview are now in Git. Its runtime differs from this release only in `ManualPaymentWorkspace.jsx` and the new `ManualSettingsForm.jsx`; no vendor/profile/commission/eligibility/fulfilment backend implementation changed. Marketplace Phase 2 remains documentation only.

The feature branch has no upstream/remote head. Read-only `ls-remote` found remote main at `4c4835db62b7db4c7a725c92d7a6294ca523fa57`; nothing was fetched, merged or pushed. Git used its existing auto-detected committer identity and emitted an advisory; identity settings/history were not altered.

## Isolated artifact and environment

- Exported exact Git blobs from `695e5e19cf581f6202dcc058afad1ee2fba23208` into a separate local candidate. Git archive's Windows CRLF conversion was verified as line-ending-only, then runtime files were replaced with exact blob bytes and rechecked. No working-tree file was overwritten.
- Uploaded 179 allowlisted runtime/build files from committed `src`, `public` and root build files. No checks, docs, SQL, environment files, security gate/Auth-hook tooling, local fixtures, node_modules or generated dist entered the upload.
- Runtime/source and staged-diff credential-pattern checks passed. No actual vendor/customer banking data or credentials were added. Clearly synthetic non-delivering data appears only in local test code, never hosted data or deployment source.
- Staging independently confirmed: `eyhmarmekioovcjibcbr`, officebites-staging, ACTIVE_HEALTHY. Required hosted versions `20261020100740` and `20261021100655` and checkout/settings RPCs present. No unapplied migration is needed for this UI release; recorded historical SQL was not executed.
- Preview environment list contains only the two public Supabase variables. Exact staging URL verified; Preview publishable key privately matched to this staging project's keys. No branch-specific overrides or Preview provider credentials found. Production environment values were not decrypted. Environment IDs, scopes and update metadata unchanged afterward.
- Local isolated lint and staging PWA build passed. Service worker generated with 125 precache entries. No environment file was copied into source.

## Validation

| Category | Executed result |
| --- | --- |
| Full browser suites in isolated committed candidate | **67 passed**, 3.6 minutes: admin safety, checkout, manual payment eligibility/instructions, vendor profile submission/new version, admin approval, guest access/tracking/support, financial CSV, delivery/origin and auth/request-scope regressions |
| Isolated checkout SQL chain | **379 assertions passed** in the corrected final commit: 38 checkout + 50 receipt/subscription/roles + 59 delivery + 103 legal/financial/permissions + 20 order repair + 109 manual-payment assertions |
| Existing local security/recovery suites, kept outside release installation scope | **102 assertions passed**: 59 recovery + 43 gate/allowlist/capture; no hosted transport claim |
| Settings singleton compatibility | **70 assertions passed**, all local gateways disabled |
| Mocked/local service checks | **151 assertions passed**: 66 checkout repair + 9 order/date/commission + 44 checkout rules + 32 exact-origin/CORS; provider HTTP/signing mocked |
| Feature-preservation boundary | PASS |
| Lint | PASS, existing warnings only |
| Isolated staging PWA build | PASS, service worker/precache generated |

Totals counted once: **67 browser test cases and 702 isolated/mocked assertions**, plus the feature-boundary check. Reruns are not added to totals. New backend approval/permission assertions remain actual isolated SQL tests; the positive browser submission/approval cases use synthetic services and establish UI behaviour only. PGlite does not prove native hosted PostgREST/Auth/Realtime transport or production concurrency.

The first isolated SQL run exposed a missing Git dependency (`checks/manual-payments-staging-stop.sql`), not a money/state assertion failure. The existing reviewed file was separately committed as a local test dependency; the corrected isolated chain passed. It remains excluded from upload and was never executed hosted.

## Deployment and source identity

- Deployment: **`dpl_DGWZnPj1ubqxzCfzDcZVUJ3iEYTQ`**.
- URL: **https://officebites-70l6nc42z-sp24tg-6983s-projects.vercel.app**.
- Vercel project/team: `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71` / `team_kKRzCLk1pNHoIA4sV1M0ciSg`.
- State **READY**, `target: null` (Preview), aliases empty, no alias error.
- Source Git SHA: **`695e5e19cf581f6202dcc058afad1ee2fba23208`**, proven by the exact Git export/source manifest and served-bundle comparisons.

Important provenance limit: the connector returns empty Git metadata despite supplied commit fields. It does not independently attest a Git checkout SHA. This was a source-upload deployment, without Git push/Git-source retrieval. Do not describe the platform as reporting the SHA. All six checked served chunks match the isolated committed build exactly by SHA-256: Supabase client, ManualPaymentWorkspace (including safety form), AdminPayments, VendorSettings, Checkout and PaymentUpload. This establishes tested artifact identity, with the manifest recording all uploaded files.

Initial API request with literal `target: preview` was rejected with HTTP 400 before creation. The official API requires target omission for Preview: https://vercel.com/docs/rest-api/deployments/create-a-new-deployment. Corrected request omitted target and created the single new Preview listed above. No production/staging-alias target was used. A domain-filtered alias query gave an incomplete set; complete project alias lists established identical routing and timestamps before retry and after deployment.

## Hosted read-only verification

Normal Edge access at 390px and 1440px; no authenticated URL-fetch helper or share links:

- `/support` and `/help/contact` return app shell, redirect where applicable and survive refresh; no support form submitted.
- Checkout shows confirmed unavailability, no payment radios, disabled Place order, usable layout and keyboard Back to menu. Browser-local synthetic cart survives navigation. No hosted cart/order creation.
- Signed-out `/admin/payments` and `/vendor/settings` require login; protected controls are not exposed.
- Served workspace chunk contains new failure/reconciliation messages, last-confirmed state, reload-only action and existing vendor submission/admin approval components. Positive signed-in workflows were verified locally, not hosted, because no authorised operator session was available.
- Browser requests reached staging only for backend reads. No page errors or unexpected/prohibited requests. Google Fonts requests deliberately blocked; screenshots use fallback fonts.

At **2026-10-22 06:13:13 UTC / 08:13:13 SAST**, final read-only state confirmed:

- Manual EFT, manual PayShap, PayFast and Ozow: **all disabled**.
- Singleton settings: **15 minutes / R500**.
- Orders: **15**, profiles: **0**, manual payments: **0**, provider attempts: **0**.
- All **57 public/private table counts and ordered content fingerprints unchanged** across deployment and browser checks, including settings, gateway metadata, payment/audit and financial history. A final direct refresh encountered one transport error; a subsequent read-only query succeeded. No mutation retry occurred.

## Production evidence

All three production domains still route to **`dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt`**, immutable URL `officebites-ms6sjgmw8-sp24tg-6983s-projects.vercel.app`:

- officebites.co.za: alias timestamp `1792575393032`, bypass metadata unchanged.
- www.officebites.co.za: `1792575393029` unchanged.
- officebites-pi.vercel.app: `1792575393024` unchanged.

Both the routed production deployment and pre-existing separate latest production-target deployment `dpl_5yg6d96GReA9Bnp2GSd1WDrxKtuH` retain identical ID, URL, target, creation time, readiness and Git metadata. Do not confuse latest-created deployment with domain routing. Project configuration/protection and all environment metadata unchanged. No domain, alias, protection, secret or production change made. Complete production source retrieval is truncated through this connector; no full source equality claim is made.

## Evidence, exclusions and remaining blockers

Evidence under `.officebites-local/release-complete-20261021/`: initial inventory/disposition, commits.json, manifest.json, isolated logs, hosted-before.json, deployment.json, hosted-verification.json, verification-summary.json and checkout screenshots. No environment values/session credentials are in these handoff reports. This post-deployment results document is local and uncommitted; deployed/runtime HEAD remains the SHA above.

Shared working tree intentionally retains excluded changes: older active release notes, the two local-only UAT imports in checkout-database, security/provisioning/recovery tooling, staging preflight/packaging helpers and unfinished operational/legal reports. Runtime source tree has no unstaged changes; the deployment was not built from the dirty shared tree. See the committed inventory for every original path.

Remaining launch blockers: effective PostgREST configuration/override attestation and enforcement verification; notification-channel isolation and fail-closed delivery coverage; separately approved staging security/protection installation; synthetic identity/profile preparation and independent approval; supervised hosted UAT and operational/commercial/legal sign-off. Server-side settings revision/idempotency/activation interlocks remain design-only. No provider marketplace approval is inferred.

Recovery: keep methods disabled and stop new hosted testing if a problem appears. The previous READY Preview `dpl_9wMycwDjkKDYPxKjmjBw5RcpFxLL` remains available; use its immutable URL for comparison. No aliases were changed, so no alias rollback is required. Any replacement Preview, hosted configuration restoration or database recovery requires its own reviewed scope/approval. Do not reverse financial history, restore the defective singleton function or detach suppression hooks automatically.
