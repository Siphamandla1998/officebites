import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const constants=readFileSync(new URL('../src/utils/constants.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/utils/orderRules.js',import.meta.url),'utf8').replace('"./constants"',JSON.stringify('data:text/javascript;base64,'+Buffer.from(constants).toString('base64')));
const rules=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let count=0;
function check(fn){fn();count++;}
check(()=>assert.equal(rules.deliveryDateKey(rules.nextOrderableDate(new Date('2026-10-07T16:59:59Z'))),'2026-10-08'));
check(()=>assert.equal(rules.deliveryDateKey(rules.nextOrderableDate(new Date('2026-10-07T17:00:00Z'))),'2026-10-09'));
check(()=>assert.equal(rules.deliveryDateKey(rules.nextOrderableDate(new Date('2026-10-07T22:30:00Z'))),'2026-10-09'));
check(()=>assert.equal(rules.deliveryDateKey(rules.nextOrderableDate(new Date('2026-12-31T22:30:00Z'))),'2027-01-02'));
check(()=>assert.equal(rules.isOrderingOpen('2026-10-08',new Date('2026-10-07T16:59:59Z')),true));
check(()=>assert.equal(rules.isOrderingOpen('2026-10-08',new Date('2026-10-07T17:00:00Z')),false));
check(()=>assert.deepEqual(rules.calcCommission(100),{commission:17,vendorPayout:83}));
check(()=>assert.deepEqual(rules.calcCommission(100,.12),{commission:12,vendorPayout:88}));
check(()=>assert.equal(rules.calcCommission(65,.17).commission,11.05));
console.log(`${count} order/date/commission checks passed (${process.env.TZ || 'system timezone'})`);
