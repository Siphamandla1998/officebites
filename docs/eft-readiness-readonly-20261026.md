# Vendor-direct EFT readiness — read-only verification

**26 October 2026. Migration installation: NO-GO. Hosted UAT: NO-GO. Real-money launch: NO-GO.**

Fresh hosted observations: **12:59:26–13:14:33 UTC / 14:59:26–15:14:33 SAST**.
Payment flags were last queried at 13:05:03 UTC; final dependency-presence check at 13:14:33 UTC.
Resumed the existing checkout integration; no implementation restarted. Only this
report was written. No existing source/configuration/test/migration/local change or
legal-worktree file was edited. Hosted calls were metadata reads and SELECTs only.
No accounts, banking records, orders, notifications, funds, migrations, activation,
Vercel changes, deployment, Git push or merge. No keys or personal banking data read.

## 1. Git and implementation provenance

Worktree: `C:/Users/Siphamandla.Khumalo/Documents/officebites`.
Branch: `feat/vendor-direct-launch-payments`.
HEAD: **`4cac836a35ef0e75e589a2640772f775ca1a260c`**,
`feat: prepare atomic checkout EFT and prepaid cash release candidate`.
Parent: `695e5e19cf581f6202dcc058afad1ee2fba23208`.

October 22/23 reports calling atomic/assisted/security work uncommitted are
historical. HEAD commits 78 files including those candidates. Runtime source,
payment migrations and pilot/security artifacts have no unstaged changes against
HEAD. Git-committed does **not** mean installed on staging.

| Scope | Git state now | Hosted observation now |
|---|---|---|
| `supabase/migrations/20261020090841_vendor_direct_manual_payments.sql` | Committed | Installed semantically as `20261020100740` |
| `supabase/migrations/20261021094956_fix_admin_manual_settings_singleton.sql` | Committed | Installed as `20261021100655`; settings definition matches expected |
| `checks/pilot/booking-candidate.sql`, `atomic-collection-candidate.sql` | Committed, outside automatic migrations | Policy/activation/collection RPC absent |
| `checks/pilot/assisted-cash-candidate.sql`, `cash-custody-candidate.sql` | Committed closed-by-default candidates | Release installation absent; collection dependency absent |
| `checks/uat/` and `supabase/staging-release/20261023/` | Committed security/installer/recovery/tests, explicitly unapproved | UAT security and installation ledger absent |
| Checkout, PaymentUpload, AdminPayments, order/collection services, CollectionBooking/Admin, assisted/custody UI | Committed runtime/candidate implementation | Latest Preview references HEAD; backend extensions absent |

Preserved pre-existing changes:

| Path | State | SHA-256 before verification |
|---|---|---|
| `OFFICEBITES-PREVIEW-RELEASE-20261016.md` | Modified | `BFF59A97F6217077E2106AD3C60C867D7193781359970B295246E9305432E5BB` |
| `checks/manual-payments-staging-preflight.sql` | Untracked | `9673E0F5A90BD0B2E39476DBB6DA3CE34A933F82AE7486BB071E99AC660DD499` |
| `checks/prepare-manual-staging-release.mjs` | Untracked | `2130BA5982DEDFFF645CD86DFA4036F71F2B5EE60B7FBA29F997A1B5F3715368` |

Closeout hashes of all three pre-existing changed/untracked files match the values above; the only new Git status path is this report.

The untracked preflight expects manual tables absent and an older public delivery
signature: obsolete for today's installed manual schema. Preserve as provenance;
do not treat it as current launch authority. The untracked packaging helper writes
a historical artifact when run normally; it was inspected, not run.

`officebites-legal` remains on `feat/legal-pages-vendor-clickwrap`, same base HEAD,
with local B–E work. Read-only inspected, never merged or modified.

## 2. Correct Preview and staging

Fresh control-plane metadata:

- Supabase **officebites-staging / `eyhmarmekioovcjibcbr`**, ACTIVE_HEALTHY,
  eu-west-1, PostgreSQL **17.6.1.166**. Production project was not queried.
- Vercel **officebites / `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71`**, team
  **`team_kKRzCLk1pNHoIA4sV1M0ciSg`**.
- Latest READY Preview: **`dpl_3GkXn3xL5nWA9NNER2YWDxTDp2ej`**,
  https://officebites-pfqlvecyc-sp24tg-6983s-projects.vercel.app,
  `target=null`; metadata identifies current payment branch and HEAD.
  Alias: `officebites-git-feat-vendor-direct-79d899-sp24tg-6983s-projects.vercel.app`.
- October 22 Preview `dpl_DGWZnPj1ubqxzCfzDcZVUJ3iEYTQ` is still listed READY,
  but is an older deployment, not the current candidate.
- Preview has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, no listed
  branch/custom overrides. The public URL record alone was read and exactly matches
  `https://eyhmarmekioovcjibcbr.supabase.co`. No key or production env value read;
  fresh key-project membership remains unverified.

Metadata/env mapping is not served-bundle proof. A plain read-only HTTP fetch failed
with WebException and no HTTP status: this proves neither 401/protection nor an
application fault. No bypass/share link used. Served bundle hash/backend host,
protection and authenticated transport still need fresh evidence. Production alias
or routing invariance is not asserted in this review.

## 3. Fresh schema, history, settings and authorization

**54 hosted migration entries**, latest `20261021100655_fix_admin_manual_settings_singleton`.

| Semantic dependency | Hosted | Repository timestamp |
|---|---|---|
| legal_corporate_framework | 20261016095620 | 20261016094201 |
| commercial_reporting_contract_locks | 20261016100710 | 20261016100142 |
| repair_order_policy_helper_access | 20261016103515 | 20261016101707 |
| vendor_direct_manual_payments | 20261020100740 | 20261020090841 |
| fix_admin_manual_settings_singleton | **20261021100655** | **20261021094956** |

Earlier checkout/booking/Ozow/origin names also have timestamp discrepancies.
Matching names do not prove identical bytes. **Do not replay local singleton/manual
migrations, fabricate history rows or blanket `db push`.** Ten selected prerequisite
function MD5s/owners match the frozen package baseline; ACLs were inspected against
its preflight. Inspected owners are postgres. Owner-only core/DTO retain inherited
`search_path=public`, an integrated-review concern, not newly exposed code.

Counts: **15 orders, 15 suborders, 15 items, 8 vendors, 4 profiles, 18 manual-payment
audit events, 3 financial-sales rows, zero manual payments and zero bank profiles**.
These are protected historical rows, not presumed synthetic. Counts are not backup
or proof of unchanged row content.

Absent: pilot policy, collection activation, collection RPC, UAT security,
release-installation ledger and B–E gate/assignment/compliance/customer receipt tables.
Final dependency check also confirmed assisted controls, service dates, collection windows and EFT unlock absent. There is **no installed approved Eduvos window/capacity configuration** to test.

| Method (queried twice) | enabled | ready | maintenance |
|---|---|---|---|
| manual_eft | false | true | false |
| manual_payshap | false | true | false |
| payfast | false | true | **false** |
| ozow | false | false | true |

Manual deadline **15 minutes**, review threshold **R500**. Legacy delivery **off,
R15, revision 2**. R500 is payment review, not the legal R200 refund-review policy.
Collection unlock is absent, not an installed NULL expiry.

**Drift:** later legal-phase notes recorded PayFast maintenance true; fresh reads
show false. Cause/time/actor unknown. All methods remain disabled, but their past
configuration is not asserted unchanged. The frozen preflight checks disabled flags,
not every ready/maintenance expectation. Reconcile and approve actual baseline;
never restore an enabled provider or change expectations simply to force a pass.

Fresh RLS/grants:

- Private gateway/settings/bank/manual-payment/event/receivable tables have RLS and
  owner-only ACLs. Anon bank SELECT and authenticated direct bank writes false.
- Guest manual-create EXECUTE is intentional. Bank submit/approve EXECUTE is
  authenticated only; stored-role, active-account and ownership checks remain inside.
  Legacy proof-upload EXECUTE remains revoked for anon/authenticated.
- Restrictive active-account policies intersect related customer/vendor/admin order
  reads and owner/admin vendor/profile writes. Storage has restrictive active-account
  plus scoped support/image policies. No actual JWT/HTTP bypass test performed.
- Fresh advisors still report private RLS/no-policy and anon/authenticated SECURITY
  DEFINER categories and leaked-password protection disabled. Intentional deny-by-
  default/guest RPC findings need contextual review, not broad grants.

## 4. Effective service and notification evidence

Catalogs show **no matching role/database settings** for pgrst db-config, pre-request,
pre-config, schemas/search path or reload channel. This is **not** effective hosted
process evidence. Unknown: actual serving PostgREST version, db-config enabled,
pre-request/pre-config, environment/startup overrides, login/database, exposed schemas,
all-instance reload and whether a new hook would replace an existing one.
Connected tools do not expose complete effective REST/Auth config. SQL settings,
SET ROLE and successful RPCs cannot establish it.

Operator/Support must supply timestamped exact-project configuration/provenance using
`docs/vendor-direct-uat-prerequisites-20261021.md`. Management responses must be
allowlist-redacted; missing fields remain unknown. No credential search or full
config dump was used.

| Channel | Fresh/historical evidence | Missing acceptance |
|---|---|---|
| DB schedules/HTTP queues | Fresh: no pg_cron/pg_net/http/pgmq, cron.job or net queue | External schedulers, DB consumers and Dashboard webhooks inventory |
| In-app notifications | Fresh two chat/support trigger bodies insert notification rows; no external sender pattern | Synthetic-only fanout and Realtime/Auth/Storage transport; no write probes |
| Edge | Fresh six active artifacts: PayFast initiate v22/notify v20, account removal v3, Ozow initiate/webhook/reconcile v4 | Historical source review is not current runtime secret/provider/scheduler isolation; do not invoke adapters as probes |
| Auth email | Oct 21 operator baseline: Email/signup on, Phone off, custom SMTP off, no hook | Fresh saved config and private capture hook/non-delivery/failure behavior; default SMTP/no hook is not suppression |
| MFA/SMS/WhatsApp | No common app sender in current source scan; Phone-off evidence historical only | Fresh enrollment/challenge, SMS provider and Send SMS controls |
| Browser push/PWA | Caching exists; no common push sender in scan | Served worker, subscriptions and connected provider/integration inventory |
| Other/operational | No intentional probes | Vercel cron/log drains/integrations, external automation, provider and team alert routes; named operator sign-off |

Outbox is transactional capture, not a sender or suppression mechanism. `.invalid`
addresses, disabled payments and a Preview URL do not establish non-delivery.
Require one signed row per path: absent / accepted non-forwarding sink / approved
block / UNKNOWN. Any UNKNOWN reachable path blocks provisioning/UAT. Preserve
platform security alerts; do not promise zero operational mail.
## 5. Banking, collection and lifecycle

Hosted bank submission invokes `private.manual_operator`: active admin, or active
owner of an **approved**, unarchived vendor. **Pending vendors cannot self-submit
banking on this branch/staging without activation.** Do not approve a real store
just to bypass it. Admin-assisted pending submission is supported by RPC; a different
admin must approve if the first submitted. No operation was performed; profiles zero.
Approval requires active independent admin, substantive verification evidence, rejects
submitter/vendor owner, and uses server identity/time. New profile versions stay
pending; old orders retain original approved recipient snapshots.

Reviewed existing checkout/payment, banking workspace/settings, collection services/
UI and candidate SQL. No replacement payment engine is proposed.

| Boundary | Current committed behavior / remaining evidence |
|---|---|
| Atomic create | `checks/pilot/atomic-collection-candidate.sql`: stable request UUID, canonical replay payload, identity/name/mobile, approved window/destination and expected revisions. No client fee/rate/date/address override. Order, manual payment, financial snapshot, reservation, request and outbox commit together; commit-time expiry rechecked. Not installed hosted. |
| Eduvos R0 | Collection fee CHECK=0; collection destination must be approved and `Eduvos pickup`. Hub text is not operational approval. Need exact pickup, future windows, staffed capacity/availability, preparation lead and independent agreement. Cutoff includes previous-day 19:00 SAST, window cutoff and preparation/start. |
| Interlock | Policy enabled plus unexpired EFT authorisation; both gateway-writing paths guarded. Collection configuration RPC cannot enable policy/unlock. PayShap masked/rejected. No approved bounded operator unlock procedure demonstrated. |
| Delivery exclusion | Rejects active legacy delivery and incompatible vendor-origin mode. R10 field is inactive prototype delivery, not permission. Preserve off/R15/revision2. No paid collection. |
| Payment instructions | Existing recipient/reference/amount snapshot and private capability; future funds go directly to vendor, no provider split or automatic OfficeBites collection. Tokens not in URL. Customer report remains unpaid, does not extend hold. |
| Receipt/finance | Independent funds check, paid-only fulfilment, immutable checkout agreement ID/version/revision/rate, eligible food, commission, R0 and bank profile. Later rates/profiles cannot reprice old order. Default 17% is not proof of VAT/invoice/marketing accounting. |
| Refund/cancellation | Records human return/reconciliation, not bank execution. Changed replay amount/allocation/evidence rejects. Full refund alone does not release capacity until controlled cancellation. Paid/unpaid races serialize; no automatic reversal, forced paid status or late-capacity invention. |
| Frontend compatibility | Optional read falls back only on missing RPC/PGRST202 or disabled policy; ordinary errors/stale windows block. Backend denies old manual bypass when enforced. Current absent schema means collection-capable Preview is not atomic hosted integration. |
| Full package extras | Assisted patch adds explicit vendor service dates and latest-submitted monotonic bank revisions/revocations. Full package needs a service date even with a window. Reduced EFT-only chain has a different dependency and needs its own source/compatibility review. |

Named implementation: `src/pages/customer/Checkout.jsx`, `PaymentUpload.jsx`,
`src/services/orderService.js`, `manualPaymentService.js`, `collectionService.js`,
`src/components/features/CollectionBooking.jsx`, `CollectionAdmin.jsx`,
`ManualPaymentWorkspace.jsx`, `ManualSettingsForm.jsx`; candidates under `checks/pilot`.

## 6. Tests: fresh versus historical

Fresh safe reruns on this branch, without network/hosted mutations or generated files:

- `node checks/checkout-repair.mjs`: **70 passed**, SDK/provider mocked.
- `node checks/order-rules.mjs`: **9 passed**, system timezone.
- `node --experimental-strip-types checks/payment-cors.mjs`: **32 passed**, handler
  RPC/signing mocked; no provider requests/funds.
- `node checks/uat/prepare-installation-package.mjs --verify`: **PASS**; source/
  package hashes, exact SQL request, target and name match. Builder mode not run.
- `git diff --check`: **PASS**, existing release-note LF/CRLF notice only.
- Fresh ten prerequisite function MD5/owner matches and catalog/flag reads are
  observations, not mutating authorization tests.

| Historical report, not rerun or summed into today's totals | Recorded completed results |
|---|---|
| `docs/complete-staging-release-results-20261022.md` | 67 browser, 702 isolated/mocked assertions, lint/PWA and old manual UI release |
| `docs/atomic-collection-local-20261022.md` | 602 PGlite, 628 native including 26 race assertions, 71 browser plus follow-up |
| `docs/phase5-local-runtime-20261023.md` | 728 PGlite, 777 native, 74 browser passed, lint/build. Earlier ECONNRESET did not recur; root cause unresolved |
| `docs/staging-installation-approval-package-20261023.md` | Local exact package and recovery rehearsal; hosted limits retained |

Can safely rerun later with explicit local test scope: fresh PGlite chain, verified
workspace disposable PostgreSQL (loopback/database/data-dir guard), fixture browser,
lint/build and offline verifier. Those mutate/reset local data or generate files and
were **not run in this read-only task**. No native reset, provisioning, installer,
stop SQL or normal artifact builder was executed. Full browser includes an unmocked
smoke; inspect its scope before reuse.

Missing: actual browser→Auth→PostgREST→database and forged-JWT/capability tests,
effective gate/sink, real devices/accessibility, combined legal/payment native races,
backup/recovery and bounded synthetic hosted UAT. Native SQL alone does not prove
hosted transport. No previous pass upgrades these missing checks to complete.

## 7. B–E integration conflicts — inspected, not merged

Separate worktree reports/migrations inspected read-only; B/D/E hashes match prior
handoffs. None of its hosted tables exist. Local tests there remain legal-branch
evidence, not payment-branch integrated sign-off.

| Boundary | Required reconciliation |
|---|---|
| B identity/activation | Payment branch lacks local untrusted-metadata remediation and strict activation gate. Do not reopen public onboarding or treat metadata as privileged authority. Strict gate needs real current agreement/bank/compliance evidence. |
| C contract acceptance | Reuse existing immutable legal/version store and vendor-specific schedules. Collection commercial snapshot is not authenticated contract acceptance; drafts/checkboxes cannot replace it. |
| D pending banking | D permits secure pending submissions with independent approval; current payment branch does not. No temporary seller approval workaround. Future reviewed integration, not merge-by-assumption. |
| D new orders/exceptions | Enrolled sellers need current unexpired evidence/acceptance/schedule/banking. Explicit existing-vendor exceptions cannot silently broaden; match vendor/legal lock ordering and restore semantics. |
| Bank selectors/revocation | Assisted payment uses latest submitted monotonic revision/revocation journal; D adds compliance expiry/revocation and approved-profile lookup. Reconcile selected profile, ties and both histories; no last-writer function replacement. |
| E customer evidence | This Checkout lacks E legal envelope. E deferred order gate would reject direct collection/manual creation without receipt when enabled. Assisted/cash/request conversion lacks reviewed versioned customer evidence and must remain closed. |
| Frozen package | Legal phases change functions/triggers/banking/methods/schema. Old fingerprints/ledger and later patches cannot be assumed compatible in either installation order. Regenerate/review integrated artifact; never change expected hashes just to pass. |
| Shared UI | Checkout/payment/legal routes, services and admin banking differ across branches. Deliberate future integration and tests needed; no cherry-pick/merge here. |

Legal publication/assent stays off. Real launch still needs executed schedules,
company/tax/IO/retention disclosures, compliance and accounting/provider authority.
15%+2% excludes applicable VAT on OfficeBites services; additional flat marketing
5/7.5/10% across the defined eligible period remains disabled and unresolved for
attribution/refund/VAT/invoices. R0 EFT readiness does not settle those decisions.

## 8. Exact minimal forward-only sequence — proposal only

Already installed: manual `20261020100740` and singleton `20261021100655` plus
verified identity/order/financial helpers. **No replay of local timestamp variants.**

1. Recapture exact target/history/function/owner/ACL/defaults/RLS/settings/row
   fingerprints. Resolve maintenance drift and obtain accepted effective service,
   all-channel non-delivery, backup/recovery and maintenance evidence.
2. Smallest customer-web EFT-only dependency order is **security → booking → atomic**:
   `checks/uat/staging-security.sql` → `checks/pilot/booking-candidate.sql` →
   `checks/pilot/atomic-collection-candidate.sql`. Prepare these as **one new atomic
   staging-only installation migration**, converting only fixture/outer transaction
   scaffolding to reviewed target/baseline/preservation/ledger checks. Retain every
   business guard. No actors/bank/window/order seeded; all methods off, policy false,
   EFT expiry NULL, off/R15 untouched. Assisted/cash/custody and B–E excluded.
3. Native-disposable review of exact new SQL/request/hash/name, compatibility and
   forward recovery; separately approve installation only. Record actual service-
   assigned history version on success, never invent it.
4. Post-install read-only fingerprints/ACL/owners/settings/closed gates. Existence
   does not attach Auth/REST or approve testing. Separately review/approve hook,
   sink and other-channel controls and protected Preview/transport acceptance.
5. Only then seek named synthetic fixture/TTL/EFT unlock and no-funds UAT approval.
   Real launch/other methods/delivery require later independent approvals.

**Artifact limitation:** reduced three-component installer does not yet exist as a
reviewed executable. This read-only task did not generate it. Do not concatenate
fixture-only scripts or claim it is ready for execution.

**Existing exact broader alternative:**
`supabase/staging-release/20261023/apply-migration-request.json`, migration name
`officebites_staging_locked_release_20261023`, target `eyhmarmekioovcjibcbr`.
Request exactly equals committed `install.sql`, SHA-256
`2ae2241eb39afed6d35e5b3a23275adacd7f215e7bce46242d29831791e0aec6`.
Logical digest: `bfece8414f6578896aff42fc96ee01e3a3847e8a46bb3d284fc896dd89eb525d`.
All five source and six package hashes verified. Manifest remains `notApproved:true`.
It installs **security → booking → atomic → assisted → custody** in one transaction:
concrete/rehearsed, but broader than minimal EFT. Explicit approval must accept
additional closed schemas, service-date/profile-revision effects and global account
disruption. Do not install reduced chain then layer full package over duplicate
objects; that needs a different forward artifact. Adding B–E also requires a new
combined artifact/native review, not an assumed installation order.

Recovery: transactional rollback before commit; after commit, separately approved
forward containment. Stop new entry/methods/policy/expiry/UAT access; preserve
snapshots/history and working notification sink. Keep 15/R500 and off/R15, never
blindly reset ready/maintenance/secrets. Historical receipt/refund/reconciliation
must survive. Unknown commit/reload means read-only reconciliation before retry.
No schema/receipt deletion or restored vulnerable function. Full-package recovery
files are digest-bound and not automatically usable for a reduced artifact.

## 9. No-funds synthetic EFT plan — not executed

Prerequisites: accepted exact target/artifact, protected API/Preview, all-channel
non-delivery, recovery, separate test approval with named synthetic UUIDs, request
keys, TTL, expected deltas and closeout owner. Prefer verified disposable Supabase;
current staging has protected historical data.

1. Separately provision only synthetic guest/customer/vendor and independent admins,
   non-routing recipient data and readiness mechanism consistent with any legal
   gates. No real account/bank/transfer/provider call, working-draft publication or
   authorization bypass. Require contained synthetic classification before receipt/
   ordinary financial reporting; if artifact cannot guarantee it, stop.
2. Independently approve explicitly simulated test banking/agreement evidence,
   approved R0 Eduvos destination, future staffed window/capacity and revisions/
   cutoffs. Full package also needs explicit service date. Other methods, delivery,
   assisted/cash/custody remain closed.
3. Separately approve short-lived allowlist/capability/EFT unlock with actor/reason/
   revision/expiry/audit. Prove outsiders denied. Missing bounded auditable unlock
   artifact means stop; normal settings RPC is not unlock authority.
4. Guest/member atomic create, R0/server product total, private recipient/reference/
   token. Replay one order; changed payload denied. Independently inspect persisted
   order/payment/booking/financial/request/outbox snapshots and classification.
5. Report simulated payment: unpaid, hold not extended, no fulfilment. Approved
   simulation of receipt only on synthetic order: assert paid/commission once and
   consistent replay. This is not real funds verification or bank ownership evidence.
6. Wrong capabilities/vendor/admin, stale revisions, last-slot races, new/unapproved/
   revoked bank, suspension, expired unlock/hold, bad cutoff/service date and legacy
   bypass must fail with no partial records. Preserve original bank/agreement snapshots.
7. Unpaid cancel, paid-cancel denial, simulated returned/reconciled refund and full-
   refund cancellation/capacity release; partial/late/over/duplicate cases. No real
   bank refund or altered historical paid record.
8. Close gates/policy/expiry/capability/EFT, all methods off; retain 15/R500 and off/R15.
   Evidence exact test-only deltas, protected historical fingerprints, no external
   notification/funds/provider request. Retain audit; no destructive cleanup/retry.

Stop on real recipient/funds/notification egress, unknown target/classification,
failed denial, unexpected activation, changed snapshot, duplicate finance, capacity
overrun, stale gate or uncertain commit. Reconcile read-only, then separate incident
approval before repair.

## 10. Short P0/P1/P2 checklist and decisions

| Priority / owner | Action and prerequisite | Evidence | Stop condition |
|---|---|---|---|
| **P0 Operator + Support** | Effective REST/Auth and all notification paths, maintenance drift, backup/exposure | Timestamped redacted configuration/reload baseline; signed channel inventory; recovery/maintenance acceptance | Unknown/conflicting hook/channel or unexplained drift |
| **P0 Engineering + Security** | Choose reduced EFT versus broader package; reconcile B–E boundaries without merge | Exact target/SQL/hash/history/dependency and forward-recovery artifact | Fixture scripts offered as installer, unclear extra scope, fingerprint/privilege/lock conflict |
| **P1 Engineering + Reviewer** | Disposable-native rehearsal then installation-only approval | Preserved rows/ACL/owners, closed flags/gates, denied transport, atomicity/replay/recovery | Data rewrite, gate/sink failure or uncertain install |
| **P1 Test Operator + Ops/Finance** | After install acceptance, bounded synthetic-only test approval | Named actors/window/TTL, independent simulated banking/agreement, test deltas/closed closeout | Real bank/customer/notification/funds; missing readiness/unlock |
| **P2 Business/Legal/Finance + Security** | Close real onboarding/legal/tax/refund/provider/operating readiness | Executed schedules/acceptance/compliance/bank evidence, successful UAT, production artifact and explicit EFT approval | Any P0/P1/legal/accounting issue; no date-driven activation |

| Decision | Current result |
|---|---|
| Read-only review / mocked local checks | **GO; completed** |
| Staging migration installation | **NO-GO:** service/notification/backup/maintenance evidence missing; reduced artifact absent; broader artifact unapproved |
| Hosted no-funds UAT | **NO-GO:** collection/security absent, profiles zero, no approved bounded actor/unlock or transport/non-delivery proof |
| Real-money EFT launch | **NO-GO:** UAT, legal/compliance/banking/operating/accounting and explicit activation approval outstanding |
| PayShap/PayFast/Ozow, R10/R15 delivery, cash | **Excluded / NO-GO** |

Next action is P0 operator evidence and artifact-scope decision, not another payment
rewrite or a hosted execution request. Stop for review.