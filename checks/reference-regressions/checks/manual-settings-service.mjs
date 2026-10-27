import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {manualSettingsError} from '../src/utils/manualSettingsError.js';
const calls=[];let error=null;
const context=vm.createContext({supabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:null,error};}}});
vm.runInContext(fs.readFileSync('src/services/manualPaymentService.js','utf8').replace(/^import.*\n/,'').replace(/export /g,'')+'\nthis.service=manualPaymentService;',context);
const revision='a'.repeat(32);
await context.service.settings(false,false,'15','500','Synthetic settings reason',revision);
assert.equal(calls[0].name,'admin_manual_settings_checked');
assert.equal(calls[0].args.p_expected_revision,revision);assert.equal(calls[0].args.p_minutes,15);assert.equal(calls[0].args.p_threshold,500);
error={code:'42501',message:'private.internal SQL diagnostic'};
await assert.rejects(()=>context.service.settings(false,false,15,500,'Synthetic settings reason',revision),e=>e.code==='42501');
for(const [code,text]of [['42501','active administrator'],['40001','changed'],['PGRST202','not installed'],['22023','deadline']]){
 const message=manualSettingsError({code,message:'private.internal SQL diagnostic'});assert.ok(message.includes(text));assert.ok(!message.includes('private.internal'));
}
assert.match(manualSettingsError({message:'collection activation authorisation required'}),/activation gate/);
assert.match(manualSettingsError({message:'Network unavailable'}),/connection/);
console.log('15 settings RPC/code-preservation/safe-error assertions passed; no HTTP requests.');
