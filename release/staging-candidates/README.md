# Staging-only integration candidates

Target: `eyhmarmekioovcjibcbr`. **Not approved for hosted installation.**
Do not apply production candidates to staging or execute blanket `db push`.

Review `docs/staging/INSTALL-AND-UAT.md` and
`docs/release/staging-installation-manifest.json` first. The guarded baseline is
54 migrations; the two new versions produce 55 then 56. The canonical `.sql` files
are for review/approved migration-runner integration. The `.installation.sql`
bundles additionally record only their own NEW migration atomically; do not execute
both forms or double-record with a migration runner.

Between the two steps, a separately approved Dashboard/API action must establish
the private `vendor-compliance` bucket with the exact limits in the runbook.
The preferred Storage policy executor is ordinary `postgres` using confirmed
existing Supabase policy delegation. Plain PostgreSQL ownership tests cannot prove
this hosted delegation. If the administrator cannot confirm it, stop and use the
unsent Support draft; do not transfer ownership, grant managed roles or disable RLS.

Neither step publishes legal documents, accepts terms, approves vendors/banking,
creates orders or enables a payment method. Current dated evidence must be refreshed
through a separately approved preflight before any installation approval.
