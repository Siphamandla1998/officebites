// Runs only on the fresh in-memory PGlite created by checkout-database.mjs.
// No connection strings, hosted clients, persistence or native DB support.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
export async function verifyPhaseB(db) {
  assert.ok(db instanceof PGlite, 'Phase B requires disposable in-memory PGlite');
  let checks = 0;
  const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const scalar = async (sql, args) => (await db.query(sql, args)).rows[0];
  const root = () => db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");
  const as = async n => { await root(); await db.exec(`SELECT set_config('request.jwt.claim.sub','${id(n)}',false),set_config('request.jwt.claim.role','authenticated',false); SET ROLE authenticated`); };
  const reject = async (sql, pattern = /permission|owner|activation|pending|commercial|active|privileged/i) => {
    await assert.rejects(() => db.exec(sql), pattern); checks++;
  };
  const check = (a, b) => { assert.deepEqual(a, b); checks++; };
  await root();
  const before = (await db.query('SELECT * FROM public.vendors ORDER BY id')).rows;
  const financialSnapshot = async () => (await scalar(`
    SELECT jsonb_build_object('orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.orders o),
      'suborders',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.order_suborders s),
      'receivables',(SELECT jsonb_agg(to_jsonb(r) ORDER BY order_id) FROM private.manual_receivables r)) snapshot`)).snapshot;
  const finances = await financialSnapshot();
  const flags = (await scalar('SELECT to_jsonb(s) flags FROM private.commercial_settings s')).flags;
  const gateways = (await db.query('SELECT * FROM private.gateway_settings ORDER BY provider')).rows;
  await db.exec(fs.readFileSync('supabase/migrations/20261026073911_phase_b_vendor_security_activation.sql', 'utf8'));
  check((await db.query('SELECT * FROM public.vendors ORDER BY id')).rows, before);
  check(await financialSnapshot(), finances);
  check((await scalar('SELECT to_jsonb(s) flags FROM private.commercial_settings s')).flags, flags);
  check((await db.query('SELECT * FROM private.gateway_settings ORDER BY provider')).rows, gateways);
  check(Number((await scalar('SELECT count(*) n FROM private.vendor_activation_requirements')).n), 0);
  // Baseline fixture does not include auth-schema triggers; use the real function.
  await db.exec(`CREATE TRIGGER phase_b_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()`);
  for (const [i, role] of [[8100, 'admin'], [8101, 'superadmin'], [8102, 'service_role'], [8103, null], [8104, { admin: true }]]) {
    await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)', [id(i), `phaseb${i}@test.invalid`, JSON.stringify({ role })]);
    check((await scalar('SELECT role FROM public.profiles WHERE id=$1', [id(i)])).role, 'customer');
  }
  await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)', [id(8110), 'phasebvendor@test.invalid', JSON.stringify({ role: 'vendor', business_name: 'Phase B', business_category: 'Meals', status: 'approved', commission_rate: 0, plan: 'premium' })]);
  const vendor = (await scalar('SELECT vendor_id FROM public.profiles WHERE id=$1', [id(8110)])).vendor_id;
  check((await scalar('SELECT status,commission_rate FROM public.vendors WHERE id=$1', [vendor])), { status: 'pending', commission_rate: '0.17' });
  check(Number((await scalar('SELECT count(*) n FROM private.vendor_activation_requirements WHERE vendor_id=$1', [vendor])).n), 1);
  await as(8100);
  await reject(`INSERT INTO public.vendors(owner_id,name,category,status,commission_rate) VALUES('${id(8100)}','Attack','Meals','approved',0)`);
  await reject(`INSERT INTO public.profiles(id,name,email,role) VALUES('${id(8199)}','Attack','a@test.invalid','admin')`);
  await reject(`UPDATE public.profiles SET role='admin' WHERE id='${id(8100)}'`);
  await reject(`SELECT public.accept_vendor_legal('${vendor}','{}','[]')`);
  await reject('SELECT * FROM private.vendor_activation_reviews');
  await reject(`SELECT private.vendor_activation_ready('${vendor}','${id(8110)}')`);
  await as(8110);
  await reject(`UPDATE public.vendors SET status='approved' WHERE id='${vendor}'`);
  await reject(`UPDATE public.vendors SET commission_rate=0 WHERE id='${vendor}'`);
  await as(1);
  await reject(`UPDATE public.vendors SET status='approved' WHERE id='${vendor}'`);
  await reject(`INSERT INTO public.vendors(owner_id,name,category,status) VALUES('${id(8100)}','Admin bypass','Meals','approved')`);
  // Existing customers can still apply through the server-owned conversion RPC.
  await as(8101);
  const converted = (await scalar("SELECT public.become_vendor('Converted Phase B','Meals',NULL) r")).r;
  check(converted.status, 'pending');
  check((await scalar("SELECT public.become_vendor('Converted Phase B','Meals',NULL) r")).r.vendor_id, converted.vendor_id);
  await root();
  // Prove the defense-in-depth guard independently of revoked INSERT grants.
  await db.exec('GRANT INSERT ON public.vendors TO authenticated; CREATE POLICY phase_b_probe ON public.vendors FOR INSERT TO authenticated WITH CHECK(true)');
  await as(8102);
  for (const fields of ["status='approved'", 'commission_rate=0', "plan='subscription'", 'analytics_enabled=true', "subscription_tier='premium'", 'featured=true']) {
    const [column, value] = fields.split('=');
    await reject(`INSERT INTO public.vendors(owner_id,name,category,${column}) VALUES('${id(8102)}','Attack','Meals',${value})`, /pending|commercial|enum/i);
  }
  await reject(`INSERT INTO public.vendors(owner_id,name,category) VALUES('${id(8110)}','Other owner','Meals')`);
  await root();
  await db.exec('DROP POLICY phase_b_probe ON public.vendors; REVOKE INSERT ON public.vendors FROM authenticated');
  // All approvals below are synthetic, private and confined to this destroyed DB.
  await db.exec("UPDATE private.commercial_settings SET onboarding_enforced=false");
  await as(1);
  const action = async (a, value) => (await scalar('SELECT public.admin_commercial_action($1,$2) r', [a, JSON.stringify(value)])).r;
  await action('business', { businessAddress: 'SYNTHETIC TEST ONLY', legalNoticeAddress: 'SYNTHETIC TEST ONLY', vatTreatment: 'SYNTHETIC TEST ONLY', informationOfficer: 'Test officer', informationOfficerContact: 'test@test.invalid' });
  const documents = {};
  for (const kind of ['vendor-agreement', 'vendor-fees', 'privacy', 'refund-policy']) {
    const d = await action('document', { kind, version: 'phase-b-synthetic', title: 'SYNTHETIC TEST ONLY', content: 'SYNTHETIC TEST ONLY. This is not an approved legal document or production publication.', effective_at: '2026-01-01T00:00:00Z' });
    await action('approve_document', { id: d.id, approvalReference: 'SYNTHETIC DISPOSABLE TEST ONLY' }); documents[kind] = d.id;
  }
  await as(8110);
  const accept = () => scalar('SELECT public.accept_vendor_legal($1,$2,$3) receipt', [vendor, JSON.stringify(documents), JSON.stringify(Array(8).fill(true))]);
  const receipt = (await accept()).receipt;
  check((await accept()).receipt, receipt);
  await as(8101); await reject(`SELECT public.accept_vendor_legal('${vendor}','{}','[]')`);
  await root();
  await db.exec(`UPDATE public.profiles SET suspended=true WHERE id='${id(8110)}'`);
  await as(8110); await reject(`SELECT public.accept_vendor_legal('${vendor}','{}','[]')`);
  await root(); await db.exec(`UPDATE public.profiles SET suspended=false WHERE id='${id(8110)}'`);
  await as(1); await reject(`UPDATE public.vendors SET status='approved' WHERE id='${vendor}'`);
  const bank = (await scalar('SELECT public.submit_vendor_payment_profile($1,$2,true,false) id', [vendor, JSON.stringify({ accountHolder: 'Synthetic vendor', bank: 'Test bank', accountNumber: '123456789', branchCode: '123456', accountType: 'Current' })])).id;
  // A different administrator must approve the bank profile.
  await root(); await db.exec(`UPDATE public.profiles SET role='admin' WHERE id='${id(8104)}'`);
  await as(8104); await db.query('SELECT public.approve_vendor_payment_profile($1,$2)', [bank, 'SYNTHETIC independent bank verification only']);
  await root();
  const hash = (await scalar("SELECT documents->'vendor-fees'->>'content_hash' hash FROM private.vendor_legal_acceptances WHERE id=$1", [receipt])).hash;
  const review = async (overrides = {}) => {
    const p = { owner: id(8110), acceptance: receipt, bank, hash, ...overrides };
    await db.query(`INSERT INTO private.vendor_activation_reviews(vendor_id,owner_id,acceptance_id,payment_profile_id,compliance_reference,compliance_valid_until,schedules_reference,schedules_hash,reviewed_by)
      VALUES($1,$2,$3,$4,'SYNTHETIC verified premises and food documents',clock_timestamp()+interval '1 day','SYNTHETIC complete executed vendor schedules',$5,$6)`, [vendor, p.owner, p.acceptance, p.bank, p.hash, id(1)]);
  };
  await db.query(`INSERT INTO private.vendor_activation_reviews(vendor_id,owner_id,acceptance_id,payment_profile_id,compliance_reference,compliance_valid_until,schedules_reference,schedules_hash,reviewed_by,reviewed_at)
    VALUES($1,$2,$3,$4,'SYNTHETIC expired food verification','2021-01-01','SYNTHETIC complete vendor schedules',$5,$6,'2020-01-01')`, [vendor, id(8110), receipt, bank, hash, id(1)]);
  await as(1); await reject(`UPDATE public.vendors SET status='approved' WHERE id='${vendor}'`);
  const pendingBank = (await scalar('SELECT public.submit_vendor_payment_profile($1,$2,true,false) id', [vendor, JSON.stringify({ accountHolder: 'Synthetic pending', bank: 'Test bank', accountNumber: '987654321', branchCode: '123456', accountType: 'Current' })])).id;
  await root(); await review({ bank: pendingBank });
  await as(1); await reject(`UPDATE public.vendors SET status='approved' WHERE id='${vendor}'`);
  await root(); await review({ owner: id(8102) });
  await as(1); await reject(`UPDATE public.vendors SET status='approved' WHERE id='${vendor}'`);
  await root();
  await review({ hash: '0'.repeat(64) });
  await as(1); await reject(`UPDATE public.vendors SET status='approved' WHERE id='${vendor}'`);
  await root(); await review();
  await as(1); await db.query("UPDATE public.vendors SET status='approved' WHERE id=$1", [vendor]);
  check((await scalar('SELECT status FROM public.vendors WHERE id=$1', [vendor])).status, 'approved');
  // Stale document versions invalidate restoration, not existing order rows.
  await db.query("UPDATE public.vendors SET status='suspended' WHERE id=$1", [vendor]);
  const newer = await action('document', { kind: 'vendor-fees', version: 'phase-b-synthetic-new', title: 'SYNTHETIC TEST ONLY', content: 'SYNTHETIC TEST ONLY. A changed fee schedule requires a fresh authenticated receipt.', effective_at: '2026-01-01T00:00:00Z' });
  await action('approve_document', { id: newer.id, approvalReference: 'SYNTHETIC DISPOSABLE TEST ONLY' });
  await reject(`UPDATE public.vendors SET status='approved' WHERE id='${vendor}'`, /activation|current approved/i);
  await root();
  await reject(`UPDATE private.vendor_activation_reviews SET schedules_hash=repeat('0',64)`, /immutable/i);
  await reject('DELETE FROM private.vendor_activation_requirements', /immutable/i);
  // Legacy approved vendors retain negotiated rates and ordinary profile edits.
  const legacy = before.find(v => v.status === 'approved' && v.owner_id);
  assert.ok(legacy, 'Expected an existing approved fixture');
  await as(1);
  await db.query('UPDATE public.vendors SET tagline=$1 WHERE id=$2', ['Phase B compatibility', legacy.id]);
  check((await scalar('SELECT status,commission_rate FROM public.vendors WHERE id=$1', [legacy.id])), { status: legacy.status, commission_rate: legacy.commission_rate });
  await db.query("UPDATE public.vendors SET status='suspended' WHERE id=$1", [legacy.id]);
  await db.query("UPDATE public.vendors SET status='approved' WHERE id=$1", [legacy.id]);
  check((await scalar('SELECT status FROM public.vendors WHERE id=$1', [legacy.id])).status, 'approved');
  await reject(`UPDATE public.vendors SET owner_id='${id(8102)}' WHERE id='${legacy.id}'`);
  await root();
  check((await scalar("SELECT to_regclass('public.vendor_agreement_acceptances') duplicate")).duplicate, null);
  console.log(`${checks} Phase B security and compatibility assertions passed in disposable in-memory PGlite. No hosted writes.`);
}
