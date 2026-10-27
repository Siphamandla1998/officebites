import assert from 'node:assert/strict';
import {releaseRequestError} from '../src/utils/releaseAvailability.js';
for(const code of ['PGRST202','42883']){
 const error=releaseRequestError({code,message:'Could not find public.internal_rpc in schema cache'},'Fallback');
 assert.equal(error.code,code);assert.match(error.message,/unavailable/);assert.doesNotMatch(error.message,/internal_rpc|schema cache/);
}
const stale=releaseRequestError({code:'40001',message:'Settings changed; reload and review'},'Fallback');
assert.equal(stale.code,'40001');assert.equal(stale.message,'Settings changed; reload and review');
assert.equal(releaseRequestError(null,'Fallback').message,'Fallback');
console.log('9 missing-contract/stale-error assertions passed.');
