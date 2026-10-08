import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
let user={id:'audit-user'}, rpcError=null, uploads=0, removed=0;
const calls=[];
const ticket={id:'audit-ticket',ticket_number:'SUP-AUDIT',subject:'Audit',category:'technical',requester_id:'audit-user',support_ticket_messages:[{id:'audit-message',body:'Hello',sender_role:'customer',internal:false}]};
globalThis.__supportMocks={
 BUCKETS:{SUPPORT_ATTACHMENTS:'support-attachments'},
 uploadPrivate:async(bucket,path)=>{uploads++;return path;},getSignedUrl:async()=>null,
 supabase:{auth:{getUser:async()=>({data:{user},error:null})},
 from:table=>table==='profiles'?{select:()=>({eq:()=>({maybeSingle:async()=>({data:{name:'Audit',email:'audit@example.invalid'},error:null})})})}:{insert:async row=>{calls.push({table,row});return {error:null};}},
 rpc:async(name,args)=>{calls.push({name,args});return {data:ticket,error:rpcError};},
 storage:{from:()=>({remove:async()=>{removed++;return {error:null};}})}
 }
};
const source=readFileSync(new URL('../src/services/supportService.js',import.meta.url),'utf8').replace(/import\s*\{[\s\S]*?\}\s*from\s*"\.\/api\/supabaseClient";/,'const {supabase,uploadPrivate,getSignedUrl,BUCKETS}=globalThis.__supportMocks;');
const {supportService}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let checks=0;
const result=await supportService.submitContactForm({subject:'Audit',message:'Hello',category:'Technical Issues'});
assert.equal(result.id,'audit-ticket');assert.equal(result.messages[0].text,'Hello');assert.equal(calls[0].args.p_category,'technical');checks++;
const before=calls.length;
await assert.rejects(()=>supportService.submitContactForm({subject:'Audit',message:'x'.repeat(5001),attachment:{name:'audit.png'}}),/5000/);assert.equal(uploads,0);assert.equal(calls.length,before);checks++;
user=null;await supportService.submitFeedback({rating:5,comment:'Guest feedback',recommend:true});assert.equal(calls.at(-1).row.user_id,null);checks++;
user={id:'audit-user'};await supportService.submitFeedback({rating:4,comment:'Member feedback',recommend:false});assert.equal(calls.at(-1).row.user_id,'audit-user');checks++;
const prior=calls.length;await assert.rejects(()=>supportService.submitFeedback({rating:6}),/1 to 5/);assert.equal(calls.length,prior);checks++;
rpcError={code:'23514',message:'Definite database rejection'};
await assert.rejects(()=>supportService.submitContactForm({subject:'Audit',message:'Hello',attachment:{name:'audit.png'}}),/Definite/);assert.equal(removed,1);checks++;
rpcError={message:'Network interrupted'};
await assert.rejects(()=>supportService.submitContactForm({subject:'Audit',message:'Hello',attachment:{name:'audit.png'}}),/Network/);assert.equal(removed,1);checks++;
console.log(`${checks} frontend support contract checks passed`);
