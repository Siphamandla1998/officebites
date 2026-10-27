import assert from 'node:assert/strict';
import {catalogueSearchFilter,deliveryWeekday} from '../src/utils/catalogueFilters.js';
assert.equal(deliveryWeekday('2026-10-08'),4);
assert.equal(deliveryWeekday('2027-01-01'),5);
assert.equal(deliveryWeekday(new Date(2026,9,8,12)),4);
assert.equal(catalogueSearchFilter(['name','category'],'chicken, rice'),'name.ilike."%chicken, rice%",category.ilike."%chicken, rice%"');
assert.equal(catalogueSearchFilter(['name'],'quote "chef"'),'name.ilike."%quote \\"chef\\"%"');
assert.equal(catalogueSearchFilter(['name'],'back\\slash'),'name.ilike."%back\\\\slash%"');
console.log(`6 catalogue/date checks passed (${process.env.TZ || 'system'})`);
