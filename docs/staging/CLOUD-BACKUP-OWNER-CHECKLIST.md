# Staging cloud-backup approval checklist

Prepared 27 October 2026. **No execution approval recorded.** Scope is staging
`eyhmarmekioovcjibcbr` only. This checklist does not authorize migrations, payment
activation, legal publication or changes to production.

Follow [the exact setup instructions](GITHUB-CLOUD-BACKUP-20261027.md). Do not put
passwords, connection strings, private keys, user records or decrypted backups in
this checklist. Record redacted evidence references only.

## Before any workflow execution

- [ ] Owner reviews the workflow, both cloud scripts, regression tests and shared
      backup SQL. Record the full reviewed commit SHA: **PENDING**.
- [ ] Administrator verifies private repository access, GitHub plan support,
      environment protections and release-only branch restriction for
      `officebites-staging-backup`. Required protections must be enforceable before
      secrets are added. Evidence reference: **PENDING**.
- [ ] Separately approve workflow registration/commit/push arrangements. No such
      action is authorized by this preparation; manual dispatch must be available
      through an approved registration path. Evidence: **PENDING**.
- [ ] Administrator adds the three environment secrets listed in the setup guide
      through masked GitHub fields, without uploading local credential files.
      Verify the source endpoint is staging and uses TLS and port 5432. Record
      names/configuration evidence, never values: **PENDING**.
- [ ] Administrator sets the three environment variables from the guide, including
      the exact approved SHA, verified official PG17 restore-image digest and age
      public recipient. Record image provenance/reference: **PENDING**.
- [ ] Owner verifies private age identity custody, independent recovery access and
      successful test-ciphertext decryption on an approved device. The private
      identity must never enter GitHub. Evidence: **PENDING**.
- [ ] Owner accepts temporary processing of staging data on a GitHub-hosted
      ephemeral runner, encrypted-only artifacts, seven-day GitHub retention and
      separate private backup retention/access rules. Decision: **PENDING**.
- [ ] Operator confirms the source still matches the reviewed 54-migration and
      13-function baseline, all gateways remain disabled and no schema/role
      changes will occur during export. The workflow rechecks these guards; do
      not weaken a failed guard. Operator/window: **PENDING**.
- [ ] Owner separately authorizes one backup/isolated-restore run at the reviewed
      SHA. Approver, timestamp, permitted window and approval reference:
      **PENDING**. A checked checklist alone is not execution authorization.

## Evidence required after an approved run

- [ ] Workflow conclusion succeeds; encrypted `result.json` confirms
      `exportComplete=true` and `restoreVerified=true`. A failed job's encrypted
      diagnostic artifact is not a verified recovery point.
- [ ] PostgreSQL client/server major 17, actual image digest, source snapshot UTC,
      row/digest comparisons, catalog/function/role/grant comparisons and negative
      permission checks are evidenced. Record redacted summary references only.
- [ ] Record actual archive-restore duration and complete restore/verification
      duration from the result record; do not estimate them as measured results.
- [ ] Download ciphertext outside repositories; verify its SHA-256 against an
      independently retained trusted reference, decrypt privately and verify the
      inner file manifest. Record the independent round-trip result.
- [ ] Retain an access-controlled encrypted copy independently of GitHub expiry.
      Assign backup operator, retention, deletion policy and missed-run handling.
- [ ] Record separate recovery coverage for Storage object bytes, Auth/API/Storage
      settings, Edge code/secrets, encryption-root keys and external integrations.
      Database-only verification does not establish these services are recoverable.
- [ ] Owner accepts or revises proposed **24-hour RPO / 4-hour RTO**, using measured
      end-to-end recovery including external services. Proposed targets remain
      unaccepted; a manual workflow does not guarantee a daily recovery point.

## Decision record

| Gate | Current decision | Evidence / responsible owner |
|---|---|---|
| Local workflow preparation | PASS for local checks only | See setup guide; runtime remains unverified |
| GitHub setup and execution approval | UNKNOWN / pending | Release owner and GitHub administrator |
| Recoverable staging database backup | UNKNOWN / pending | Approved cloud run plus independent decryption |
| Complete service recovery and accepted RPO/RTO | UNKNOWN / pending | Supabase administrator and release owner |
| Staging migration installation | NO-GO under this authorization | Separate installation prerequisites and explicit approval |

No hosted operation, workflow execution, credential setup, commit or push was
performed while preparing these files.
