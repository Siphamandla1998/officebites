# Ozow staging readiness — 19 October 2026

## Source reconciliation and local commit — 19 October 2026

Retrieved all three staging v4 ACTIVE function bundles through authorised read-only management access. Compared each entrypoint plus `_shared/ozow-handlers.ts`, `_shared/ozow.ts` and `_shared/ozow-runtime.ts` against local files: **12/12 exact text matches, including line endings**. No source drift was found. Deployment version metadata is v4; this task did not deploy it. Evidence: ignored `.officebites-local/ozow-v4-readback.json` and `ozow-v4-comparison.json`.

Reviewed the complete staged/unstaged/untracked Git inventory. Index was initially empty. The only nonignored untracked file was this report. No exposed credentials were found through diff/content review and credential-pattern scanning; mock credentials/signing material in tests are explicitly synthetic. Scope for the local commit is this report, `supabase/functions/_shared/ozow-handlers.ts`, `checks/ozow-integration.mjs`, `checks/ozow-subscription-database.mjs` and `checks/checkout-browser.spec.mjs`. The existing release-report update covers earlier deployment/UX work and is preserved **unstaged**, byte-identical at SHA-256 `BFF59A97F6217077E2106AD3C60C867D7193781359970B295246E9305432E5BB`. The payment-validation report has no diff and is untouched.

Fresh validation before committing:

- `node checks/verify-local.mjs`: **passed**, including 120 mocked Ozow handler assertions, 50 isolated Ozow receipt/subscription/role assertions and the full existing local suite. No hosted writes or provider calls.
- `deno check --frozen supabase/functions/ozow-initiate/index.ts supabase/functions/ozow-webhook/index.ts supabase/functions/ozow-reconcile/index.ts`: **passed**.
- Repository `oxlint`: **passed**, nine warnings in unchanged hook/context files. Initial lint launcher could not locate Node; rerun with the available Node runtime on PATH passed.
- `node checks/verify-browser.mjs checkout-browser.spec.mjs --grep Ozow`, `PLAYWRIGHT_CHANNEL=msedge`: harness build **passed**, **3/3 Edge tests passed**, covering action lock/ambiguous initiation, gateway visibility and navigation-only return/cancellation/failure/success parameters remaining unpaid. Synthetic fixtures do not establish merchant readiness.
- Git whitespace checks: **passed**; line-ending conversion notices are informational.

Commit subject: `fix(ozow): reconcile staging CORS guards and readiness regressions`. Its SHA is intentionally reported in the final task response rather than embedded in its own committed content: adding the resulting SHA would require another commit or leave an unnecessary report edit. Resolve it later with `git log -1 --format=%H -- OFFICEBITES-OZOW-STAGING-READINESS-20261019.md`.

No push, deployment, staging configuration write, provider request, activation or production change is authorised/performed by this reconciliation. Activation blockers in the audit below remain unchanged. Historical no-commit statements below describe their original verification phases.

## Final configuration audit — 19 October 2026

**Activation remains blocked. No remaining merchant secret is confirmed missing or incorrectly configured: its presence/value is inaccessible with current authorised access.** The two runtime flags are not exactly `true`; keeping these gates closed is appropriate until merchant prerequisites are verified. Do not enable them to discover the next error.

Fresh staging management readback shows **ozow-initiate v4 ACTIVE, ozow-webhook v4 ACTIVE, ozow-reconcile v4 ACTIVE**, superseding the supplied v3 baseline. Their retrieved source retains the staging project/environment guards, exact stable-origin CORS, signature checks and authoritative reconciliation described below. JWT settings remain false/false/true. This audit did not deploy these versions or establish who deployed them.

Approved stable Preview origin (and required return-origin comparison target): `https://officebites-git-feat-legal-vendor-da31dd-sp24tg-6983s-projects.vercel.app`. The source adds this exact alias only for staging project `eyhmarmekioovcjibcbr`; it does not add temporary deployment URLs or wildcard origins. This audit confirms the handler's effective authorisation, not the raw allowlist secret or a fresh Vercel alias-to-deployment mapping.

### Requirement-by-requirement decision

Passed means the stated check has evidence; blocked means access or an earlier guard prevents verification; unverified means provider-supported evidence is still outstanding. No failed merchant configuration is asserted without evidence.

| Requirement | Status and evidence | Exact action required | Merchant assistance needed? |
| --- | --- | --- | --- |
| Runtime SUPABASE_URL points only to staging | **Passed:** fresh empty POST reaches the flag guard after exact project validation. | Preserve staging-only guard; do not change production. | No. |
| OZOW_ENVIRONMENT exactly `staging` | **Passed:** same response proves exact environment check passed. | Preserve current selector. | No. |
| Stable-origin CORS; consistent OPTIONS/POST | **Passed:** fresh OPTIONS 200 and empty POST 503 both echo exact stable origin; foreign OPTIONS 403 has no Allow-Origin. Retrieved handler uses the same effective list for OPTIONS and POST. | Preserve restrictions. | No. |
| Raw ALLOWED_ORIGINS presence and contents | **Blocked:** connected tools have no Edge secret inventory operation; effective source fallback does not prove this variable exists or contains the alias. | Staging secret administrator privately inspect presence and exact comma-separated entries; record only pass/fail metadata. | No; staging administrator. |
| OZOW_INITIATION_ENABLED | **Passed as a closed safety gate; blocked for operation:** 503 `Ozow remains disabled`. Absent, false and malformed values cannot be distinguished. | Administrator privately record presence/exact-value comparison. Leave unchanged until remaining prerequisites are verified. | No; staging administrator. |
| OZOW_RECONCILIATION_ENABLED | **Passed as a closed safety gate; blocked for operation:** unsigned webhook returns 503 `Ozow reconciliation not configured`. Exact stored value/presence inaccessible. | Same private inspection; do not enable yet. | No; staging administrator. |
| OZOW_CLIENT_ID | **Blocked:** presence inaccessible behind flag guard; no secret-management access. | Confirm present and issued for this merchant's One API staging client, without disclosing value. | Yes, merchant/Ozow plus staging administrator. |
| OZOW_CLIENT_SECRET | **Blocked:** presence inaccessible; validity unverified. | Confirm present, current and paired with staging client ID through secure management. Do not paste credentials into reports/chat. | Yes. |
| OZOW_SITE_CODE | **Blocked:** presence and client-to-site authorisation unverified. | Confirm staging site belongs to merchant and client may initiate and query its transactions. | Yes. |
| OZOW_BENEFICIARY_REFERENCE | **Blocked:** presence/format/merchant approval inaccessible. | Confirm present, nonempty alphanumeric as required by current adapter, and approved for this merchant/site. | Yes. |
| OZOW_RETURN_ORIGIN | **Blocked:** actual runtime value inaccessible; CORS does not verify it. | Privately compare to the exact stable origin above, HTTPS with no path/trailing slash. Handler appends `/orders/{orderId}`; confirm provider accepts those return URLs, including any required registration. | Yes for provider approval; administrator for runtime value. |
| OZOW_WEBHOOK_SECRET | **Blocked:** presence, format and correspondence to provider subscription inaccessible. | Confirm privately that deployed signing material matches the staging subscription and current `whsec_`/Svix signature contract. Do not generate/invent replacement credentials for this audit. | Yes. |
| Platform SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY | **Unverified for authenticated Ozow/RPC operations:** responding handler alone does not demonstrate valid privileged RPC access or caller validation. | Authorised administrator verify platform provisioning; later run authorised staging role/ownership tests without exposing keys. | No; staging administrator/integrator. |
| Merchant One API staging permissions | **Blocked:** no authenticated merchant dashboard, provider entitlement evidence or merchant connector available. Public documentation/source cannot prove account permissions. | Obtain merchant/Ozow confirmation of staging client-credentials `payments` scope, hosted payment creation and transaction lookup rights for the site, plus supported non-real-money test scenarios. Legacy credentials are not evidence of One API rights. | **Yes.** |
| Webhook endpoint implementation | **Passed for endpoint/guard only:** staging `ozow-webhook` v4 ACTIVE responds safely; actual delivery is unverified. | Use `https://eyhmarmekioovcjibcbr.supabase.co/functions/v1/ozow-webhook` for the staging subscription; preserve signature validation and originless provider delivery. | Yes for registration. |
| Provider webhook registration and contract | **Blocked:** actual registration, event format, enabled state and signing key correspondence unavailable. Source expects thin `transaction.complete`, Svix headers/raw-body HMAC and five-minute timestamp tolerance. | Merchant confirm matching staging endpoint/event contract with Ozow; obtain provider-supported signed test delivery evidence, retries/replay evidence and authoritative transaction lookup. If provider contract differs, review implementation before activation. | **Yes.** |
| Active-admin reconciliation protection | **Passed for platform unauthenticated rejection:** fresh request returns 401. Handler additionally checks active administrator profile. Authenticated positive/negative paths remain unverified in this audit. | Retain both controls; verify authorised staging admin and denied non-admin/suspended cases before activation. | No; administrator/integrator. |
| Provider-supported initiation, return, failure/cancellation, webhook and reconciliation | **Unverified; deliberately not attempted.** No provider token/payment/lookup request was made. Existing mock tests are not merchant integration evidence. | After access/configuration and merchant prerequisites are documented, approve a controlled non-real-money test plan and runtime gate changes separately. Include pending/failed returns, signed replay, mismatched amount/site/reference, deduplication and verified successful settlement. | Yes. |
| Database/customer availability gate | **Passed as closed:** fresh `public.get_payment_gateways()` returns Ozow enabled=false, ready=false, maintenance=false, unchanged timestamp `2026-10-19T07:12:50.238376+00:00`. | Keep disabled/not ready; final active-admin approval only after all readiness evidence is complete. Do not mark ready merely to show a button. | Authorised administrator approval required. |

### Remaining activation sequence

1. Staging administrator supplies only non-sensitive presence/format/comparison results for the blocked variables. Merchant/Ozow supplies staging entitlements, return acceptance, webhook registration and supported test procedures. **This is the next exact blocker; inaccessible does not mean missing.**
2. Review those results before approving any runtime flag change or provider request. Current task authorises neither. Never submit a valid-looking order ID merely to probe configuration: the handler acquires a provider token before the database attempt/readiness RPC.
3. Execute separately authorised provider-supported staging tests; prove browser initiation/return cannot mark Paid and that only verified server-side matching confirmation records settlement. Verify cancellation behaviour explicitly; this adapter exposes no provider cancel-link operation, so do not claim bank/payment cancellation from cancelling an unpaid app order.
4. Complete webhook/reconciliation and role regression evidence, then obtain authorised administrator activation approval through reviewed controls. If the existing control cannot attest readiness safely, review that workflow rather than directly overriding database readiness.

### Evidence, preservation and limits

Fresh safe-probe evidence: `.officebites-local/ozow-final-configuration-audit-result.json`. Six probes passed their expected closed-gate/CORS/auth assertions: stable and foreign OPTIONS, stable and originless empty initiation, unsigned empty webhook, unauthenticated reconciliation. No identifiers, valid signatures or credentials were submitted. The reconcile platform 401 includes its own wildcard CORS header; it does not establish handler allowlist behaviour or expose a successful protected operation.

Authorised management evidence: staging function list plus all three deployed source readbacks, and read-only `public.get_payment_gateways()`. PayFast now reads enabled=true, ready=true, maintenance=false, updated `2026-10-19T12:40:04.100616+00:00`; that differs from the historical observation below and was not changed by this audit. PayFast readiness itself was outside this audit.

No secret-management/metadata tool, local Supabase CLI/management credential or authenticated merchant access is available in this session. No database/Vault workaround or public diagnostic endpoint was used. Therefore there is no basis to classify the remaining secrets as missing or incorrect. Frontend/browser mapping evidence below is historical; no new visual or provider flow was tested in this configuration-only audit.

Only this report was updated; prior report history is retained below. Existing modified source, tests and release report remain uncommitted and must be included in a separately reviewed commit before a future release. No source/configuration edit, gateway write, provider call, deployment, commit or push was performed. Full regression/build/visual suites were not rerun for this report-only update.

## Previous environment verification (retained history)

**OZOW_ENVIRONMENT now passes the exact `staging` runtime check. Ozow remains disabled/not ready. The next observed guards are disabled initiation and unconfigured reconciliation; remaining merchant configuration is not yet verifiable.** This follow-up supersedes the earlier missing-environment finding below.

Only staging Supabase `eyhmarmekioovcjibcbr` was queried/probed. No source, test, secret, function deployment, gateway state, payment or production setting was changed in this verification. All prior uncommitted work is preserved.

### Actual deployed version and source

Current readback shows **ozow-initiate v3 ACTIVE**, **ozow-webhook v3 ACTIVE**, **ozow-reconcile v3 ACTIVE**. This differs from the v2 handoff; this task did not deploy v3 and does not infer why the version changed. All four files per function match the existing reviewed local source after line-ending normalisation. JWT settings remain false/false/true respectively.

The deployed guards first require the exact staging project URL and environment selector, then test the relevant runtime enable flag, then inspect merchant credentials. The safe responses now reach the flag checks, positively proving that both project and environment checks passed.

### Safe runtime results

| Request | Actual result | What it proves |
| --- | --- | --- |
| Stable alias OPTIONS to ozow-initiate | **200**, exact matching Allow-Origin | Effective staging allowlist authorises the approved stable alias. |
| Unapproved-origin OPTIONS | **403**, no Allow-Origin | Foreign-origin rejection remains intact. |
| Stable alias empty `{}` POST to ozow-initiate | **503**, `Ozow remains disabled`, exact matching Allow-Origin | Exact staging environment is recognised; OZOW_INITIATION_ENABLED is not exactly `true`. |
| Originless empty POST to ozow-initiate | **503**, `Ozow remains disabled` | Same configuration gate independent of browser origin. |
| Unsigned empty POST to ozow-webhook | **503**, `Ozow reconciliation not configured` | Exact staging environment is recognised; OZOW_RECONCILIATION_ENABLED is not exactly `true`. |
| Unauthenticated empty POST to ozow-reconcile | **401**, missing authorization header | Platform JWT protection still rejects unauthenticated reconciliation. This response does not inspect its internal configuration. |

No valid order ID, webhook signature or transaction ID was provided. These requests cannot reach provider token acquisition, hosted payment creation, transaction lookup or receipt recording. No provider request was made.

### Remaining configuration findings without values

| Setting | Current verified finding |
| --- | --- |
| SUPABASE_URL | Exact intended staging runtime URL guard passes. |
| OZOW_ENVIRONMENT | **Recognised as exactly `staging`**; earlier missing-variable blocker is resolved. |
| OZOW_INITIATION_ENABLED | **Not exactly `true`**. Runtime response cannot distinguish absent, false or another invalid value. Left unchanged; keeping initiation closed is appropriate while merchant prerequisites are unverified. |
| OZOW_RECONCILIATION_ENABLED | **Not exactly `true`**, observed through webhook handler. Presence/false/invalid distinction remains unavailable. Left unchanged. |
| ALLOWED_ORIGINS | **Effective stable-origin authorisation passes** through the reviewed staging source addition. Raw environment-variable presence/value remains inaccessible; do not claim the secret itself contains that alias. |
| OZOW_RETURN_ORIGIN | **Unverified**. Presence and exact match cannot be inspected because the earlier flag gate refuses the request. Required comparison target is `https://officebites-git-feat-legal-vendor-da31dd-sp24tg-6983s-projects.vercel.app`, no trailing slash/path. No merchant return approval is inferred from CORS. |
| OZOW_CLIENT_ID | **Presence unverified**, not declared missing. |
| OZOW_CLIENT_SECRET | **Presence unverified**, no credential value exposed. |
| OZOW_SITE_CODE | **Presence and merchant/site permissions unverified**. |
| OZOW_BENEFICIARY_REFERENCE | **Presence and merchant approval unverified**. |
| OZOW_WEBHOOK_SECRET | **Presence, webhook registration and signing/delivery evidence unverified**. |

Current connected tools still provide no Edge-secret metadata/management operation, no local Supabase CLI/management credential is available, and no authenticated Ozow merchant access is available. No flags were changed to probe deeper, and no public diagnostic inventory was added. Complete the remaining presence/format checks through authorised staging secret management and merchant access before any provider request or flag activation.

### Gateway state, evidence and committing

Actual database read remains **Ozow enabled=false, ready=false, maintenance=false**. PayFast remains **enabled=true, ready=true, maintenance=true**. No gateway update RPC or database write was executed.

Evidence: `.officebites-local/ozow-environment-verification-result.json` and `.officebites-local/ozow-environment-browser-result.json`. The browser check uses safe empty requests and public staging reads; it does not submit checkout or authenticate a merchant.

Pre-existing modified source/test/release-report files were hashed before and checked after this task. They must still be committed with the reviewed readiness-report update before a future release so Git records the already-deployed handler changes and regression coverage. No commit, push or deployment is performed merely to verify environment state. Starting/ending branch HEAD remains `9b1623680afe6530c7282ed2be6754cd4947d373`.

**Next exact blocker:** the two runtime flags refuse initiation/reconciliation, while credential presence, approved return origin and merchant/webhook prerequisites cannot yet be verified through current authorised access. Do not turn the flags on just to expose the next error; verify those prerequisites securely first. Gateway readiness and activation remain prohibited until all gates pass.

## Previous configuration remediation outcome (retained history)

**CORS repaired in staging. Activation remains blocked: OZOW_ENVIRONMENT is confirmed missing. Ozow remains disabled/not ready.** This section supersedes the pre-repair findings retained below.

### Exact deployment and changes

Verified stable origin: **https://officebites-git-feat-legal-vendor-da31dd-sp24tg-6983s-projects.vercel.app**. Alias still resolves to READY deployment `dpl_ZGxYvQjxdGY74s7Lhx1J1RVEQEvz`, frontend commit `9b1623680afe6530c7282ed2be6754cd4947d373`.

Reviewed change in `supabase/functions/_shared/ozow-handlers.ts`:

- Preserve the configured ALLOWED_ORIGINS entries and append only the exact stable origin when the runtime SUPABASE_URL exactly equals the intended staging project. No localhost, wildcard or temporary deployment is appended. This is an explicit source-controlled staging allowlist addition, **not** a change to the inaccessible ALLOWED_ORIGINS secret.
- OPTIONS, response CORS headers and POST validation use the same effective list.
- Split the combined staging guard into non-sensitive codes for absent/mismatched project URL and missing/invalid environment selector. No configuration value, secret presence inventory, credential or token is returned. No staging default or bypass is introduced.
- Other files in each deployed function were compared with the previous deployed version and were unchanged. Auth, signature, amount/site/reference reconciliation and gateway readiness controls are preserved.

Deployed only to staging `eyhmarmekioovcjibcbr`:

| Function | Version/state | JWT setting |
| --- | --- | --- |
| ozow-initiate | **v2 ACTIVE** | false, unchanged; own guest/user proof remains required |
| ozow-webhook | **v2 ACTIVE** | false, unchanged; signature validation remains required |
| ozow-reconcile | **v2 ACTIVE** | true, unchanged; active administrator validation remains required |

All four files per function match reviewed local source after line-ending normalisation. No PayFast function, frontend deployment, migration, gateway setting or secret was modified. No Git commit/push was made during this remediation.

### Verified browser and HTTP results

- Before repair: stable alias OPTIONS and POST both **403**, no matching Allow-Origin.
- After repair: stable alias OPTIONS **200**, exact matching Allow-Origin. Empty POST **503** with the same Allow-Origin and `code=OZOW_ENVIRONMENT_MISSING`.
- Supplied temporary deployment URL and foreign-origin controls still return **403** for both OPTIONS and POST; neither receives an Allow-Origin.
- Actual Microsoft Edge browser on the stable alias: CDP recorded automatic **Preflight 200**, followed by **Fetch 503**. JavaScript could read the configuration error response. Both responses carried the exact stable origin. Empty `{}` payload has no order identifier and cannot trigger token acquisition, payment creation or a payment-status transition.
- Originless initiate and webhook probes both return **OZOW_ENVIRONMENT_MISSING**, proving the runtime project guard passed and the environment selector is absent (undefined), rather than present with an incorrect value. Reconcile still returns platform **401** without authentication.
- Fresh deployed-client check contains staging URL, no production project URL. Actual checkout gateway read goes to `eyhmarmekioovcjibcbr.supabase.co`; empty checkout still renders.

### Current non-sensitive configuration findings

| Setting | Exact verified finding |
| --- | --- |
| Runtime SUPABASE_URL | Matches intended staging project; explicit guard passes. |
| OZOW_ENVIRONMENT | **Missing**, not merely an unknown combined mismatch. Required value is `staging`; not set by this task because current tools do not provide authorised secret management. |
| ALLOWED_ORIGINS | Raw value/presence cannot be inspected. Before repair it did not authorise stable alias; effective source-augmented staging list now does. Other configured entries are preserved. |
| OZOW_INITIATION_ENABLED | **Unverified**, no value assumed. Environment gate fails before this check. |
| OZOW_RECONCILIATION_ENABLED | **Unverified**, no value assumed. Environment gate fails before this check. |
| OZOW_CLIENT_ID | **Unverified**; missing versus existing cannot be distinguished with current access. |
| OZOW_CLIENT_SECRET | **Unverified**; no credential value retrieved or exposed. |
| OZOW_SITE_CODE | **Unverified**, including merchant/site permissions. |
| OZOW_BENEFICIARY_REFERENCE | **Unverified**, including merchant approval. |
| OZOW_RETURN_ORIGIN | **Unverified**. It must be the approved exact HTTPS origin, without path/trailing slash; effective allowlist alone is not provider return-URL approval. |
| OZOW_WEBHOOK_SECRET | **Unverified**; registration, signing material and delivery evidence unavailable. |

There is no Edge-secret-management tool in the connected Supabase interface and no local management credential or authenticated merchant session available. The diagnostic change deliberately distinguishes only non-sensitive failing environment conditions; it does not publish a public secret inventory. Required next action through authorised staging secret management is to set the missing environment selector, then verify remaining flags/credentials and merchant permissions. Do not substitute a code default or infer readiness from CORS.

### Activation gates and verification

1. CORS: **passed** for the verified stable alias.
2. Staging project validation: **passed**. Environment selector validation: **blocked, missing selector**.
3. Merchant staging credentials/permissions, return approval and webhook registration: **blocked, authorised access unavailable**.
4. Provider-supported initiation: **not attempted**, no verified merchant staging setup.
5. Webhook validation/reconciliation and genuine payment transitions: **unverified**, no fake success was submitted.
6. Administrative activation approval/readiness: **not performed**. Database Ozow settings remain **enabled=false, ready=false, maintenance=false**.

Current PayFast settings read **enabled=true, ready=true, maintenance=true**, as observed before this phase; no PayFast setting was changed. Its maintenance state differs from the earlier audit below. Existing checkout availability continues to follow those settings.

Expanded `checks/ozow-integration.mjs` covers stable-origin OPTIONS/POST consistency, temporary/foreign rejection, absence of implicit origin allowance in other projects, missing versus invalid environment codes and no provider/RPC traffic on refused configuration. **120 mocked Ozow assertions passed**; full isolated regression suite passed. Frozen Deno checks for all three entrypoints, targeted lint and whitespace checks passed. Prior browser/UI regressions are retained; no frontend source changed in this phase. New actual browser CORS and checkout/bundle-isolation checks passed. An initial browser recorder with Playwright routing omitted the preflight event; recording without request interception captured the genuine preflight and passed. This was a harness correction, not a deployment failure.

Evidence: `.officebites-local/ozow-remediation-before.json`, `ozow-remediation-after.json`, `ozow-cors-browser-result.json`, `ozow-cors-browser-verified.log`, `ozow-cors-remediation-regressions.log`. Existing uncommitted release report remains unchanged at SHA-256 `BFF59A97F6217077E2106AD3C60C867D7193781359970B295246E9305432E5BB`. Production, corporate/delivery activation, legal publication, historical payments and cutoff remain untouched.

## Original pre-remediation readiness audit (retained history)

**Not safe to enable. Ozow remains disabled/not ready. No production or hosted configuration was changed.**

Branch `feat/legal-vendor-corporate-acquisition`, HEAD `9b1623680afe6530c7282ed2be6754cd4947d373`. Existing uncommitted OFFICEBITES-PREVIEW-RELEASE-20261016.md is preserved. This pass adds regression tests and this report only; no application/Edge implementation, secret, readiness flag, order or payment status is edited.

## Verified blockers

1. **CORS rejects the intended Preview origin.** Actual staging `ozow-initiate` OPTIONS from the verified stable branch alias returns **403**, no Access-Control-Allow-Origin. Empty POST from that alias returns **403 Origin not allowed**. The immutable Preview URL also fails CORS. The foreign-origin negative control is correctly rejected. The stable alias is not in the effective ALLOWED_ORIGINS; its complete value is unavailable.
2. **The staging environment guard fails.** Empty, originless requests to staging `ozow-initiate` and `ozow-webhook` return **503 Staging configuration required**. Deployed source requires BOTH `OZOW_ENVIRONMENT === 'staging'` and `SUPABASE_URL === 'https://eyhmarmekioovcjibcbr.supabase.co'`. At least one condition fails; current access cannot distinguish which value is missing/mismatched. Do not infer credential absence or later flag values from this early refusal.
3. **Merchant and webhook readiness cannot be verified with current access.** Connected Supabase tools expose deployed source and database queries, but no Edge secret-management operation. No local Supabase CLI or management/Ozow environment credentials were available. No authenticated Ozow merchant session is available. No credential values were requested, printed or copied.

The hidden option is therefore intentional and correct, rather than missing frontend support.

## Current deployment, UI and permissions

- Stable alias: https://officebites-git-feat-legal-vendor-da31dd-sp24tg-6983s-projects.vercel.app
- Supplied immutable Preview: https://officebites-8oj6fgzwk-sp24tg-6983s-projects.vercel.app
- Alias resolves to `dpl_ZGxYvQjxdGY74s7Lhx1J1RVEQEvz`, READY, exact local HEAD. Both URLs serve a PaymentUpload chunk containing the current Ozow action and unavailable notice.
- Actual anonymous frontend `get_payment_gateways` response from both Preview origins: **PayFast enabled=true, ready=true, maintenance=false; Ozow enabled=false, ready=false, maintenance=false**. PayFast is preserved in this state; it was not tested by initiating payment.
- `get_payment_gateways` is executable by anon/authenticated/service_role and returns public gateway fields excluding updated_by. It exposes no merchant credentials. `checkoutService.gateways()` fails closed when unavailable.
- Checkout enables order placement only when an enabled/ready/non-maintenance provider exists. PaymentUpload independently applies those conditions per provider. No hardcoded Ozow availability was introduced.
- `admin_update_payment_gateway` requires an active administrator and refuses enablement if readiness is false. It does **not** accept or set readiness. Catalog inspection finds only get/update gateway RPCs; no existing administrative readiness-attestation API exists. Do not bypass this by directly setting ready=true without merchant verification.
- `begin_ozow_attempt` is service-only and delegates to server preparation that rechecks enabled/ready/maintenance, ownership, order state and unresolved attempts.
- Deployed `ozow-initiate v1`, `ozow-webhook v1`, `ozow-reconcile v1` remain ACTIVE and unchanged. All four files per function match local source after line-ending normalisation. Reconcile retains platform JWT verification; empty unauthenticated probe returns 401 before its handler.

## Configuration checks

| Setting / requirement | Result |
| --- | --- |
| OZOW_ENVIRONMENT and runtime SUPABASE_URL | **Failed combined guard**; exact individual values inaccessible. Expected staging and intended staging URL. |
| ALLOWED_ORIGINS | **Failed** for stable alias and supplied immutable URL. Prefer approving only the exact stable alias, preserving any other reviewed existing origins. |
| OZOW_RETURN_ORIGIN | **Blocked**: value unavailable. Must equal approved HTTPS origin without path/trailing slash and be included in ALLOWED_ORIGINS. Handler builds `/orders/{orderId}` on that origin. |
| OZOW_INITIATION_ENABLED | **Unverified**: earlier environment guard prevents observing it. Keep off until authorised staging merchant verification. |
| OZOW_RECONCILIATION_ENABLED | **Unverified**: webhook environment guard fails first; reconcile is JWT-protected. Do not claim true/false. |
| OZOW_CLIENT_ID / OZOW_CLIENT_SECRET / OZOW_SITE_CODE | **Unverified**: staging One API credentials, merchant site restriction and payments permissions require secure merchant/secret-manager access. Legacy credentials must not be assumed compatible. |
| OZOW_BENEFICIARY_REFERENCE | **Unverified**: handler requires merchant-approved alphanumeric reference. |
| OZOW_WEBHOOK_SECRET / subscription | **Unverified**: require a verified signing secret and thin transaction.complete subscription to `https://eyhmarmekioovcjibcbr.supabase.co/functions/v1/ozow-webhook`; confirm no duplicate legacy/full subscription. No subscription was created. |
| Provider-supported staging flow | **Blocked**: merchant access/environment not established. No token acquisition, hosted creation, redirect, cancellation, failure, successful callback or transaction reconciliation is claimed. |

Current official contracts reviewed: [payment requests](https://hub.ozow.com/api-reference/one-api/post-payments/) and [transaction lookup](https://hub.ozow.com/api-reference/one-api/get-transactions-id/). These describe API contracts, not this merchant's staging approval or configuration.

## Regression additions and evidence

Changed test files:

- checks/ozow-integration.mjs: exact CORS allow/deny, staging project/environment gate, absent initiation flag/provider credentials/site, invalid return origin/reference, disabled reconciliation, and hosted initiation not crediting payment. All provider traffic is mocked.
- checks/ozow-subscription-database.mjs: unavailable readiness/enablement/maintenance combinations create no Ozow attempts; disabling Ozow prevents a fresh attempt. Changes use in-memory SQL only.
- checks/checkout-browser.spec.mjs: independent PayFast/Ozow visibility matrix and return/cancel/failure/success query parameters never implying Paid. Synthetic browser only; these parameters are negative tests, not a claim the provider emits that URL contract.

Verification commands: `node checks/verify-local.mjs`, `node checks/verify-browser.mjs` with Microsoft Edge, targeted oxlint for the three changed checks, and `git diff --check`. Full isolated regression suite passed, including **74 mocked Ozow handler assertions** and **50 isolated Ozow receipt/subscription/role assertions**. Targeted lint/whitespace checks passed. The browser test build passed; application source is unchanged, so no new frontend or Edge deployment is needed for these tests.

Final full Edge suite: **39 passed (3.0 minutes)**, including the new Ozow visibility and navigation-only return/cancel/failure cases. None is counted as provider-supported merchant staging verification.

Actual Preview evidence: anonymous gateway reads and deployed chunk verification passed for both origins. Fresh Edge mobile (390×844) and desktop (1440×1000) contexts loaded the deployed frontend with **synthetic identity/order responses and replayed actual public gateway settings**. PayFast button enabled, Ozow action absent, Ozow unavailable message visible; no page errors or horizontal overflow. All backend requests in the synthetic contexts were intercepted; no payment action was clicked. Screenshots inspected directly. This is not genuine account/merchant checkout evidence.

![Deployed payment UI; synthetic order, actual gateway settings replayed](.officebites-local/ozow-20261019-visuals/payment-390.png)

## Required next steps before enablement

Use the staging Supabase secret manager and Ozow merchant dashboard to verify the settings above without placing secrets in Git/chat. Correct the environment and exact stable origin first while Ozow stays disabled. Verify merchant-approved non-real-money token/site permissions, hosted success/failure/cancel/return, thin signed webhook delivery and authoritative transaction lookup with wrong amount/site/currency/reference, duplicate/late-event and disabled-initiation checks. Application unpaid-order cancellation is not provider bank cancellation; the current handlers do not expose a provider cancel-link operation, so provider cancellation behaviour remains an implementation/verification gap.

Only after evidence review may server readiness be attested and the active administrator enable Ozow. Current admin controls alone cannot set readiness. Do not directly overwrite the readiness flag merely to make a button appear. Browser return and hosted redirect creation must continue to leave payment unconfirmed until verified server-side receipt processing.

No commit, push, migration, secret update or deployment is performed by this readiness pass. Existing corporate/delivery/legal/cutoff settings and PayFast state remain untouched.
