import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { restorationSteps, authRecoveryDecision } from './recovery.mjs';

export async function verifyUatRecovery(db, {
  baselinePath = 'checks/uat/fixtures/recovery-baseline.json',
  evidenceDirectory = '.officebites-local/OB-UAT-20261020',
} = {}) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const evidence = { project: baseline.project, capturedAt: baseline.captured_at, executedAt: new Date().toISOString(),
    baselineSha256: createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),
    environment: 'isolated PGlite; Auth dispatch is an explicit model, not GoTrue', results: [] };
  let assertions = 0;
  const check = (name, fn) => { fn(); assertions++; evidence.results.push({ name, passed: true }); };
  const q = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const snapshot = async () => q(`SELECT pg_get_functiondef(p.oid) AS definition,pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,
 (SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END)
 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a) AS grants FROM pg_proc p WHERE p.oid='private.active_account()'::regprocedure`);
  const roleSettings = async () => (await db.query("SELECT s FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig)s WHERE r.rolname='authenticator' AND s LIKE 'pgrst.%' ORDER BY s")).rows.map(x => x.s);
  const databaseSettings = async () => (await db.query("SELECT setdatabase,setrole,s FROM pg_db_role_setting CROSS JOIN LATERAL unnest(setconfig)s WHERE s LIKE 'pgrst.%' ORDER BY setdatabase,setrole,s")).rows;
  const canonical = rows => [...rows].sort((a, b) => a.grantee.localeCompare(b.grantee));
  const install = async () => {
    await db.exec("SELECT set_config('officebites.verified_project_ref','eyhmarmekioovcjibcbr',true)");
    await db.exec(fs.readFileSync('checks/uat/staging-security.sql', 'utf8'));
    await db.exec("ALTER ROLE authenticator SET pgrst.db_pre_request='private.uat_pre_request'");
  };
  const executeRecovery = async (b = baseline, stopAfter = null) => {
    for (const step of restorationSteps(b)) {
      await db.exec(step.sql);
      if (step.name === stopAfter) throw Error('Injected interruption at ' + step.name);
    }
  };
  const retainedSink = async name => {
    await db.exec("RESET ROLE; SET ROLE supabase_auth_admin");
    const response = await q("SELECT private.uat_send_email($1) AS result", [{ user: { email: 'synthetic@officebites-uat.invalid' }, email_data: { email_action_type: 'recovery', token: 'NEVER-RETAIN' } }]);
    await db.exec('RESET ROLE');
    check(name, () => assert.deepEqual(response.result, {}));
    const rows = (await db.query('SELECT * FROM private.uat_message_capture')).rows;
    check(name + ' redaction', () => assert.doesNotMatch(JSON.stringify(rows), /synthetic@|NEVER-RETAIN/));
  };
  const methodState = async () => (await db.query('SELECT provider,enabled,ready,maintenance FROM private.gateway_settings ORDER BY provider')).rows;
  const history = async () => (await db.query(`SELECT 'orders' AS relation,md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY id),'')) AS digest FROM public.orders x
 UNION ALL SELECT 'suborders',md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY id),'')) FROM public.order_suborders x
 UNION ALL SELECT 'receivables',md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY order_id),'')) FROM private.manual_receivables x
 UNION ALL SELECT 'entries',md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY id),'')) FROM private.manual_receivable_entries x ORDER BY relation`)).rows;
  try {
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");
    await db.exec('BEGIN; CREATE ROLE authenticator; CREATE ROLE supabase_auth_admin; CREATE ROLE uat_recovery_owner;');
    await db.exec(baseline.active_account.definition);
    await db.exec(`ALTER FUNCTION private.active_account() OWNER TO "${baseline.active_account.owner}"`);
    // Reproduce the captured grant set exactly, before installation.
    await db.exec('REVOKE ALL ON FUNCTION private.active_account() FROM PUBLIC,anon,authenticated,service_role;');
    for (const g of baseline.active_account.grants) await db.exec(`GRANT EXECUTE ON FUNCTION private.active_account() TO "${g.grantee}"`);
    const original = await snapshot();
    const originalRest = await roleSettings();
    const originalDatabase = await databaseSettings();
    const originalHistory = await history();
    const originalMethods = await methodState();
    check('captured helper definition reproduced', () => assert.equal(original.definition, baseline.active_account.definition));
    check('captured helper owner reproduced', () => assert.equal(original.owner, baseline.active_account.owner));
    check('captured helper grants reproduced', () => assert.deepEqual(canonical(original.grants), canonical(baseline.active_account.grants)));
    check('captured REST role configuration reproduced', () => assert.deepEqual(originalRest, baseline.rest_role_settings));
    check('captured REST database configuration reproduced', () => assert.deepEqual(originalDatabase, baseline.rest_database_settings));
    await db.exec('SAVEPOINT clean_baseline');

    await install();
    const installed = await snapshot();
    const installedRest = await roleSettings();
    check('installation changes helper', () => assert.notEqual(installed.definition, original.definition));
    check('REST attachment is installed locally', () => assert.deepEqual(installedRest, ['pgrst.db_pre_request=private.uat_pre_request']));
    await retainedSink('seed suppression capture before recovery');
    const originalCapture = (await db.query('SELECT * FROM private.uat_message_capture ORDER BY id')).rows;
    await db.exec('SAVEPOINT installed');
    await db.exec('SAVEPOINT sql_failure');
    await db.exec(baseline.active_account.definition);
    await assert.rejects(() => db.exec('SELECT 1/0'), /division by zero/);
    assertions++; evidence.results.push({ name: 'actual SQL error interrupts transaction', passed: true });
    await db.exec('ROLLBACK TO SAVEPOINT sql_failure; RELEASE SAVEPOINT sql_failure');
    const afterSqlError = await snapshot();
    check('SQL-error rollback retains installed helper', () => assert.deepEqual(afterSqlError, installed));
    const restAfterSqlError = await roleSettings();
    check('SQL-error rollback retains installed REST gate', () => assert.deepEqual(restAfterSqlError, installedRest));
    for (const stage of ['definition', 'ownership', 'grants', 'rest-setting']) {
      await db.exec('SAVEPOINT recovery_attempt');
      await assert.rejects(() => executeRecovery(baseline, stage), /Injected interruption/);
      assertions++; evidence.results.push({ name: 'injected interruption after ' + stage, passed: true });
      await db.exec('ROLLBACK TO SAVEPOINT recovery_attempt; RELEASE SAVEPOINT recovery_attempt');
      const interruptedHelper = await snapshot();
      const interruptedRest = await roleSettings();
      check('transaction rollback restores installed helper after ' + stage, () => assert.deepEqual(interruptedHelper, installed));
      check('transaction rollback restores installed REST setting after ' + stage, () => assert.deepEqual(interruptedRest, installedRest));
      await retainedSink('sink retained after interrupted ' + stage);
    }
    await db.exec('ROLLBACK TO SAVEPOINT installed');
    // Simulate partial manual completion and ACL/ownership drift, then replay all steps.
    await db.exec(baseline.active_account.definition);
    await db.exec('ALTER FUNCTION private.active_account() OWNER TO uat_recovery_owner; GRANT EXECUTE ON FUNCTION private.active_account() TO PUBLIC; GRANT EXECUTE ON FUNCTION private.active_account() TO service_role WITH GRANT OPTION;');
    await executeRecovery();
    const restored = await snapshot();
    const retainedCapture = (await db.query('SELECT * FROM private.uat_message_capture ORDER BY id')).rows;
    check('suppression capture history preserved byte-for-byte', () => assert.deepEqual(retainedCapture, originalCapture));
    check('restored definition exact', () => assert.equal(restored.definition, original.definition));
    check('restored ownership exact', () => assert.equal(restored.owner, original.owner));
    check('restored effective grants exact', () => assert.deepEqual(restored.grants, original.grants));
    check('restored raw ACL exact', () => assert.equal(restored.acl, original.acl));
    const restoredRest = await roleSettings();
    const restoredDatabase = await databaseSettings();
    check('restored REST role configuration exact', () => assert.deepEqual(restoredRest, originalRest));
    check('database REST settings unchanged', () => assert.deepEqual(restoredDatabase, originalDatabase));
    await executeRecovery();
    const rerun = await snapshot();
    check('recovery rerun is idempotent', () => assert.deepEqual(rerun, original));
    await retainedSink('sink retained after complete recovery');
    const restoredMethods = await methodState();
    const restoredHistory = await history();
    check('payment settings unchanged', () => assert.deepEqual(restoredMethods, originalMethods));
    check('financial/order history unchanged', () => assert.deepEqual(restoredHistory, originalHistory));

    await db.exec('ROLLBACK TO SAVEPOINT clean_baseline');
    // A nonempty prior hook is a distinct baseline, not silently replaced by RESET.
    await db.exec("ALTER ROLE authenticator SET pgrst.db_pre_request='private.operator_prior_hook'");
    const nonempty = { ...baseline, rest_role_settings: await roleSettings() };
    await install();
    await executeRecovery(nonempty);
    const priorRestored = await roleSettings();
    check('nonempty prior REST hook restored exactly', () => assert.deepEqual(priorRestored, nonempty.rest_role_settings));
    await retainedSink('sink retained with nonempty previous REST hook');

    const current = { enabled: true, uri: 'pg-functions://postgres/private/uat_send_email' };
    for (const previous of [baseline.auth_email_configuration, { previous_hook_known: true, previous_hook: { enabled: false } }, { previous_hook_known: true, previous_hook: { enabled: true, uri: 'https://external-delivery.invalid' } }]) {
      const decision = authRecoveryDecision(previous, current);
      check('unsafe/unknown Auth baseline retains suppression ' + JSON.stringify(previous), () => assert.equal(decision.action, 'retain-suppression'));
      check('unsafe/unknown Auth baseline is not reported restored', () => assert.equal(decision.exactBaselineRestored, false));
    }
    check('unverified current Auth hook prevents recovery authorisation', () => assert.throws(() => authRecoveryDecision(baseline.auth_email_configuration, { enabled: false })));
    check('disabled no-delivery replacement rejected', () => assert.throws(() => authRecoveryDecision({ previous_hook_known: true, previous_hook: { enabled: true, uri: 'private.safe_sink' } }, current, { verifiedNoDelivery: true, enabled: false, uri: 'private.safe_sink' })));
    const authTrace = [];
    for (const interruptedAt of ['before-database', 'after-definition', 'after-rest-setting', 'after-commit']) {
      const state = { ...current };
      const decision = authRecoveryDecision(baseline.auth_email_configuration, state);
      authTrace.push({ interruptedAt, ...decision, hook: state });
      check('Auth config unchanged on interruption ' + interruptedAt, () => assert.deepEqual(state, current));
    }
    evidence.authConfigurationModel = authTrace;
    evidence.authHostedBaselineKnown = false;
    evidence.assertions = assertions;
    evidence.status = 'PASS_LOCAL_DATABASE_RECOVERY; HOSTED_AUTH_CONFIG_UNVERIFIED';
    fs.mkdirSync(evidenceDirectory, { recursive: true });
    fs.writeFileSync(evidenceDirectory + '/recovery-evidence.json', JSON.stringify({ ...evidence, functionBefore: original, functionAfter: restored, restBefore: originalRest, restAfter: originalRest }, null, 2));
    fs.writeFileSync(evidenceDirectory + '/recovery-reviewed.sql', '-- Generated from verified baseline; no hosted execution authorised by this file.\n-- Retain the active Auth suppression hook; do not restore unknown SMTP delivery.\nBEGIN;\nSET LOCAL officebites.verified_project_ref=\'eyhmarmekioovcjibcbr\';\n'
      + restorationSteps(baseline).map(step => '-- ' + step.name + '\n' + step.sql).join('\n') + '\nCOMMIT;\n');
    console.log(`${assertions} local recovery assertions passed; exact function/owner/ACL and REST config compared. Hosted Auth config remains unknown; suppression retained.`);
  } finally {
    await db.exec('ROLLBACK; RESET ROLE');
  }
}

