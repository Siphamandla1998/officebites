import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let result, filters, selected;
const supabase={from:()=>({
 update(){return this;}, eq(key,value){filters.push([key,value]);return this;},
 select(columns){selected=columns;return this;},single(){return Promise.resolve(result);},
 then(resolve){return Promise.resolve({data:null,error:null}).then(resolve);},
})};
function load(file,name){
 const source=fs.readFileSync(file,'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replace('export const '+name,'const '+name);
 const context={supabase,ROLES:{CUSTOMER:'customer'},VENDOR_STATUS:{APPROVED:'approved',SUSPENDED:'suspended',REJECTED:'rejected'}};
 vm.createContext(context);vm.runInContext(source+'\nthis.service='+name,context);return context.service;
}
const admin=load('src/services/adminService.js','adminService');
const vendor=load('src/services/vendorService.js','vendorService');
let assertions=0;
for(const [service,method] of [[admin,'suspendCustomer'],...[ 'approveVendor','restoreVendor','rejectVendor','suspendVendor'].map(m=>[vendor,m])]){
 filters=[];selected=null;result={data:null,error:{code:'PGRST116',message:'No visible row changed'}};
 await assert.rejects(()=>service[method]('synthetic-id'),error=>error.message==='No visible row changed');assertions++;
 assert.equal(selected,'id');assertions++;
 result={data:{id:'synthetic-id'},error:null};
 await service[method]('synthetic-id');assertions++;
 if(method==='suspendCustomer'){assert.ok(filters.some(([k,v])=>k==='role'&&v==='customer'));assertions++;}
 if(method==='restoreVendor'){assert.ok(filters.some(([k,v])=>k==='status'&&v==='suspended'));assertions++;}
}
console.log(`${assertions} management action assertions passed; zero-row writes cannot report success.`);
