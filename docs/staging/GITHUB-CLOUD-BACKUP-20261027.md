# Staging backup on a GitHub-hosted cloud runner

Prepared locally for **eyhmarmekioovcjibcbr** on
`release/vendor-eft-legal-launch`. **Not executed, pushed or approved to run.** No
local PostgreSQL/Docker installation is required. Docker is used only on the
ephemeral GitHub-hosted runner to contain the restore without external networking.
The user's local credential files were not opened, copied or uploaded. Their
existence is owner-reported; they are not automatically synchronized with GitHub.

## What the workflow does

`.github/workflows/staging-backup-restore.yml` has **workflow_dispatch only**. No
push/PR/schedule trigger, production job, installation candidate, deployment,
payment flag or legal publication is included. It requires the exact release
branch, an owner-approved commit SHA, an independently selected immutable restore
image and confirmation of staging/no concurrent role/schema changes. Only
contents:read is granted. Official checkout/upload actions are pinned to complete
commit SHAs; checkout does not persist its token. No project npm scripts run.

The source step alone receives three encrypted GitHub environment secrets. It
connects to the exact staging direct host or a Dashboard-verified session-pooler
host, derives the staging-qualified pooler username, validates TLS using the supplied
CA, and checks the retained **54-entry history and 13 function hashes** with gateways
disabled. Passwords are never passed in a URI or process argument. Temporary
pgpass/CA files are mode 0600 under a mode-0700 RUNNER_TEMP directory outside the
checkout; child commands receive a minimal environment, not GitHub tokens.

PostgreSQL **17** client tools export a single full staging database custom archive
under a shared read-only snapshot, plus role definitions without role passwords.
No schema/table is silently excluded. Full scope includes required public/private,
Auth, Storage metadata and migration history, plus other accessible database objects.
This may encounter protected objects/encryption dependencies: failure remains
failure; no permissions are expanded. Source functions/RLS/ACL/role metadata,
table counts/digests and sequences are captured for comparison. A second read-only
snapshot checks observed catalog/role/sequence stability. An operator no-change
attestation remains necessary; this is not an automatic schema lock.
The 54-entry guard is intentionally tied to today's reviewed baseline. After any
future approved migration, new backup expectations require a reviewed code revision
and approved SHA; do not change the database or auto-learn live hashes to bypass it.

Restore occurs in a **new --network none container**, without source credentials,
host mounts or published ports. The reviewed image must supply matching Supabase
PG17 extension compatibility. It initializes a new cluster with a distinct bootstrap
role, replays the role export only there, restores the archive transactionally and
runs the existing catalog/data captures and negative permission tests. No EFT
migration file is executed. Missing extensions, managed-role incompatibilities,
data/ACL/function differences or unexpected open controls fail the job. No dummy
Auth/Storage stubs, ignored SQL errors, --no-owner or --no-acl are used.

Measured archive-restore and complete restore/verification milliseconds are written
inside the private result record. An age-encrypted bundle preserves the archive,
roles, SHA-256 manifest and private logs/evidence; only **ciphertext and its SHA-256**
are uploaded, retained seven days. A failed attempt can produce an encrypted
diagnostic bundle with exportComplete/restoreVerified=false; artifact existence is
not a successful recovery claim. The job remains failed. Plaintext and the isolated
container are removed in cleanup; forced runner cancellation cannot guarantee this
step, so use GitHub-hosted ephemeral runners only, not a shared self-hosted runner.

## Exact GitHub setup — administrator actions, not performed here

Track approvals and evidence in the
[owner checklist](CLOUD-BACKUP-OWNER-CHECKLIST.md). All execution approvals and
runtime evidence are pending; preparing these files does not authorize a run.

1. **Review repository visibility, trust and plan support first.** GitHub Settings
   → Environments → New environment: **officebites-staging-backup**. Restrict its
   allowed branch to **release/vendor-eft-legal-launch**, protect that branch and
   require reviewed workflow/helper changes. Enable required reviewers/prevent
   self-review where the repository plan supports them. If protections needed by
   the OfficeBites owner cannot be enforced, stop before adding secrets. Do not
   silently fall back to broadly accessible repository secrets or make the repo
   public. Supabase Free does not establish the GitHub plan or its protections.
2. Under that environment's **Environment secrets → Add secret**, add exactly:

   | Name | Value / source |
   |---|---|
   | OFFICEBITES_STAGING_DB_HOST | Staging Dashboard → Connect: exact direct hostname, or the verified session-pooler hostname only; no URI, port, path or password. |
   | OFFICEBITES_STAGING_DB_PASSWORD | Actual existing staging database password from the approved secret manager. Not an anon/service_role key, GitHub token or production password. Enter through the masked GitHub field; do not print it or paste into chat. |
   | OFFICEBITES_STAGING_DB_CA_CERT | Complete trusted PEM CA certificate for the selected staging database endpoint, obtained through the approved Supabase certificate/Connect workflow. No private key. |

   User/port/database are intentionally not configurable secrets: direct user
   postgres or session user postgres.eyhmarmekioovcjibcbr, port 5432, database postgres.
   Transaction-pooler port 6543 is unsupported. Do not upload staging.pg_service.conf
   or staging.pgpass as files, artifacts or base64 blobs. An authorized administrator
   may consult their private secret manager to populate individual fields, but the
   repository/workflow never reads the local files.
3. Under **Environment variables**, add:

   | Name | Required value |
   |---|---|
   | STAGING_BACKUP_APPROVED_SHA | Full 40-character Git commit SHA of the separately reviewed, later committed workflow/helper version. Leave unset until review; this preparation is uncommitted. A new code commit requires new approval. |
   | STAGING_RESTORE_IMAGE | Reviewed official Supabase Postgres PG17 image by immutable digest: `public.ecr.aws/supabase/postgres@sha256:<verified 64 hex digest>` or `supabase/postgres@sha256:<verified 64 hex digest>`. Obtain actual digest/provenance from the official registry/release; no guessed digest/tag or latest is accepted. Match the real extension/managed-schema versions. |
   | STAGING_BACKUP_AGE_RECIPIENT | Dedicated age **public** recipient beginning age1, from the owner's approved backup identity. The public recipient is safe in a variable. Keep the private decryption identity offline/in the approved secret manager, never in GitHub Actions. |

   The image digest and recipient have intentionally **not** been fabricated.
   Independently verify the private identity can decrypt a test ciphertext before
   using its recipient. Escrow recovery access separately from the office computer.
   Do not generate or store the private identity in this workflow.
4. The workflow uses PostgreSQL client 17, Debian/Ubuntu node-pg and age packages
   from the runner's authenticated apt repositories. If postgresql-client-17 is not
   available on the selected GitHub ubuntu-24.04 image, tool setup fails before
   export. Review an official signed PGDG setup or a newly reviewed runner image;
   do not use an unverified install script or remove the major-version requirement.
   Package repositories and the pinned restore image still require supply-chain
   review. No software is installed on the user's computer.
5. GitHub workflow_dispatch discovery requires the workflow to be registered on
   the repository's default branch. This local release-branch file is not proof it
   is dispatchable yet. Agree a separately approved registration/publication path;
   **do not merge/push anything just to bypass this prerequisite**. Registration
   must retain the exact release-only guard. If a dedicated private backup repo is
   preferred, review that separate scope and its source/branch guards first.
6. After technical review and **separate explicit execution approval only**, the
   operator would choose Actions → OfficeBites staging backup and restore
   verification → Run workflow → release/vendor-eft-legal-launch, enter the exact
   staging ref and truthfully confirm no schema/role changes. Review actual approved
   SHA, artifact custody, cloud processing/retention and any runner costs first.
   No run was triggered here. No automatic schedule is enabled.

## Backup custody, decryption and recovery limits

After a separately approved successful run, download the encrypted bundle/hash
into private storage **outside every repository**, verify its SHA-256, decrypt on
the owner's trusted recovery device and verify the inner manifest hashes before
relying on it. Do not decrypt to stdout or extract into a checkout. Keep the age
private identity off GitHub and escrow it independently. Never include raw dump,
logs, SQL role exports, decrypted files or user rows in Git commits/issues/chat.

The cloud restore verifies the plaintext export before encryption, not an offline
download/decryption round trip. That separate check is required to prove key
custody and an independently recoverable backup. GitHub artifact expiry/deletion
and access controls are not permanent backup storage; retain a private encrypted
copy with owner-approved retention. SHA-256 detects byte changes, not authenticity
if an attacker can replace both ciphertext and hash; preserve an independent
trusted manifest/hash reference.

Database backups include Auth rows and Storage **metadata**, not object bytes or
all service settings. Storage byte exports with per-object hashes, Auth provider/
redirect/hook/delivery settings, source encryption-root keys where applicable,
deployed Edge bundles/dependencies/secret-manager references, API/Realtime/provider/
Vercel environment and worker/callback configuration remain separate recovery
requirements. No external service is started in the container. No provider split,
refund, bank approval, legal acceptance or order is generated by the drill.

Native/Supabase runtime compatibility and exact restore timings remain UNKNOWN
until the approved cloud run succeeds. Source snapshot times, measured durations
and complete-vs-failed status appear in encrypted result.json. This does not prove
hosted PostgREST/JWT/Storage access or notification isolation. It does not prove a
hosted managed restore can be performed without a separate reviewed plan. Full
exports can encounter inaccessible managed objects or encrypted data whose keys
are not in SQL; stop and report those limitations, never discard failed objects.

The earlier proposed **24-hour RPO / 4-hour RTO** remain unaccepted. A manual-only
workflow cannot guarantee a cadence: assign an operator, missed-run handling,
private retention and a pre-change recovery point, then accept targets against
measured end-to-end recovery including external state. No maintenance window,
installation or payment approval is inferred from preparing this workflow.

## Current evidence / decision

| Requirement | Result |
|---|---|
| Manual staging-only workflow, secret separation, encrypted-only upload, pinned actions | PASS — local preparation and static regression checks |
| Host/branch/SHA/confirmation validation and production rejection | PASS — local negative-input tests |
| GitHub secrets/environment protections/approved SHA set | UNKNOWN — not changed or queried |
| Restore-image digest, matching extension compatibility and offline age-key custody | UNKNOWN — owner/operator inputs required |
| Actual cloud backup, full restore, encrypted-download/decryption verification | UNKNOWN — workflow never executed |
| Exact real export/restore times, RPO/RTO and maintenance acceptance | UNKNOWN — not fabricated |
| EFT installation / hosted writes / payments | Not authorized; no operation performed |

Local verification: **36** scope/secret-separation/encrypted-upload/negative-input
assertions passed; the workflow parses with the installed YAML parser and focused
JavaScript lint passes. Bash syntax validation is blocked locally because Git Bash
is unavailable; the prepared cloud job checks it before receiving database secrets.
No PostgreSQL export, container restore, age encryption/decryption or GitHub run was
performed. Those are unverified runtime requirements, not claimed test passes.

**Local code review: ready. Cloud execution and staging installation: NO-GO until
the setup/evidence above and separate execution approval are complete.**

Changed files: `.github/workflows/staging-backup-restore.yml`,
`checks/cloud/staging-backup.mjs`, `checks/cloud/staging-backup.test.mjs`,
`checks/cloud/restore-staging-backup.sh`, this document, and
`docs/staging/CLOUD-BACKUP-OWNER-CHECKLIST.md`. Existing migrations,
application source, local credential files and the other worktrees are preserved.

Primary references: [GitHub environment secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets),
[environment protection/plan limits](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments),
[Supabase Postgres image source](https://github.com/supabase/postgres),
[PostgreSQL consistent dumps](https://www.postgresql.org/docs/17/app-pgdump.html),
[pg_dumpall role/password limitations](https://www.postgresql.org/docs/17/app-pg-dumpall.html).
