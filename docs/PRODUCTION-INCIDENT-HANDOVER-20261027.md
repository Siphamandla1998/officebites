# Production incident and home-computer handover

27 October 2026. Local release branch: `release/vendor-eft-legal-launch`.
No hosted writes, migrations, payment activation, orders, notifications, production
deployments or legal publication were performed during this investigation.

## Fresh confirmed incident evidence

- Vercel currently reports production deployment `dpl_F9W4ujyPxzX5GbKARPxS9g9RjkHF`,
  serving officebites.co.za, from payment-branch commit
  `4cac836a35ef0e75e589a2640772f775ca1a260c`. This supersedes the earlier captured
  `4b94fbe` deployment. It does not change this release's Git baseline.
- Production `gfzhdkitdyqftealgqfi` still has 38 migrations, latest
  `20261010101910`. The seven previously reported checkout/admin RPCs, plus
  `create_manual_order`, `create_order_with_legal`, `get_vendor_compliance` and
  `admin_vendor_compliance`, are absent in the inspected public function catalog.
  `private.vendor_payment_profiles` and `private.gateway_settings` are also absent.
- Anonymous browser/API inspection at 14:46 UTC / 16:46 SAST reproduced **404,
  PGRST202** for `get_payment_gateways`, `get_vendor_manual_methods` and
  `manual_payment_workspace`. Public navigation also received delivery-settings
  RPC 404. The only compiled/requested Supabase host was production. No response
  rows, authorization headers, public-key values or banking information were logged.
  Reproducible inspection: `node checks/live-incident-readonly.mjs` (requires Edge
  and network access; anonymous read probes only, no order creation).
- SHE COOKS BY SNE has one matching returned approved vendor record, a correctly
  linked vendor-role profile and existing Auth identity; neither profile suspension,
  deletion nor vendor archival was set. Do not duplicate her registration.
- Both admin profiles are unsuspended and undeleted. Authenticated vendor UPDATE,
  private schema usage and the admin predicate execution grant are present. The
  predicate checks the authenticated user's active database admin profile; it is
  not a blanket denial of every admin. These catalog facts do not authenticate the
  owner's current browser session or reproduce its failed approval PATCH.

**Cause:** deployed payment/operational frontend contracts do not match the older
production database. Missing foundations explain payment settings/approval workspace
failures and unavailable EFT/PayShap. There is no integrated approved bank-profile
record to read from the absent table. Existing vendor approval is distinct from
bank verification and launch readiness. The exact generic vendor Approve failure
remains unconfirmed without a sanitized authenticated request/error trace; no
production approval was attempted to manufacture one.

The newer deployed commit differs from the previously reviewed payment commit in
five manual-settings/profile UI/service files; this release retains its checked
settings/CAS and independent admin-assistance implementation. Source differences
must be considered when selecting a frontend release, not blindly overwritten.

## Minimum repair and execution boundary

The four exact candidates in `docs/release/production-migration-manifest.json` all
still match their SHA-256 entries. Required order:

1. `20261027093453_production_launch_browser_grants.sql`
2. `20261027112327_production_minimum_manual_legal_foundation.sql`
3. `20261027112437_production_checked_settings.sql`
4. `20261027115843_production_compliance_storage_owner_policies.sql`

Expected production ledger 38 -> 42, recorded after each successful step. These
are **uninstalled review candidates**, not an authorized incident installer. The
standalone transition-guards source file must not be installed again. Never use
staging's different ledger/installer on production or blanket db push.

Before installation: fresh production guard checks, private recoverable production
backup and accepted recovery/window, supported production Storage policy executor,
and critical hosted staging UAT against its own prepared delta. Staging's confirmed
policy-delegation registration does not establish the production executor.

Then, under separate approvals: backend installation/postflight and real API/RLS
checks with all flags closed -> verified frontend deployment -> complete approved
public/vendor versions and actual schedule -> existing vendor's independent
bank/compliance review and acceptance -> explicitly approved EFT activation.
PayShap also requires verified receiving capability and its own positive test.
Preserve PayFast/Ozow integrations without activating them. The fee snapshot remains
15% + 2%; marketing stays disabled and tax/invoice treatment needs accounting sign-off.

Hosted UAT must demonstrate member/guest order creation, protected instructions,
reporting still unpaid, independent verified receipt, duplicate protection,
rejection/cancellation and tracking/vendor visibility. Local mocks are not that
evidence. No switch or frontend fallback safely repairs the absent backend alone.

Until approved recovery, use existing support channels to tell customers online
ordering is unavailable and reconcile any already-sent transfers with the vendor.
An independently agreed off-platform arrangement is not an OfficeBites confirmed
order. Do not request a second transfer or mark an order paid from a screenshot.

## Local verification in this handover

- 46 browser tests passed (checkout/payment, admin settings/profile, compliance,
  launch scope), using loopback mocks and synthetic records.
- Lint passed with nine existing warnings.
- 9 availability, 36 cloud backup scope, 9 backup-integrity, 15 customer legal
  service, 6 public-config and 18 in-memory grant assertions passed.
- Frontend/PWA build passed without a configured hosted target; compilation alone
  does not prove a correct hosted environment. Initial tracked diff whitespace
  check passed. Once archived sources were staged, the full check reported trailing
  Markdown hard-break spaces and extra EOF blank lines in archived legal/test/SQL
  files, including two production candidates. Their reviewed bytes/hashes were
  preserved; the full check is reported as FAIL, not silently waived or rewritten.
- Prior 119 native PostgreSQL assertions remain recorded in the compatibility
  report. No new PostgreSQL or Docker installation was performed; native/hosted
  end-to-end testing is not claimed rerun in this handover.

## Git safety, exclusions and home setup

`vercel.json` now explicitly sets
`git.deploymentEnabled["release/vendor-eft-legal-launch"]=false`, using Vercel's
[documented branch guard](https://vercel.com/docs/project-configuration/git-configuration).
This prevents normal Vercel Git deployments for this branch; other branches retain
their existing behavior. No custom Vercel environments were returned. The only
repository workflow is manual-dispatch staging backup, not push-triggered deployment.
The connector does not expose production branch tracking or arbitrary external
automation. The explicit branch guard prevents normal Vercel Git deployment
independently of that branch-tracking value. No push-triggered deployment workflow
or active local Git hook was found. Uninspected external automation is not claimed
verified; owner clarification was requested. Do not use a manual production CLI
deploy to bypass the guard. Recheck the live deployment after the handover push.

All changed/untracked project text was scanned for private keys, secret keys,
GitHub tokens, password-bearing PostgreSQL URLs, JWTs and bank-number literals.
Bank matches were inspected and are explicit synthetic fixtures. This is not a
claim that pattern matching can detect every possible secret. Source/catalog SQL
and aggregate evidence are retained; no customer-row export is included.

Intentionally excluded and preserved on this computer: untracked `debug.log`;
ignored `.officebites-local/` databases, tools, browser profiles and temporary
evidence; `node_modules/`, `dist/`, `test-results/` and `supabase/.temp/`. Do not
copy these into Git. Private PostgreSQL credential files outside the worktree
were not opened, staged or uploaded. Neither original worktree was edited.

After a separately verified successful push, on a new home checkout:

```powershell
git clone --branch release/vendor-eft-legal-launch --single-branch https://github.com/Siphamandla1998/officebites.git officebites-release
cd officebites-release
git status --short
git log -2 --oneline
npm ci
npm run lint
node checks/release-availability.test.mjs
node checks/cloud/staging-backup.test.mjs
```

Use Node 24 and compare HEAD with the handover's verified remote SHA before editing.
If that folder already exists, inspect its status before any fetch/switch/pull;
do not overwrite unfinished home work. Configure local public Supabase variables
only through the approved staging setup, never production credentials. The native
database scripts depend on separately provisioned disposable tooling; npm ci does
not install PostgreSQL. No home PostgreSQL/Docker installation is required to
continue frontend development. Read this file before any release action.
