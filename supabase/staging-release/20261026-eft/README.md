# EFT-only staging candidate — NOT APPROVED

26 October 2026. No hosted execution is authorised. This is an alternative to,
not an extension of, `../20261023`. Never install both packages unchanged.

Target: `officebites-staging`, `eyhmarmekioovcjibcbr`. The proposed migration name
is `officebites_staging_eft_locked_20261026`; no timestamp or hosted history repair
has been invented. `apply-migration-request.json` is review data, not an instruction
to invoke a tool. Keep it outside automatic migrations.

The one-transaction dependency order is staging-security → booking → atomic
collection. Assisted orders, cash/custody and legal Phases B–E are excluded.
Existing source components are unchanged. Only their environment guards and outer
transaction wrappers are adapted by the builder; authorization checks remain.

Review `manifest.json`, all source hashes, `install.sql` and the P0 resolution
report. Offline verification: `node checks/uat/prepare-eft-installation-package.mjs --verify`.
Disposable rehearsal: `node checks/eft-package-local.mjs`. Neither command contacts
Supabase. Running the builder without `--verify` regenerates local review files.

`readiness.sql` and `baseline-capture.sql` are SELECT-only. `preflight.sql` is a
non-writing DO assertion; it was not run on hosted infrastructure. Never run
`install.sql`, `forward-containment.sql` or their request as part of readiness checks.

Installation requires fresh independent target verification, full schema/column/
policy/trigger/default-ACL review, effective REST/Auth/Storage/Realtime and all-channel
notification isolation, backup/recovery and maintenance approval, native rehearsal,
and separate owner approval. Current six-group metadata matching is insufficient.
SQL `set_config` is a local guard, not proof of project identity or service settings.

The installer binds the captured function/table/settings/count baseline, locks
historical tables, compares protected row fingerprints without returning row contents,
and records immutable package/function-ACL evidence. It rejects known partial/full
or legal installations, changed maintenance/ready/settings, and replay drift.
There is no actor provisioning, hook configuration, gate opening, gateway mutation,
banking submission, order creation or external notification call in the installation.
Replacing `active_account` closes existing authenticated access: maintenance impact
must be accepted before installation. Defining an Auth hook does not configure it.

Recovery before commit is transaction rollback. After commit, independently approved
forward containment closes collection policy/expiry and UAT capability/expiry while
retaining actor and financial evidence. It verifies package identity and refuses
gateway/settings drift; it cannot disable an already-enabled method or undo service
configuration. If drift exists, reconcile read-only and obtain a separately approved
audited recovery plan first. Never restore a vulnerable helper or remove receipts.

The artifact is not integrated with B–E and cannot provide pending-vendor self-service
banking or production legal/compliance readiness. A combined forward package needs
independent review and new fingerprints; merging or sequencing blindly is unsafe.
