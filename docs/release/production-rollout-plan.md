# Production rollout proposal — blocked, review only

**Historical proposal.** The current four-file production candidate, fresh deployment evidence and native regression results are in `../INTEGRATED-CHECKOUT-COMPATIBILITY-REPAIR-20261027.md` and `production-migration-manifest.json`. Earlier extraction/source-unavailability statements below are superseded; operational approvals remain required. The managed Storage-owner step has a separate executor boundary.

27 October 2026. Target **gfzhdkitdyqftealgqfi**. Staging is **eyhmarmekioovcjibcbr**.
No command in this document authorizes a hosted write. No complete production
installer has been generated. Step names below are plan identifiers, not fabricated
migration-history rows or ready-to-run filenames.

## Dependency and artifact matrix

| Order / plan ID | Actual artifact / source | Dependencies | Current decision |
|---|---|---|---|
| 0 baseline | production-deployment.json, production-source-comparison.json, production-served-frontend.json, production-*.json, staging-*.json | Full live source recovery/certification, fresh effective service evidence | BLOCKED; origin/main is an uncertified local candidate |
| 1 preflight | `checks/production-launch-preflight.sql` | Operator verifies project in control plane, authorized read-only observer | Prepared SELECT-only evidence query; selected catalogs already captured. Not an automatic pass/fail installer |
| 2 P01 grants | `release/production-candidates/20261027093453_production_launch_browser_grants.sql` | Exact 38-entry captured production ledger/security hashes/owner/RLS checks, independent review | Locally tested in PGlite + native 17.10; not approved for hosted installation |
| 3 P02 minimum checkout/gateway compatibility | Input `release/source-candidates/payment/20261016074256_checkout_recovery_mobile_delivery_gateways.sql` and actual production order/cancellation/finance contract | P01, sanitized full production schema contract | EXTRACTION NOT COMPLETE. Keep current typed fulfilment/date/cutoff semantics; add only needed manual-compatible columns/helpers and disabled gateway foundations. Do not install distance charging/quotes, booking, Ozow or provider attempts wholesale |
| 4 P03 legal foundation | Input `20261016094201_legal_corporate_framework.sql` + `20261016100142_commercial_reporting_contract_locks.sql` | P02/core public/private identity/finance helpers | EXTRACTION NOT COMPLETE. Reuse legal_versions/vendor_legal_acceptances, business/audit/immutable/document-lock functions required by B–E. Remove or make inaccessible excluded acquisition/corporate interfaces; keep hard marketing activation interlocks. No company/tax defaults treated as verified; no approved text/assignments inserted |
| 5 P04 manual banking/payment foundation | Input `20261020090841_vendor_direct_manual_payments.sql` | P02, existing production financial_sales/order snapshots, legal dependencies as needed | EXTRACTION NOT COMPLETE. Versioned pending profiles, independent approval, protected instructions/tokens, one-vendor idempotent orders, receipt/reference uniqueness, ledger/refunds/cancellation. Original mixed SQL updates provider settings and assumes absent objects; do not run unchanged |
| 6 P05 settings singleton | Input `20261021094956_fix_admin_manual_settings_singleton.sql` | P04 | Include corrected singleton logic in the new production delta. Do not invent production history for staging's 20261021100655 |
| 7 B | `release/source-candidates/legal/20261026073911_phase_b_vendor_security_activation.sql` | P03/P04, actual profile/vendor defaults/guards | Preserve safe provisioning, privileged-field protection and backend activation; no implicit enrollment/backfill |
| 8 C | `release/source-candidates/legal/20261026091408_phase_c_vendor_agreement_assignments.sql` | B and existing immutable legal store | Vendor/owner-scoped approved version/hash assignment and acceptance; vendor rollout false |
| 9 D | `release/source-candidates/legal/20261026101346_phase_d_vendor_compliance.sql` | C + real Storage schema/RLS + manual bank RPCs | Scoped pending submissions, independent review/revocation/expiry, new-order/restore guards, explicit legacy audit |
| 10 E | `release/source-candidates/legal/20261026112602_phase_e_legal_publication_checkout_evidence.sql` | D + legal/commercial contracts | Six approved public document kinds, publication manifests, immutable guest/member order evidence and deferred bypass denial; rollout/publication false. Final launch guard rejects the optional collection branch |
| 11 P06 manual launch guards | `release/production-candidates/20261027094852_production_manual_legal_transition_guards.sql` | P04 + B/C/D/E; closed flags | 25 combined PGlite assertions. Strict new EFT/PayShap for all vendors, receipt/commit guards, preserved historical settlement. Full native/transport verification still required |
| 12 P07 checked settings | Input `release/source-candidates/payment/manual-settings-concurrency-candidate.sql` | P05, manual workspace, final owners/grants/lock review | PRODUCTION ADAPTATION NOT COMPLETE. Preserve revision/CAS/audit/role behavior, supply a production-specific baseline prerequisite. Do not set a staging project marker or remove authorization checks to apply this file |
| 13 final surface closure | Exact reviewed final SQL/manifest, not yet produced | All above | Verify no excluded creation path can be called through a definer wrapper; close new provider initiation, preserve legitimate old callbacks/order recovery. Re-hash complete SQL and every owner/ACL/trigger definition after composition |

Files under `release/source-candidates/payment/` are source inputs, not preceding
production migrations to replay. Additional copied origin/Ozow/delivery inputs are
archaeology for dependency review, not approved launch steps. Reference tests include
excluded features because the original B–E tests depended on them. Their installation
in a discarded in-memory fixture does not expand launch scope.

## Required preflight before proposing installation

1. **Identity and source:** verify production project ref/control-plane identity,
   current custom-domain deployment/served backend host and complete source tree.
   A newer production-target deployment, current_database(), or a project-ref GUC
   is insufficient. GitHub lacks the reported deployed commit; obtain a complete
   source archive through the authorized Vercel deployment owner/API or certify an
   alternative baseline with a complete functional/schema comparison.
2. **History and actual objects:** capture all history plus schema/columns/defaults,
   indexes/constraints/triggers/policies/RLS, sequences/views/security-invoker behavior,
   owners/ACLs, column/default privileges, role membership/extensions and relevant
   function definitions/hashes. Reconcile production's existing financial/account
   migrations and cleanup by actual definitions. Do not replay local timestamp variants.
3. **Historical data:** refresh aggregate preservation digests and inventory old
   order/payment/commission/payout obligations in controlled operator evidence.
   Current observation: 32 orders, 31 pending_payment and one preparing, 33 suborders;
   ten vendors (one approved, nine suspended). Do not classify/cancel these from
   status alone. Preserve original commission, recipient, reference and legal evidence.
4. **Compatibility:** prove old callbacks and support/tracking can reconcile existing
   orders after old checkout creation is closed. Confirm qualified/public wrapper
   dependencies and PostgREST return signatures. A shared semantic migration name
   is not an identical definition. Stage and production require separate preflights.
5. **Service boundary:** obtain effective PostgREST exposed-schema/pre-request/
   pre-config/role precedence/reload evidence, Auth hook/fallback behavior, Storage/
   Realtime policies and service-role consumer inventory. SQL settings do not prove
   effective managed-service state. Ask Support for values unavailable to admins.
6. **Isolation/recovery:** signed notification/outbox/worker/provider/Vercel route
   inventory with accepted sinks/blocks, retry/forwarding controls; usable backups/
   PITR and disposable restore drill, RPO/RTO, separate Storage bytes/Auth/Edge/config
   recovery and named maintenance/containment owners. No active probes authorized now.
7. **Exact artifact:** generate actual new migration filenames through the CLI;
   produce a production-only dependency manifest/SQL digest, explicit target guards,
   transaction boundaries/timeouts and independent Security/DB approval. There is
   no production permission to turn a failed guard into a passing marker.

## Disposable rehearsal and evidence required

- Restore a sanitized actual production schema contract into a positively verified
  disposable native Supabase environment; never reuse staging or the original
  payment cluster. Record target identity/data directory/network isolation before
  mutations. Managed Auth/Storage/PostgREST/Realtime need their own runtime tests.
- Apply the exact ordered production artifact with all payment, legal acceptance,
  publication and marketing states closed. Compare every relevant object/owner/
  privilege and historical aggregate afterward; fail on drift or partial schema.
- Use clearly synthetic, non-routing vendor/company/bank/document fixtures only.
  Test real admin/customer/vendor/anonymous tokens and guest capabilities: signup
  metadata escalation, direct vendor/profile INSERT, privileged UPDATE/transfer,
  pending bank upload, cross-vendor reads, self-review and forged actors/times,
  revoked/expired evidence, scoped schedules, material changes, activation/restore,
  required customer/vendor receipts and all legacy bypasses.
- Prove successful ordinary guest/member EFT and PayShap creation with complete
  current strict vendor evidence; legal/order/recipient/commission atomicity, stale
  versions, interrupted/replayed requests, offline UI and duplicate receipt/refund
  protection. Demonstrate customer reporting never changes paid state.
- Use simultaneous native sessions for duplicate request/receipt keys, settings
  CAS, bank revocation/owner transfer/publication/review versus checkout, evidence
  expiry before commit, receipt/cancellation/refund races and historical order work.
  Test lock timeout/deadlock recovery without duplicate obligations. PGlite alone
  is insufficient. The native grant test performed here proves none of these races.

## Proposed hosted order, only after separate approvals

1. Obtain **installation-only** approval for the exact completed SQL/hash/target,
   named executor/window/stop and recovery owners. Accept maintenance and old-client
   refresh behavior. Inventory/freeze conflicting administrative changes through
   the approved operating process; this report changes no configuration.
2. Re-run read-only production preflight immediately before execution. Any history,
   definition/owner/privilege, gateway state or data-contract discrepancy stops work.
3. In the approved window, apply the reviewed dependency-ordered forward migrations.
   Keep initiation/publication/acceptance/marketing off. Do not blanket `db push`,
   edit historical IDs, insert fake hosted history or copy staging installers.
4. Read-only verify committed history and schema/ACL/function/trigger hashes,
   unchanged existing data/flags and fail-closed new entry points. An uncertain
   connection result is not permission to retry blindly: reconcile the ledger and
   exact objects first. B–E invalidate the old EFT installer's frozen fingerprints.
5. Separately approve an isolated staging Preview/client deployment and no-funds
   synthetic UAT after staging's own matching delta, public-key membership/build
   mapping, effective API controls and notification isolation have been verified.
   Production credentials do not belong in local files or Preview test fixtures.
6. Obtain final legal/accounting approvals for exact public/vendor texts and verified
   disclosures; review each real vendor's schedule, signer, CoA applicability,
   identity, operations and bank version. Plan advance notices and renewal/revocation.
7. Separately approve production frontend deployment while ordering stays closed.
   Verify served bundle/host, rollout-off behavior, recovery and callbacks without
   creating orders or changing flags as an implicit smoke test.
8. Separately authorize publication of approved versions, exact vendor assignments,
   electronic acceptance rollout, independent compliance/bank review and explicit
   enrollment/activation of each real vendor. Preserve old records/statuses until
   the named transition decision. Verify staged prerequisites before activation.
9. Only after signed UAT, production technical/operational acceptance and a named
   release owner, separately authorize manual EFT and/or PayShap enablement. Confirm
   registered receiving capabilities, bank receipt/refund/commission SOPs and support
   capacity. PayFast/Ozow, marketing and new delivery/booking/corporate features stay off.

## Forward containment and recovery

- Before COMMIT, a failed migration transaction rolls back. Retain exact error,
  target and artifact identifiers; investigate lock/definition/state drift instead
  of changing guards or history.
- After COMMIT, prefer a separately authorized **forward** stop of new initiation
  through the audited settings/gates. Keep historical instructions, receipts,
  acceptance records, bank/profile versions, ledger, disputes and necessary callbacks
  readable/reconcilable. A client-only rollback is not backend containment.
- Never disable legal enforcement while new payments remain open, restore vulnerable
  provisioning/approval code, reopen old checkout, drop evidence tables, erase audit
  history or rewrite financial snapshots. A bad document/assignment requires a new
  reviewed version/revocation while original receipts remain retained.
- Reconcile funds received against paused/expired orders with the vendor's actual
  bank and approved refund/rescheduling process; do not force paid with direct SQL.
  Payment flags/maintenance changes need their own authorization and audit evidence.
- Whole-database restore after any real transaction can lose obligations and needs
  a separate recovery decision, tested RPO/RTO and external-bank/event reconciliation.
  Database backups alone do not restore Storage object bytes or managed configuration.

**Current gates:** local review GO; complete installer, hosted installation/UAT,
publication/acceptance, real vendor/payment activation and real-money launch NO-GO.
