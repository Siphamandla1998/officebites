# Payment development handoff — 26 October 2026

Development branch: `feat/vendor-direct-launch-payments`.
Origin: `https://github.com/Siphamandla1998/officebites.git`.
Base before this handoff: `4cac836a35ef0e75e589a2640772f775ca1a260c`.

**Local checkpoint only. Push is blocked pending Vercel production-safety evidence.**
Current project metadata does not expose the Production Branch setting. Fresh Git
context confirms the repository link; custom environments returned none. Project
webhook inspection returned 403 and there is no available Vercel CLI fallback.
Those observations cannot establish that a push cannot trigger production through
Git mapping or external automation. No push, deploy, promotion, hosted migration,
banking approval or payment/configuration change is authorized by this document.

Before any later push, a Vercel/repository owner must verify the actual Production
Branch, branch/domain/environment mappings, deploy hooks and automation cannot
promote this feature branch or apply migrations. Obtain redacted current evidence;
do not infer safety from previous Preview deployments. Then fetch and check history
again. Never force-push, amend this checkpoint or merge into main to transfer work.

## Reviewed scope and validation

All 38 existing changed/untracked payment files were reviewed; this handoff is the
39th file. Generated SQL/request/manifest bytes were checked against the offline
builder and source hashes. Sensitive-content scanning found no secret-token/private-
key/credential-URI literals; bank literals manually reviewed are synthetic fixtures
or field labels. Metadata JSON contains schema/ACL/function hashes/counts/settings,
not customer/auth/banking rows. Technical project/deployment IDs and synthetic UUIDs
are not personal identity records.

No .env, secrets, real bank details, personal IDs/customer data, local databases,
node_modules, logs, screenshots, build output or temporary helpers are included.
No source or report from the separate `officebites-legal` worktree is included.
Historical preparation helpers are preserved as provenance, not release authority;
their obsolete assumptions/risks remain documented in the P0 report.

Checks rerun for this checkpoint:

- `git diff --check`; staged-content checks before commit.
- `node checks/manual-settings-service.mjs`: 15 assertions passed.
- `node checks/manual-settings-local.mjs`: complete 776-assertion disposable SQL
  chain passed, including 24 settings/banking, 4 post-EFT compatibility and the
  original 19 installer assertions. No hosted database used.
- Both offline installation package `--verify` checks passed.
- Settings/profile browser suites: 16 passed against blocked-network synthetic
  fixtures. The preceding full affected checkout/payment run recorded 61 passes;
  it is historical evidence, not counted again here.
- Lint passed with nine existing warnings; production Vite/PWA build passed.

The new UI requires the checked-settings backend; an older backend deliberately
leaves that form read-only. SQL remains a candidate outside automatic migrations.
Installation, hosted UAT and real-money launch remain NO-GO under the existing P0
and legal/compliance blockers. Read `eft-checkout-settings-fix-20261026.md` and
`eft-operator-runbook-20261026.md` before continuing. Do not enable methods to
make checkout display instructions or approve a vendor merely to submit banking.

## Exact checkpoint inventory — 39 files

```text
OFFICEBITES-PREVIEW-RELEASE-20261016.md
checks/admin-settings-browser.spec.mjs
checks/browser-harness.jsx
checks/checkout-database.mjs
checks/manual-payments-database.mjs
checks/manual-profile-browser.spec.mjs
checks/eft-package-local.mjs
checks/manual-payments-staging-preflight.sql
checks/manual-settings-concurrency-candidate.sql
checks/manual-settings-database.mjs
checks/manual-settings-local.mjs
checks/manual-settings-service.mjs
checks/prepare-manual-staging-release.mjs
checks/uat/eft-installation-package.test.mjs
checks/uat/fixtures/eft-p0-readonly-evidence-20261026.json
checks/uat/fixtures/eft-staging-baseline-20261026.json
checks/uat/prepare-eft-installation-package.mjs
docs/eft-checkout-settings-fix-20261026.md
docs/eft-legal-dependency-matrix-20261026.md
docs/eft-operator-runbook-20261026.md
docs/eft-p0-resolution-20261026.md
docs/eft-readiness-readonly-20261026.md
docs/eft-supabase-support-draft-20261026.md
docs/payment-development-handoff-20261026.md
src/components/features/AdminPaymentProfileForm.jsx
src/components/features/ManualPaymentWorkspace.jsx
src/components/features/ManualSettingsForm.jsx
src/services/manualPaymentService.js
src/utils/manualSettingsError.js
supabase/staging-release/20261026-eft/README.md
supabase/staging-release/20261026-eft/apply-migration-request.json
supabase/staging-release/20261026-eft/baseline-capture.sql
supabase/staging-release/20261026-eft/forward-containment.sql
supabase/staging-release/20261026-eft/install.sql
supabase/staging-release/20261026-eft/manifest.json
supabase/staging-release/20261026-eft/post-install.sql
supabase/staging-release/20261026-eft/post-recovery.sql
supabase/staging-release/20261026-eft/preflight.sql
supabase/staging-release/20261026-eft/readiness.sql
```

## Continue at home while push is blocked

After the local commit, an incremental Git bundle is prepared under ignored path
`.officebites-local/handoff/officebites-payment-20261026.bundle`. Transfer that file
yourself using an approved private method; it is not sent or uploaded automatically.
It contains this reviewed payment commit and requires the existing origin base.
It does not carry ignored files or uncommitted legal-worktree work. Keep the office
repository until transfer and commit/hash verification succeed.

Use a **new directory**, preserving any existing home worktree. LF checkout matters:
package manifests bind exact source/SQL bytes; automatic CRLF conversion can fail
integrity checks without a semantic SQL change. Do not regenerate hashes to hide it.

```powershell
git clone --config core.autocrlf=false --branch feat/vendor-direct-launch-payments https://github.com/Siphamandla1998/officebites.git officebites-eft-home
cd officebites-eft-home
git status --short
git bundle verify 'D:\transfer\officebites-payment-20261026.bundle'
git fetch 'D:\transfer\officebites-payment-20261026.bundle' refs/heads/feat/vendor-direct-launch-payments
git merge --ff-only FETCH_HEAD
git log -1 --format='%H %s'
node checks/uat/prepare-eft-installation-package.mjs --verify
npm ci
node checks/manual-settings-local.mjs
```

Replace only the transfer path. Compare the commit SHA with the office handoff
receipt. Stop on dirty files, missing bundle prerequisite or non-fast-forward;
do not reset/force. A normal GitHub clone/pull alone will not obtain this unpushed
checkpoint. Local mocked tests need no production credentials. Obtain any future
staging-only public frontend configuration through the approved operator process;
do not copy office credentials or local databases. Preserve the separate legal
worktree on the office computer; its uncommitted B–E work requires its own handoff.
