import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { authError } from '../src/utils/authError.js';
let profile,profileError=null,session,error,reset,updated;
const supabase={auth:{
 getSession:async()=>({data:{session},error}),
 signInWithPassword:async()=>({data:{user:{id:'synthetic'},session:{access_token:'synthetic'}},error}),
 resetPasswordForEmail:async(email,options)=>{reset={email,options};return {error};},
 updateUser:async input=>{updated=input;return {error};},
},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:profile,error:profileError})})};
const source=fs.readFileSync('src/services/authService.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export const authService','const authService');
const context={supabase,authError,window:{location:{origin:'https://uat.example.invalid'}},setTimeout,console};
vm.createContext(context);vm.runInContext(source+'\nthis.service=authService',context);
const service=context.service;let assertions=0;
for(const role of ['customer','vendor','admin']){
 profile={id:'synthetic',name:'Synthetic',role,vendor_id:role==='vendor'?'synthetic-vendor':null};
 session={user:{id:profile.id}};
 assert.equal((await service.login({email:'synthetic@example.invalid',password:'synthetic'})).user.role,role);assertions++;
 assert.equal((await service.getCurrentUser()).role,role);assertions++;
}
for(const value of [{role:'admin',suspended:true},{role:'admin',deleted_at:'2026-10-01'},{role:'invented'},{role:'vendor',vendor_id:null}]){
 profile={id:'synthetic',...value};
 await assert.rejects(()=>service.getCurrentUser());assertions++;
}
profileError={code:'42501'};
await assert.rejects(()=>service.getCurrentUser(),e=>e.code==='42501');assertions++;
profileError={code:'PGRST116'};
await assert.rejects(()=>service.getCurrentUser(),e=>e.code==='PGRST116'&&e.message.includes('account is unavailable'));assertions++;
profileError=null;
session=null;assert.equal(await service.getCurrentUser(),null);assertions++;
error={code:'refresh_token_not_found'};
await assert.rejects(()=>service.getCurrentUser(),e=>e.code==='refresh_token_not_found'&&e.message.includes('expired'));assertions++;
error=null;
await service.requestPasswordReset('synthetic@example.invalid');
assert.equal(reset.options.redirectTo,'https://uat.example.invalid/reset-password');assertions++;
await service.updatePassword('synthetic-new-password');assert.equal(updated.password,'synthetic-new-password');assertions++;
error={message:'Synthetic expired recovery session',status:401};
await assert.rejects(()=>service.updatePassword('synthetic'),e=>e.status===401);assertions++;
await assert.rejects(()=>service.requestPasswordReset('synthetic@example.invalid'),e=>e.status===401);assertions++;
console.log(`${assertions} auth service assertions passed; no hosted authentication or email.`);
