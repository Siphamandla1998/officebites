# Production deployment reconciliation — 28 October 2026

**Decision: NO-GO for production changes.** The diagnosis supports a coordinated,
production-specific backend release and constrained frontend correction. Execution
is gated on verified production recovery, the managed Storage executor, managed
UAT and approval. No deployment, migration, login, account/policy/payment-setting
change or order mutation was performed during this reconciliation.

## Current deployment and root causes

- `officebites.co.za` currently aliases **`dpl_6MGnguqN7HkhPMpsyGYvA7bcf2hm`**.
- Deployed SHA: **`4b94fbe89e8b5a672e4f308701df61c1224580fd`**, branch
  `feat/vendor-direct-launch-payments`; target production.
- Unreleased integration SHA: `f127c095c0353fdd82cec4fa0b28024c10472e20`, branch
  `release/vendor-eft-legal-launch`. Its deployment suppression remains intact.
- Production `gfzhdkitdyqftealgqfi` has **38** recorded migrations, ending
  `20261010101910_production_audit_cleanup`.
- Five fresh exact-argument HTTP probes return **404 / PGRST202**; catalog
  introspection independently confirms all five functions are absent. Their
  manual-payment, legal and delivery-origin tables are also absent. This is a
  frontend/database release mismatch; cache reloads and new grants cannot create
  the missing contracts.
- A read-only scan of 174 deployed JS/JSX files found 63 literal RPC names, 46 absent
  from production. This includes unused service methods; it is not a claim that
  all 63 run on every route. The named five and affected UI paths were traced
  separately. Dynamic RPC choices require additional inspection.

## Exact function/source reconciliation

All five return `jsonb`. Original files below are under
`release/source-candidates/payment/`; they are source inputs, not production
installers. None of these source versions is recorded in production. Absence does
not establish whether an operator deliberately skipped a file or never attempted
it; no failed execution is inferred from the migration ledger.

| Browser signature | Original definition | Production-specific treatment |
|---|---|---|
| `manual_payment_workspace(p_test_only boolean DEFAULT false)` | `20261020090841_vendor_direct_manual_payments.sql` | Foundation P2 below, then final workspace/CAS behavior in P3; original source superseded in candidate |
| `get_vendor_manual_methods(p_vendor_id uuid)` | `20261020090841_vendor_direct_manual_payments.sql` | P2, then compliance/transition guards composed into P3 |
| `get_vendor_delivery_origin(p_vendor_id uuid)` | `20261016090258_central_hub_vendor_origin_approval.sql` | Intentionally excluded from minimal launch; candidate removes `VendorDeliveryOrigin` from vendor settings and delivery/quote controls from checkout/admin |
| `get_commercial_workspace()` | `20261016094201_legal_corporate_framework.sql` | P2, then publication/evidence contract in P3; original framework is not installed wholesale |
| `get_legal_portal()` | `20261016094201_legal_corporate_framework.sql` | Minimum legal store and portal in P2; no invented approved text |

The origin migration requires the delivery settings/quotes foundation in
`20261016074256_checkout_recovery_mobile_delivery_gateways.sql`, neither of whose
tables exists live. It also changes delivery policy/pricing and order snapshots.
Installing it simply to silence an origin 404 expands scope and is not proposed.
The release retains typed delivery rather than claiming distance/origin approval.

Original manual-settings correction source is
`20261021094956_fix_admin_manual_settings_singleton.sql`; the corrected singleton
and checked revision/CAS workflow are composed into P3. Do not repair production
history to match staging's differently timestamped equivalent.

## Profile 406, Auth 400 and exposure — separate findings

`profiles` has RLS enabled and authenticated SELECT grants for the table and all
requested account columns. There are zero Auth users without a profile and zero
duplicate profile IDs. Its permissive self-read policy is intersected with the
restrictive `active_account_access` policy. `private.active_account()` requires
an unsuspended, undeleted profile and, for vendors, a matching unarchived storefront
whose status is not suspended.

For the affected suspended vendor, the self-read therefore returns zero visible
rows; `.single()` turns that into **406 / PGRST116**. The existing profile is not
missing. Earlier supplied-admin inspection independently verified the linked
suspended storefront and matching owner. The restriction must remain. A different
account's 406 still needs its own request/filter/account-state check; this finding
does not attribute every 406 to suspension.

The last-24-hour Auth log aggregate contains 10 `invalid_credentials` entries and
two `refresh_token_not_found` entries, including prior UAT activity. These are
separate password/token failures, not evidence that RPC 404s invalidate sessions.
There is no per-user attribution from this aggregate. Previous admin login,
restoration and refresh passed. Global session restoration is not newly certified
by this read-only investigation. The integration frontend already handles stale
account switches, unknown roles and hidden-profile errors more safely.

Fresh zero-row REST probes: `Accept-Profile: public` returns **200**;
`Accept-Profile: private` returns **406/PGRST106**, correctly excluding private
schema exposure. This deliberate schema-probe response is distinct from the
profile `PGRST116`. SQL session `pgrst.*` settings were null and do not establish
effective managed service configuration. Do not expose `private` to fix wrappers.

The final candidate grants portal/manual-method reads to anon/authenticated;
commercial workspace to authenticated; manual workspace to authenticated and
service_role, with internal account/operator scoping. Public legal wrappers use
SECURITY INVOKER; privileged manual functions use locked search paths and checks.
All owners, signatures and ACLs are in `production-delta-rpc-manifest.json`.

## Conditional release sequence — review only

Production backup/restore readiness is **UNVERIFIED**. The connector exposes no
backup inventory, project health is not backup evidence, and the recovery records
available locally concern staging. Consequently no production database execution
is recommended now. Require an actual production backup/restore-point timestamp,
successful isolated restore evidence, accepted RPO/RTO and separate Storage-byte,
Auth/configuration and external-event recovery arrangements before reconsidering.

The unchanged, SHA-256-checked candidate package under
`release/production-candidates/` is:

1. **P1** `20261027093453_production_launch_browser_grants.sql` — exact 38-row
   baseline/security hash/RLS/owner guards; app postgres; record history 39.
2. **P2** `20261027112327_production_minimum_manual_legal_foundation.sql` — requires
   recorded P1, existing active-account/financial core; adds minimum legal/manual
   foundations and closed settings; record history 40.
3. **P3** `20261027112437_production_checked_settings.sql` — requires P2; composes
   vendor security, agreement assignment, compliance, legal order evidence,
   transition guards and checked settings; record history 41.
4. **P4** `20261027115843_production_compliance_storage_owner_policies.sql` — requires
   installed compliance foundation; separate supported `supabase_storage_admin`
   executor. Storage objects are still owned by that role. Do not grant app
   postgres managed membership. Authorized runner records history 42.
5. Verify exact postflight schema, ACL/RLS, API exposure and unchanged existing data
   with rollout closed. Build the exact reviewed integration SHA with production
   public configuration; stage an unaliased production candidate, test, then seek
   promotion approval. Publish only approved legal versions, obtain real vendor
   assent and independent banking/compliance verification before authorised
   EFT/PayShap activation. No migration alone makes launch operationally ready.

One transaction per migration; record successful history between steps. Stop on
drift or uncertain results. Do not run blanket `db push`, replay staging SQL or
apply `20261027094852_production_manual_legal_transition_guards.sql` separately:
that guard is already included in P3. All four hashes still match
`production-migration-manifest.json`; this does not substitute for final review,
recovery proof or supported executor validation.

## Rollback and release alternatives

No earlier deployment has been certified as a compatible rollback target in this
audit. A blind frontend rollback might restore obsolete payment/legal behavior.
Keep the integration work intact; certify a previous frontend against this exact
database before recommending emergency rollback. A frontend-only promotion of the
current candidate would still leave its essential manual/legal APIs absent.

Before a migration commits, failure rolls back that transaction. After commit,
prefer approved forward containment of new initiation while preserving historical
instructions, receipts, legal evidence and reconciliation. Roll back frontend code
only to a tested compatible deployment. Do not use the currently broken deployment
as proof of successful recovery, drop evidence tables, mark unpaid orders paid or
restore a database over subsequent customer activity without reconciliation.

## Launch audit and validation

| Area | Current result / required validation |
|---|---|
| Mobile menu → cart → checkout | Previously PASS live; today's anonymous app/API probes reproduce missing payment methods. Order submission remains blocked; no test order created |
| Vendor EFT/PayShap | FAIL readiness: methods/workspace/banking-version foundations missing; require verified recipient snapshots, reference/idempotency and report-unpaid → independent receipt verification tests |
| Vendor orders | Existing `get_vendor_dashboard_stats(uuid)` and `update_suborder_status_and_notify(uuid,text)` have authenticated execution. Suspended-vendor denial remains intentional. Active-vendor list/status/notification E2E is not certified by metadata |
| Delivery settings/origins | FAIL for currently served workflow; remove excluded callers via reviewed frontend or separately engineer the full delivery feature. No placeholder origin RPC |
| Legal acceptance | FAIL readiness: store/portal/workspace/order-evidence foundation absent; require approved-version loading, explicit guest/member/vendor assent and stale-version rejection |
| Data preservation | 32 orders, 31 pending and one preparing; full order digest still equals the pre-repair baseline |

Before sign-off test genuine active customer/vendor/admin login, role resolution,
reload/refresh, wrong-role protection and suspended denial; member/guest mobile
checkout; verified banking only; stale/revoked evidence; exact order references;
idempotent retries; reporting never sets paid; independent verification; history,
notifications and cross-vendor isolation; and old-order reconciliation. Order/payment
mutations require separately approved isolated UAT, not production smoke writes.

Historical candidate evidence: 77 distinct passing browser cases across runs,
119 archived native assertions, and a production-target PWA build. These were not
rerun as a managed end-to-end certification today; the latest native rerun was
blocked by Windows runtime dependencies. Fresh evidence is in
`docs/release/reconciliation-20261028.json` and
`docs/release/reconciliation-rest-20261028.json`.
