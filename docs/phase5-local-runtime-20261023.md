# Phase 5 local runtime and validation

Status: incomplete; real frontend-to-PostgREST/Auth/database integration BLOCKED. No hosted writes, migrations, activation, commits, pushes or deployment. Existing changes preserved on `feat/vendor-direct-launch-payments`, HEAD `695e5e19cf581f6202dcc058afad1ee2fba23208`.

## Verified environment

- Pinned validation Node v22.23.3, npm 10.9.9 available in the existing temporary runtime; neither on the initial shell PATH.
- Docker and Supabase CLI absent from PATH; no Docker Desktop in Program Files or per-user Programs; no project CLI binary.
- `wsl.exe` exists but `wsl --version` reports WSL is not installed. WinGet executable exists. No running Docker service was found.
- `supabase/config.toml` does not exist. Existing directory contains migrations, functions, `.temp`, `seed-images` and `seed_real_data.sql`. No competing project was initialised. The real-data seed was not executed.
- `.env.local` points to a nonlocal Supabase endpoint; `.env.staging.local` points to hosted staging. Values/keys were not printed or changed. Neither is suitable for local integration tests without explicit local overrides.
- Port preflight found no listeners on 54321/54322/54323/55432/5176 before test startup. The existing checked native cluster binds 127.0.0.1:55432 and uses only a disposable workspace data directory.

## Windows operator setup

These are operator steps, not operations performed by this task. OS virtualisation setup can require administrator rights and a restart.

1. Verify Windows/virtualisation requirements against [Docker's Windows installation guide](https://docs.docker.com/desktop/setup/install/windows-install/). Install/enable WSL with `wsl --install` from an elevated operator terminal where required, restart as instructed, then verify `wsl --version` and `wsl --status`. Do not treat the presence of wsl.exe as proof of installation.
2. Install Docker Desktop from that official guide, select Linux containers/WSL 2, and start it. Verify `docker version` includes a working server and `docker info` succeeds. Do not expose the Docker daemon on a public TCP endpoint.
3. With the verified Node directory on PATH, follow the [official CLI guide](https://supabase.com/docs/guides/local-development/cli/getting-started). Select and review an exact CLI version, then install it pinned (`npm install --save-dev --save-exact supabase@<reviewed-version>`). This changes package files and should be inventoried before execution. Do not use an unpinned automatic download or global npm installation. Run `npx --no-install supabase --version` and `--help`.
4. Stay in this existing repository. Since config.toml is absent, inspect `supabase init --help` and generate only that missing local configuration through the official workflow after reviewing its diff. Preserve migrations, functions, `.temp` and seeds; do not link/login to hosted projects. Disable automatic seeds and never load `seed_real_data.sql`. Do not run all historical migrations blindly: the isolated test runner bootstraps prerequisite schema/roles separately. Prepare a reviewed local base schema and candidate sequence first.
5. Inspect CLI `start --help` and version-matched Docker networking options before startup. Configure loopback-only published ports, then verify every container mapping with `docker ps`/`docker inspect` and Windows listeners. Stop if any service publishes to 0.0.0.0 or `::`; do not assume CLI defaults meet this restriction. Keep Auth mail on the local sink and deny external delivery.
6. Start the reviewed local stack. Store generated local credentials in an ignored local file, never chat. Explicitly override every Vite Supabase URL/key to this local stack; fail startup if any endpoint is nonlocal. Seed synthetic Auth identities using the local Admin workflow and existing manifest. Guest/vendor/admin tests must use actual Auth sessions and persisted database assertions. Keep all baseline gates closed; isolate any permitted synthetic eligibility fixture from hosted configuration and never open admin custody.

The official CLI requires a container runtime on Windows; its experimental native runtime is documented for Linux/macOS Apple silicon. The embedded PostgreSQL used here is not a substitute for Auth/PostgREST.

## Independent work executed

New tests extend the existing suites rather than altering application functionality or migration candidates:

- Native suspension ordering: overlapping transactions; suspension commits before the pending transaction invokes checkout, which must reject. This does not cover every ordering of suspension after checkout validation.
- Stateful historical handover fixture is seeded inside a transaction and rolled back in full. Admin custody gate remains NULL. Sender self-approval, unrelated vendor access, changed replay payload and invalid post-acknowledgement transition are denied; assigned recipient acknowledgement/replay and settlement balance are checked. This is SQL fixture evidence, not real API evidence or admin-cash activation.
- Committed index-loss repair: drop `private.cash_order_events`, recreate from captured definition with IF NOT EXISTS twice, compare exact index definition, table RLS/ACL, financial snapshots, outbox count and admin lock. No table/column rollback or historical deletion. Existing committed permission repair and interruption checks also run. Timings are printed in logs.

Changed files: `checks/pilot/assisted-cash-database.mjs`, `checks/pilot/phase4-security-recovery.mjs`, this report and its link. No new application features, CLI dependency edits, config files or migration candidates were added.

## Executed commands/results

Using the pinned Node runtime on PATH:

- `node checks/pilot/native-bootstrap.mjs --reset`, then `OFFICEBITES_LOCAL_NATIVE=1 node checks/checkout-database.mjs`: **777 assertions passed**, exit 0; 87 assisted-payment and 62 security/recovery assertions; combined permission/index repair 143 ms. Log `.officebites-local/phase5-native-final.log`. An initial fixture cleanup attempted to unsuspend using the suspended identity; the active-account guard correctly rejected it. Cleanup now explicitly resets the synthetic identity before privileged fixture restoration. No application authorisation was weakened.
- With native flag unset, `node checks/verify-local.mjs`: full regression runner passed, exit 0 (`phase5-services-pglite.log`). After the final handover fixture addition, `node checks/checkout-database.mjs` passed **728 PGlite assertions**, exit 0 (`phase5-pglite-final.log`); 64 assisted and 62 security/recovery assertions; repair 271 ms.
- `node node_modules/oxlint/bin/oxlint`: exit 0, existing hooks/Fast Refresh warnings (`phase5-lint.log`).
- `node node_modules/vite/bin/vite.js build --configLoader native`: exit 0, PWA generated 129 precache entries (`phase5-build.log`).
- `PLAYWRIGHT_CHANNEL=msedge PLAYWRIGHT_DISABLE_GPU=1 node checks/verify-browser.mjs`: rebuilds harness and executes the full suite, including the entire affected payment suite (`phase5-browser.log`); final browser outcome recorded below.

Native cluster stopped after verification. Gates/settings closeout assertions pass; hosted flags were not queried or inferred. No actual local Auth/PostgREST tests ran, so none are counted or labelled passed.

Full browser rerun completed: **74 passed, 0 failed, 0 skipped**, 7.8 minutes, `BROWSER_EXIT=0`. The entire previously affected payment suite passed. ECONNRESET did not recur; historical root cause remains unresolved. This suite uses synthetic RPC fixtures except the existing read-only public smoke test; it does not replace actual local integration evidence.

## Evidence still unavailable

Frontend-to-API/Auth integration, actual local Auth delivery/sink behaviour and forged-JWT HTTP requests require the missing stack. Concurrent mutations of a valid pending historical handover still need a committed shared fixture and separate connections; sequential denial/replay does not prove them. Suspension after validation and all opposite receipt/cancellation orderings remain unverified. Keep these open rather than infer safety from aggregate counts.

Notification evidence presently covers SQL role-restricted redacted Auth capture and transactional/idempotent collection outbox tests. It does not prove actual GoTrue delivery, SMTP fallback, external provider isolation or API retry transport. Hosted PostgREST/configuration and independent notification channel evidence remains BLOCKED under the existing operator checklist. No real messages were sent.

Prior ECONNRESET occurred inside route.fetch of the loopback harness document, with no established application cause. Lifecycle/connection/timeout causes remain hypotheses. The entire browser suite is rerun this phase; a passing rerun does not establish the historical root cause.

## Readiness

Local validation NO-GO for full integration sign-off until the stack and remaining race tests execute. Supervised staging UAT NO-GO pending security/notification evidence, reviewed migration/recovery and separate approval. Production NO-GO pending successful staging UAT and operational approval.

EFT: latest independent bank approval; immutable recipient/reference/total/commission snapshots; verified funds, refunds/cancellation and guest access; accepted security/notification evidence; supervised UAT; explicit activation approval.

Vendor cash: independently authorised recipient, prepaid atomic capacity/receipt, remaining races and integrated forms, approved failed-creation cash return and refund procedures, accepted API isolation and UAT; separate activation approval.

Admin cash: remains independently disabled. Named custodians, physical security, gross/net settlement, deadlines, commission/tax/invoice treatment, independent acknowledgements, refund responsibility, discrepancy escalation and finance/legal approval remain outstanding. No fixture approves these policies. R0 Eduvos collection, inactive R15 delivery and unapproved R10 delivery remain unchanged.
