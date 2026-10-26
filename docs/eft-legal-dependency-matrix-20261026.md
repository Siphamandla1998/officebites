# EFT-only / legal B–E dependency and compatibility matrix

26 October 2026. **No combined migration sequence is approved.** Read-only source
comparison; neither worktree was merged. Payment HEAD remains
`4cac836a35ef0e75e589a2640772f775ca1a260c`. B–E files below are local candidates
in `C:/Users/Siphamandla.Khumalo/Documents/officebites-legal`, not changes to the
payment branch or evidence of hosted installation. Hosted absence/history here
is inherited from the prior reports, not a fresh schema inventory in this handoff.

## Artifact identity and dependency graph

| Candidate / exact source | Depends on | Effect / compatibility decision |
|---|---|---|
| EFT security: `checks/uat/staging-security.sql` | Existing account helpers, manual schema, Supabase roles/Storage context | Wraps `private.active_account`; defines REST gate and Auth capture, attaches neither; closes authenticated access by default. Requires service/isolation and maintenance acceptance |
| EFT booking: `checks/pilot/booking-candidate.sql` | Existing order/vendor/commercial helpers | Private R0 policy, destination/window/booking and commercial agreement foundations. No signed vendor-specific legal acceptance is created |
| EFT atomic: `checks/pilot/atomic-collection-candidate.sql` | Booking + installed manual/order/financial helpers; security included in package first | Atomic collection/manual-order/booking/financial/outbox evidence, expiry/settings interlock and commission snapshot patch. Does not implement B–E |
| B: `supabase/migrations/20261026073911_phase_b_vendor_security_activation.sql` in legal worktree | Existing legal/corporate and manual-payment frameworks | Replaces signup metadata handling; forces pending/nonprivileged vendor creation; adds `vendor_activation_requirements`, immutable reviews and `vendor_activation_ready` guard. Needed security boundary; not supplied by EFT installer |
| C: `supabase/migrations/20261026091408_phase_c_vendor_agreement_assignments.sql` in legal worktree | B + existing versioned legal framework | Adds vendor scope, immutable `vendor_legal_assignments`, assigned agreement acceptance and activation wrapper; rollout default false. Reuses immutable acceptance, no second acceptance system |
| D: `supabase/migrations/20261026101346_phase_d_vendor_compliance.sql` in legal worktree | B → C; actual Storage schema, bucket and RLS support; existing banking RPCs | Adds compliance submissions/events, private uploads, independent review, pending banking, expiry/revocation and new-order/restoration gates; replaces banking submit/method-read behavior |
| E: `supabase/migrations/20261026112602_phase_e_legal_publication_checkout_evidence.sql` in legal worktree | B → C → D and commercial framework | Publication approval/evidence, `order_legal_acceptances`, deferred customer order gate, legal checkout/guest receipt wrappers. Collection is optional and discovered by exact RPC signature; it is not a hard prerequisite for E's ordinary manual path |

EFT order inside one candidate transaction is **security → booking → atomic**.
Legal prerequisite order is **B → C → D → E**. These two chains are not a certified
combined order: shared definitions, locks, triggers and frozen fingerprints must
be reconciled in a new reviewed artifact. No installer should be executed from this matrix.

EFT candidate: `supabase/staging-release/20261026-eft/`, proposed name
`officebites_staging_eft_locked_20261026`, `notApproved=true`.
Installer SHA-256 `b80909ae1978d57323bce1093761197ad582d33384ee28016935286989cc9e4b`;
logical digest `0f65603281048631d437ef436272762b232763d1af57dabf094a97ae6f22deac`.
Exact request is `apply-migration-request.json` in that directory; review data only.
The broad `20261023` security/booking/atomic/assisted/custody installer is an
alternative, not an additional dependency. Both remain unapproved.

## Cross-system compatibility decisions still open

| Boundary | Actual overlap / conflict | Required evidence before accepting a combined artifact |
|---|---|---|
| Frozen baseline and ledger | EFT preflight rejects B/C/D/E roots, existing broad/partial schema and selected definition/ACL/settings drift. Retry compares all public/private function fingerprints against immutable install evidence | Full definition/owner/ACL/default-privilege/trigger/policy diff and new approved forward artifact. B–E first makes EFT preflight fail; B–E after EFT changes its retry fingerprint. Do not bypass checks, overwrite immutable ledger or merely replace expected hashes |
| Signup / vendor activation | EFT account allowlisting is not B's metadata privilege remediation. B vendor triggers gate creation/activation; C/D progressively extend readiness | Metadata admin/privileged-role denial; pending/default vendor creation; owner transfer, direct-update/restore denial, explicit legacy exception inventory. Never reopen signup on the strength of a payment gate alone |
| Commercial versus legal agreements | EFT `collection_agreements` and `collection_financials` record checkout rate/version/revision; C uses assigned approved legal versions, exact vendor-specific schedule hashes and immutable signer acceptance | Mapping between exact accepted schedule/version and collection pricing, approved document/notice evidence and server identity/time. A commission snapshot is not assent or sign-off. Keep draft publication/acceptance disabled |
| Pending vendor banking | Current payment `manual_operator` permits approved owner/admin; pending owner self-submit is unavailable. D replaces `public.submit_vendor_payment_profile` with scoped compliance access, while receipt/verification permissions stay separate | Pending owner can submit only own pending evidence without selling privileges; independent active admin approval; denied cross-vendor/reviewer forgery; private reads and immutable audit. Do not approve a store just to unlock banking |
| Profile selection and revocation | EFT captures approved recipient profile in order financial/payment snapshots. D adds `bank_compliance_valid`, latest compliance event identity/expiry and restricted `get_vendor_manual_methods` wrapper | Determine authoritative eligible profile with changed/revoked/latest-submitted versions, ties and ownership transfer. New checkout fails stale evidence; historical recipients/receipts remain unchanged. Broad assisted package's extra revision/revocation journal is excluded here; review separately if chosen |
| New orders / legacy transitions | D `compliance_new_order` runs before suborder insertion for enrolled sellers; `compliance_legacy_approval` requires same-transaction audited activation/legacy transition. EFT inserts suborders during atomic manual creation | Native combined transaction tests: expired/revoked compliance or banking blocks new orders without partial request/booking/finance/outbox rows; no broadened legacy exceptions; preserve old orders and explicit restore decisions |
| Customer and guest legal evidence | E deferred `customer_legal_order_gate` requires an order receipt when customer legal rollout is enabled. `create_order_with_legal` calls collection dynamically and adds receipt in same transaction; payment Checkout lacks this envelope | Reviewed UI/service integration, exact approved versions, guest token privacy, replay/version-change/interrupt behavior; direct/manual/collection bypass denial. Assisted/cash/conversion paths remain closed until equivalent evidence is reviewed; do not disable gate to pass |
| Locks / concurrency | E locks request, sorted vendors, then commercial admin; D readiness/admin review uses commercial/vendor locks; EFT adds booking/window/payment/commission locks | Native lock-order and race evidence for approval, publication, assignment, owner/bank changes, last capacity, cancel/refund and expiry. No deadlock, partial order or stale approved evidence. Existing separate-branch passes are not combined proof |
| SQL owners, RLS and services | Security changes active-account behavior; D requires private Storage operations; E/C expose narrowly granted wrappers; inherited core uses `search_path=public` | Complete owners/ACLs/defaults/column grants/policy/view/trigger review and effective REST/Auth/Storage/Realtime denial matrix. Private-schema USAGE is not row permission; definer RPCs require individual review |
| Recovery / preserved history | Frozen EFT containment closes gates but does not revert legal versions, acceptances, audit or managed config; backups omit Storage object bytes | Reviewed forward containment for the chosen combined design, historical fingerprint/evidence preservation, separate Storage/config restore drill and signed maintenance acceptance. No destructive legal/payment schema rollback |

## Hosted history compatibility

Known semantic installations must not be replayed using local timestamp variants:

| Dependency | Hosted version recorded | Local migration version |
|---|---|---|
| legal_corporate_framework | 20261016095620 | 20261016094201 |
| commercial_reporting_contract_locks | 20261016100710 | 20261016100142 |
| repair_order_policy_helper_access | 20261016103515 | 20261016101707 |
| vendor_direct_manual_payments | 20261020100740 | 20261020090841 |
| fix_admin_manual_settings_singleton | 20261021100655 | 20261021094956 |

Other checkout/booking/Ozow/origin discrepancies are listed in the P0 resolution
report. Match definitions and real objects, not just names/timestamps. No blanket
`db push`, fictitious history rows, migration renaming or duplicate semantic install.
Full schema differences and a native-compatible baseline remain P0-06 evidence.

## Review outcome

Engineering/Security must choose either a deliberately closed installation-only
scope with an explicit legal integration hold, or a separately authorized future
combined artifact. Neither choice permits provisioning/UAT/real selling now.
Legal/Compliance must review the pending-bank flow, assignments, current acceptance,
reviewer independence and legacy inventory. Operator/Support evidence and backup/
maintenance acceptance remain independent prerequisites for either choice.

No approved legal text, signed schedule or compliance decision is fabricated here.
Fee approval remains 15% + 2% excluding applicable VAT; marketing 5/7.5/10% flat tiers
remain disabled pending attribution/accounting rules. Vendor-direct settlement does
not establish automatic refunds, provider splits, instant settlement or invoicing.
All payment/acceptance/marketing activation decisions remain separate.

Source context: [P0 report](eft-p0-resolution-20261026.md),
[read-only report](eft-readiness-readonly-20261026.md), and the B–E reports under
`../officebites-legal/docs/phase-{b,c,d,e}-*.md` (filesystem paths relative to the
payment workspace root, not migration imports). Actual SQL reviewed read-only.
Action owners/evidence statuses: [operator runbook](eft-operator-runbook-20261026.md).
