// SQL generation only: no hosted connection, credentials, or automatic execution.
import { validateReleaseReference } from './provision-core.mjs';
const identifier = value => '"' + value.replaceAll('"', '""') + '"';
const literal = value => "'" + value.replaceAll("'", "''") + "'";
export function restorationSteps(baseline) {
  const refreshed = baseline.latest_migration === '20261021100655'
    && ['20261020100740', '20261021100655'].every(version => baseline.required_migrations?.includes(version));
  if (baseline.project !== 'eyhmarmekioovcjibcbr' || baseline.uat_installed !== false
    || (baseline.latest_migration !== '20261020100740' && !refreshed)) throw Error('Verified pre-install staging baseline required');
  if (refreshed) validateReleaseReference(baseline);
  const f = baseline.active_account;
  if (!f?.definition?.startsWith('CREATE OR REPLACE FUNCTION private.active_account()')
    || !f.owner || !Array.isArray(f.grants) || f.grants.some(g => g.privilege !== 'EXECUTE' || g.grantor !== f.owner)) {
    throw Error('Unsupported function baseline; inspect ownership and grant provenance');
  }
  const prior = baseline.rest_role_settings.filter(s => s.startsWith('pgrst.db_pre_request='));
  if (prior.length > 1) throw Error('Ambiguous REST baseline');
  return [
    { name: 'preconditions', sql: `DO $$ BEGIN
 IF current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM 'eyhmarmekioovcjibcbr' THEN RAISE EXCEPTION 'Verified staging connection required'; END IF;
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled) THEN RAISE EXCEPTION 'All methods must remain disabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.uat_security WHERE project_ref='eyhmarmekioovcjibcbr' AND run='OB-UAT-20261020') THEN RAISE EXCEPTION 'Retained suppression configuration required'; END IF;
 IF EXISTS(SELECT 1 FROM private.uat_actors a JOIN public.profiles p ON p.id=a.user_id WHERE NOT p.suspended AND p.deleted_at IS NULL) THEN RAISE EXCEPTION 'Close synthetic account access before recovery'; END IF;
 IF to_regprocedure('private.uat_send_email(jsonb)') IS NULL THEN RAISE EXCEPTION 'Keep the suppression hook installed'; END IF;
 END $$;` },
    { name: 'definition', sql: f.definition },
    { name: 'ownership', sql: `ALTER FUNCTION private.active_account() OWNER TO ${identifier(f.owner)};` },
    { name: 'grants', sql: `REVOKE ALL ON FUNCTION private.active_account() FROM PUBLIC;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT DISTINCT pg_get_userbyid(a.grantee) AS name FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
 WHERE p.oid='private.active_account()'::regprocedure AND a.grantee<>0 LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION private.active_account() FROM %I CASCADE',r.name);
 END LOOP;
END $$;
${f.grants.map(g => `GRANT EXECUTE ON FUNCTION private.active_account() TO ${g.grantee === 'PUBLIC' ? 'PUBLIC' : identifier(g.grantee)}${g.grantable ? ' WITH GRANT OPTION' : ''};`).join('\n')}` },
    { name: 'rest-setting', sql: prior.length
      ? `ALTER ROLE authenticator SET pgrst.db_pre_request=${literal(prior[0].slice('pgrst.db_pre_request='.length))};`
      : 'ALTER ROLE authenticator RESET pgrst.db_pre_request;' },
    { name: 'reload', sql: "NOTIFY pgrst,'reload config';" },
  ];
}

// External Auth configuration is NOT PostgreSQL role configuration. This guard
// cannot attest live GoTrue behavior; callers must independently verify it.
export function authRecoveryDecision(previous, current, alternative = null) {
  if (current?.enabled !== true || current?.uri !== 'pg-functions://postgres/private/uat_send_email') {
    throw Error('Active suppression hook must be independently verified before database recovery');
  }
  if (!previous?.previous_hook_known) return { action: 'retain-suppression', exactBaselineRestored: false, reason: 'Unknown Auth baseline' };
  if (alternative?.verifiedNoDelivery !== true) return { action: 'retain-suppression', exactBaselineRestored: false, reason: 'No verified no-delivery replacement' };
  if (alternative.enabled !== true || alternative.uri !== previous.previous_hook?.uri
    || previous.previous_hook?.enabled !== true) throw Error('Refusing a disabled or mismatched replacement hook');
  return { action: 'operator-verified-replacement-only', exactBaselineRestored: true, replacement: { enabled: true, uri: alternative.uri } };
}
