# Ozow One API setup requirements — activation blocked

Latest delivery pass: CENTRAL is the default origin, with admin-approved VENDOR exceptions and an authoritative once-per-checkout delivery fee. Stored order totals remain the only payment amount source; no fee/commission history was backfilled. Ozow handlers, signatures, readiness and credentials are unchanged; no provider/deployment action occurred. Ozow remains disabled. See [CENTRAL-DELIVERY-REPORT.md](CENTRAL-DELIVERY-REPORT.md) for staging migrations and origin snapshots; merchant integration/activation requirements below still apply.

## Current adapter and secure staging setup

The earlier groundwork-only description below is historical. Attempt/receipt persistence, initiation, thin-webhook verification, atomic idempotent order confirmation and administrator reconciliation are now implemented and tested with mocks and native rollback fixtures. Staging endpoints exist but are gated off; production is explicitly refused by this release's handler.

Official contract rechecked: Hosted Checkout, TransactionCompleteFullData and GET /transactions/{id} at https://hub.ozow.com/api-reference/one-api/get-transactions-id/. `payments` scope covers token/payment/transaction operations; `webhooks` is needed only if managing subscriptions through that API. Site-restricted client and separate staging portal access must be confirmed with Ozow. Thin event ID is a transaction ID, not the hosted payment ID. Transaction GET has Successful/Incomplete/Pending/Error/Refunded status; the adapter rejects undocumented shapes. Full webhooks/legacy notifyUrl are not configured for this thin handler.

Configure **staging Supabase secret management only**, never frontend/VITE variables, Git, report values or chat:

| Variable | Required value/purpose |
| --- | --- |
| OZOW_ENVIRONMENT | staging; production refused in current handlers |
| OZOW_CLIENT_ID / OZOW_CLIENT_SECRET | One API staging client with payments scope |
| OZOW_SITE_CODE | Verified staging merchant site |
| OZOW_BENEFICIARY_REFERENCE | Merchant-approved alphanumeric bank reference |
| OZOW_RETURN_ORIGIN | Exact approved HTTPS staging frontend origin, no path/trailing slash |
| ALLOWED_ORIGINS | Comma-separated approved staging frontend origins |
| OZOW_WEBHOOK_SECRET | Endpoint's whsec_ signing secret |
| OZOW_INITIATION_ENABLED | Leave absent/false until tested and owner approved |
| OZOW_RECONCILIATION_ENABLED | Leave absent/false until signature/API setup is verified |

Platform SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY are runtime-provided; SUPABASE_ANON_KEY supports verified user lookup. Never expose service credentials. Register exactly one **thin transaction.complete** HTTPS webhook at `https://eyhmarmekioovcjibcbr.supabase.co/functions/v1/ozow-webhook`; check existing subscriptions to avoid duplicates. No webhook was registered by this task. Keep incoming verification independent from initiation availability once enabled. Reconciliation endpoint accepts only transactionId from an active authenticated administrator, never a client-declared status/amount. Configure no automatic payment/cancellation/retention schedule.

Initiate/webhook use verify_jwt=false intentionally for guest-proof checkout and Svix authentication; reconcile uses true plus administrator verification. This does not grant public receipt access: all settlement RPCs are service-only. A future move to production requires a separately reviewed environment restriction change and live release authorization.

Remaining activation requirements: staging merchant/client/site access, secure secrets, return-origin/reference agreement, verified webhook samples, sandbox hosted checkout and transaction lookup, duplicate/reordered/late events, cancellation-versus-confirmation concurrency, fee/settlement import, operator handling of ambiguous creation without a returned payment ID, refunds/compensating entries and explicit owner approval. Transaction Error is not proof the whole payment request cannot later succeed; attempts deliberately remain blocked. No actual provider cancellation or automatic retry is advertised.

Owner decisions: administrator sets delivery policy in app; R200/month subscription price; suspended-vendor re-approval requires admin. Benefits, refund/rejection rules, monthly renewal boundaries and separate re-approval fee still need definition. No commercial catalogue, subscription collection, auto-renewal, entitlement activation or automatic unsuspension is enabled. Existing marketplace/growth and basic tier values remain untouched. An approved server eligibility read model is preparation for future benefit guards, not an activated billing integration.

## Earlier onboarding checklist (historical)

Official references reviewed 16 October 2026:

- https://hub.ozow.com/integration-methods/apis/money-in/hosted-checkout/ (updated 14 October 2026)
- https://docs.svix.com/receiving/verifying-payloads/how
- https://developers.payfast.co.za/api (PayFast reconciliation is provider-specific; subscription cancellation is not once-off checkout cancellation.)

Required before wiring/deploying a transacting integration:

1. Merchant approval and One API Clients access, separately for staging and production.
2. Client ID/client secret with payments scope, merchant site code and site restriction confirmed. Supply secrets through Supabase's secret manager, never Git/chat/browser env. No credential is requested in chat.
3. Confirm beneficiaryReference requirements and allowed reference lengths against the merchant/site contract; use a stable server-generated reference.
4. Register HTTPS staging webhook(s), select transaction.complete, choose thin/full knowingly, retrieve the endpoint's whsec_ signing secret. Confirm retries, timestamps, event payload and replay samples. Do not configure both legacy notifyUrl and webhooks without deduplication.
5. Server-owned attempts with immutable expected amount/currency/site/order reference, provider payment ID, provider transaction ID and Svix delivery-ID uniqueness. Retain an ambiguous request after network failure and reconcile before retry. A thin successful webhook alone lacks the values needed to credit an order.
6. A reviewed provider-neutral confirmation transaction is still required, including commission snapshot/processor fee behavior and duplicate/late payment handling. Existing confirm_payfast_payment and payfast_itn_log must not be reused by fabricating PayFast IDs.
7. Hosted staging creation, cancellation using the returned cancel link, transaction reconciliation, duplicate/tampered/wrong amount/currency/site/reference and late-event tests. Only then mark Ozow ready and approve enabling it.

Verified endpoints: staging https://stagingone.ozow.com/v1; production https://one.ozow.com/v1. Token POST /token uses form client_id, client_secret, grant_type=client_credentials, scope=payments. Hosted POST /payments returns id, status Created, redirectUrl and links. The returned redirectUrl is used rather than assembled. Token expiry comes from expires_in. Reconciliation GET /payments/{id}/transactions requires fromDate/toDate. Cancellation uses returned links.cancel, not guessed subscription endpoints. One API transaction.complete statuses are Successful, Incomplete, Pending and Error; these differ from transaction API statuses. Cancelled may arrive as Error. Signatures cover the original raw body, Svix ID and timestamp; skew checking does not replace persistent deduplication.

The checked-in helper is mocked groundwork only. No Ozow Edge endpoint, production setting, real token acquisition, payment creation, webhook subscription or financial credit is performed. Gateway starts disabled/unready and administrators cannot mark it ready from the browser.

## Vendor subscription contract to approve

Existing plan enum marketplace/growth and current vendor pricing remain unchanged. Required decisions: saleable plan IDs/prices/currency, tax, term/expiry, renewal method (One API subscriptions scope/product requires separate confirmation), benefits per plan, upgrades/downgrades, rejection/refund policy and grace period. A paid subscription must have separate immutable payment receipt and approval state. Intended lifecycle: unpaid → processing → paid_pending_approval → approved, with independent rejected/expired/suspended states. Only a service-confirmed provider receipt can mark paid; only an active administrator may approve/reject. Benefits require paid AND approved AND not expired/suspended/archived on every privileged server operation. Record corrections through audited compensating events, not overwritten receipts. No paid-plan activation is implemented before those contracts are verified.
