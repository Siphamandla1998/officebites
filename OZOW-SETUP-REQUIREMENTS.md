# Ozow One API setup requirements — activation blocked

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
