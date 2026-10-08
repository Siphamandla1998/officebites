# OfficeBites live release — 8 October 2026

The user explicitly waived the verified-backup prerequisite. No backup, database credentials or customer-data backup was created or stored for this release. The existing captured definitions were preserved. Staging was not changed.

## Backend installation

Remote implementation remained `5c44f0868cc5f33b358d10cb3185831118b274bd`. Remote main and the QA branch were ancestors; no newer main-only changes existed. Live function definitions matched the prior capture. Required private helpers, fields, Auth/profile FK and Storage ownership columns were verified. The live retention function returns void, so the staging return-type conflict does not apply.

Only the following release SQL was applied, each inside BEGIN/COMMIT with a transaction-local lock timeout. Supabase's migration tool generated the installed history versions; these differ from the source-file timestamps. Do not replay either file or use an unrestricted database push.

| Source file | Installed history version | History name |
| --- | --- | --- |
| 20261008114505_launch_financial_ledger.sql | 20261008134310 | launch_financial_ledger |
| 20261008114550_launch_account_security_retention.sql | 20261008134402 | launch_account_security_retention |

After each installation, catalog queries verified affected functions, signatures, ACLs, policies, triggers and compatibility contracts. The vendor default is 0.17; existing overrides were preserved. No historical commission backfill was performed. The financial report and compatibility analytics returned matching totals in a read-only transaction under an existing administrator's SQL role context; this is not a browser/JWT login test. The fee policy remains NULL. Payouts, removal jobs and new tombstones were empty at verification. All 22 public tables have the new restrictive active-account policy; Storage has its restrictive policy/write guard. Profile inserts require an Auth identity, while financial-history tombstones can remain after separately approved removal.

Retention remains disabled (30 days, inactive configuration, no pg_cron installed). Existing checkout, confirmation, vendor upgrade, name and atomic-support RPC signatures/grants remain compatible. Payment confirmation and removal preparation/completion remain server-only.

`admin-account-removal` was Deno type-checked and deployed ACTIVE, version 1, ID `b37f0986-5110-43af-9eae-49d1732ad51c`, with its shared dependency and verify_jwt=true. The handler additionally calls Auth getUser and requires an active admin profile. Standard platform-provided server credentials are referenced only on the server; their privileged execution was not exercised against an existing account. Unauthenticated/public-key-only requests returned 401; production-origin CORS preflight returned 204 with the correct origin. No account-removal request was performed on existing accounts.

## Rollback preparation and limits

Captured metadata remains at `%TEMP%\officebites-live-pre-release-metadata.json`. Concrete recovery SQL is at `%TEMP%\officebites-rollback-account-security.sql` and `%TEMP%\officebites-rollback-financial.sql`, outside Git. Its compilation, Auth FK restoration, release-trigger removal and disabled retention were tested in isolated PGlite. It was not executed on live.

Recovery restores prior executable definitions/grants and preserves additive tables/columns/history. It refuses execution after paid snapshots, classifications, payouts, account-removal jobs or changed Auth/tombstone state. Withdraw the removal function and stop frontend mutations before evaluating recovery. New financial entries, Auth deletion, files or irreversible external effects may require forward corrective migrations. No rollback or full recovery is guaranteed without a verified backup.

## Final merged-code validation

The implementation was merged into the existing main branch with a normal merge. Its application tree matched the implementation branch. Git's Windows checkout exposed two LF-only parser assumptions in the regression harness; only the auth import-stripping and Workbox predicate readers were corrected to normalize CRLF. Checks were rerun successfully.

- Auth: both race scenarios passed; support: seven mocked checks passed.
- Order/date/commission: 36 assertions; catalogue/date: 24; frontend/service/handler: 208, across four timezones.
- Isolated database: 73 migration/accounting/role checks passed.
- Production build/PWA generation: passed, 110 precache entries.
- Targeted lint: 96 source files, Vite config and two removal TypeScript files; zero errors, seven existing warnings. The wider scope adds LocationContext's Fast Refresh warning to the previous six.
- Whitespace validation: passed. No secret, dependency, build/runtime or private production-data fixture is included in the release commit.

The user confirmed Vercel Production Branch Tracking is main. Production deployment identity, remote final main SHA, domain association and asset checks are reported in the release conversation after push; this document records backend installation and pre-push validation.

## Remaining verification

Hosted account-removal execution/failure retry, authenticated browser role/refresh flows, two-account chat/notifications, actual CSV downloads, uploads, mobile and installed-PWA upgrades remain untested here. SQL metadata/role-context tests and mocks do not certify those flows. Real PayFast payment/ITN and merchant approval remain unverified. Security advisors report intentional callable SECURITY DEFINER APIs and disabled leaked-password protection; API grants alone do not replace each function's role/ownership checks. No fee policy, payouts, classification, backfill, retention purging, real payment or customer message was performed.
