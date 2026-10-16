// Recovery release boundary: no new backend contracts or changes to payment/security invariants.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const baseline = '4c4835db62b7db4c7a725c92d7a6294ca523fa57';
const unchanged = ['supabase/functions/payfast-notify', 'supabase/functions/_shared/payfast.ts', 'supabase/migrations/20261008114505_launch_financial_ledger.sql', 'supabase/migrations/20261008114550_launch_account_security_retention.sql', 'src/components/features/AccountRemoval.jsx', 'src/services/adminService.js', 'src/pages/admin/AdminCustomers.jsx', 'src/pages/admin/AdminOverview.jsx', 'src/utils/orderRules.js', 'src/utils/constants.js', 'vite.config.js', 'src/styles'];
assert.equal(execFileSync('git', ['diff', '--name-only', baseline, '--', ...unchanged], {encoding:'utf8'}).trim(), '', 'Feature must preserve existing payment confirmation, signatures, commission, auth removal and PWA invariants');
assert.ok(!fs.existsSync('supabase/migrations/20261008185732_production_audit_cleanup.sql'));
const files = fs.readdirSync('src', {recursive:true}).filter(f=>/\.(jsx?|tsx?)$/.test(f));
for(const file of files) {
 const text=fs.readFileSync('src/'+file,'utf8');
 assert.doesNotMatch(text,/admin_recent_payments|admin_customer_favourite_counts|prepare_payfast_order|production_audit_cleanup/,file);
}
console.log('Feature preservation boundary passed: legacy PayFast confirmation/signature, commission rules, account removal, PWA and styles unchanged.');
