# Production-only local review candidate

No hosted installation is authorized. Use the exact four-file sequence and SHA-256
values in `docs/release/production-migration-manifest.json`. Normal migration-runner
history recording is part of the dependency contract. Do not execute all SQL files
in this directory alphabetically: the earlier standalone transition-guard source is
composed into the third migration and MUST NOT be installed separately.

1. `20261027093453_production_launch_browser_grants.sql`
2. `20261027112327_production_minimum_manual_legal_foundation.sql`
3. `20261027112437_production_checked_settings.sql` (contains B–E, transition and fee
   evidence guards, plus singleton/CAS settings).
4. `20261027115843_production_compliance_storage_owner_policies.sql` requires a
   separately approved executor using the existing managed Storage owner role.
   Application postgres must not acquire that role or ownership to run this step.

Expected history: captured production 38 -> 39 -> 40 -> 41 -> 42. These files are not the
staging installer. Staging has 54 different history entries and existing foundations.
No blanket `supabase db push`, migration-history repair, draft publication, gateway
activation or old-table replacement is proposed. Source SQL under
`release/source-candidates` and reference fixtures are not additional install steps.

See `docs/INTEGRATED-CHECKOUT-COMPATIBILITY-REPAIR-20261027.md` for the current report,
native test limits, preflight requirements, staged release order and containment.
