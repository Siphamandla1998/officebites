// Recovery release boundary: no new backend contracts or changes to payment/security invariants.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const baseline = 'f5db4af98ec502bb98e6eb39fbae237befb7b8c9';
const unchanged = ['supabase', 'src/components/features/AccountRemoval.jsx', 'src/services/adminService.js', 'src/pages/admin/AdminCustomers.jsx', 'src/pages/admin/AdminOverview.jsx', 'src/pages/admin/AdminPayments.jsx', 'src/services/paymentService.js', 'src/utils/orderRules.js', 'src/utils/constants.js', 'vite.config.js', 'src/styles'];
assert.equal(execFileSync('git', ['diff', '--name-only', baseline, '--', ...unchanged], {encoding:'utf8'}).trim(), '', 'Recovery must not alter backend or preserved invariants');
assert.ok(!fs.existsSync('supabase/migrations/20261008185732_production_audit_cleanup.sql'));
const files = fs.readdirSync('src', {recursive:true}).filter(f=>/\.(jsx?|tsx?)$/.test(f));
for(const file of files) {
 const text=fs.readFileSync('src/'+file,'utf8');
 assert.doesNotMatch(text,/admin_recent_payments|admin_customer_favourite_counts|prepare_payfast_order|production_audit_cleanup/,file);
}
console.log('Recovery boundary passed: no corrective migration/callers; backend, PayFast, commission, deferred screens and PWA/cache/style invariants unchanged.');
