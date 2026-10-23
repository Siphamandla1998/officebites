# EFT and cash validation follow-up

Current follow-up: [Phase 4 validation](phase4-local-validation-20261023.md).

Work is local only. Supervised staging UAT and production remain NO-GO.

## Commands and evidence

Use the pinned Node runtime described in the existing local runbook. Start only the workspace disposable PostgreSQL cluster at 127.0.0.1:55432. `checks/pilot/native-client.mjs` validates database, address and data directory before use.

```
node checks/pilot/native-bootstrap.mjs --reset
# Set OFFICEBITES_LOCAL_NATIVE=1 for the next command only.
node checks/checkout-database.mjs
```

The reset deletes only the disposable test database; never use this command against hosted resources. Expanded results are recorded in `.officebites-local/cash-validation-native.log`. Earlier 691 native and 662 PGlite assertions remain historical evidence, not results for newly added checks.

Executed follow-up results: native PostgreSQL **705 assertions passed**, including 77 assisted-payment assertions; PGlite **666 assertions passed**, including 64 assisted-payment assertions (`.officebites-local/cash-validation-pglite.log`). Both runs exercised injected installation failure and recovery. Native checks additionally exercised server-observed last-slot contention, changed idempotency payload rejection and rollback absence checks. The disposable PostgreSQL server was stopped. No browser, lint or build suite was rerun in this follow-up because application source did not change; prior results do not establish the missing integrated workflow.

## Recovery rehearsal additions

The candidate-installation test injects a failure before COMMIT, explicitly rolls back, checks no assisted control table exists, compares the original checkout function and historical order rows, then executes the normal installation. Cash transaction rollback checks absence of the order, receipt, booking, receivable and custody snapshot. These checks cover transactional interruption, not recovery after a committed migration. Existing security-hook recovery tests remain separate.

For committed installations: stop new entry through separately approved lock operations, retain receipt history and customer access, reconcile uncertain requests, and use reviewed forward repair. Do not drop cash constraints/tables or restore the no-hook Auth baseline as suppression. Rehearsal of committed forward repair, ownership/ACL restoration and interrupted repair remains required.

## Hosted security evidence still required

Use `docs/vendor-direct-uat-prerequisites-20261021.md` and the operator checklist as the authoritative evidence request. Obtain effective running PostgREST version, `PGRST_DB_CONFIG`, `db-pre-request`, `db-pre-config`, configuration provenance and all overrides. SQL catalog settings, local test results and HTTP 200 do not establish these service values. Request read-only service configuration through supported management access; where fields are unavailable, ask Supabase Support for the effective values and reload behaviour for project `eyhmarmekioovcjibcbr`.

After separately approved installation, prove denied REST/RPC calls for unauthorised identities, permitted allowlisted calls, stale/expired allowlists, direct endpoint bypass attempts and transaction rollback on rejection. Auth/Storage/Realtime/Edge require separate coverage; SQL role tests do not prove transport enforcement.

Notification evidence: enabled Email provider with no hook and disabled custom SMTP is not suppression. Verify saved private Send Email hook URI/enablement, capture grants/redaction and source-confirmed failure behaviour. Inventory deployed Edge Functions/secrets (names only), cron/pg_net/queues, database webhooks, MFA/SMS providers, application push/email/WhatsApp integrations and operational messaging. Prove sink or disabled delivery for every independent channel. No uncontrolled recipient probes. Unavailable hosted settings remain unresolved; retain no-provisioning and no-activation boundaries.

## EFT activation checklist

Independent approval of latest vendor bank profile; immutable recipient/amount/reference and commission agreement snapshots; unique reference and replay evidence; authorised independent bank receipt verification; customer report remains unverified; partial/overpaid/unmatched handling; approved recipient refund and cancellation process; guest token privacy; accepted PostgREST and notification evidence; reviewed migration and committed-recovery rehearsal; supervised synthetic staging order; explicit technical and operational activation approval.

## Cash activation checklist

Vendor recipient independently authorised; vendor-only scope; full prepaid receipt/order/capacity atomicity; native capacity/receipt/refund/cancellation/suspension races; stable request keys; no duplicate commission; protected customer confirmation/tracking; full assisted form browser-to-database and accessibility coverage; failed physical cash/order procedure; accepted security evidence and recovery rehearsal; supervised UAT and explicit vendor-cash approval.

Admin custody stays independently locked. Approval decisions remain: custodians and physical security, gross versus net settlement, deadlines, tax/invoice/commission treatment, partial/bank handovers, recipient acknowledgement, refund responsibility, discrepancies and finance/legal review. No settlement assumption is approved by test fixtures.

## Outstanding scope

The existing browser harness mocks RPC responses. Full assisted-order browser-to-database testing requires an isolated local transport and authenticated test identity fixture; mocked passes must not be labelled end-to-end evidence. Additional custody adversarial tests and refund/cancellation/suspension races remain necessary. Do not describe these priorities as complete until the tests execute successfully.
