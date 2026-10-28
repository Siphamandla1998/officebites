// Explicitly supplied test accounts only. Never prints identities, passwords or tokens.
// No business writes, emails, payment or order mutation. Auth creates test sessions.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const project=process.env.OFFICEBITES_UAT_PROJECT;
if(!['gfzhdkitdyqftealgqfi','eyhmarmekioovcjibcbr'].includes(project))throw new Error('Explicit approved UAT project required');
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!key?.startsWith('sb_publishable_'))throw new Error('Independently retrieved public key required');
const accounts=JSON.parse(fs.readFileSync(process.env.OFFICEBITES_UAT_CREDENTIALS_PATH||'.officebites-local/uat-credentials.json','utf8'));
const report={observedUtc:new Date().toISOString(),project,roles:[],businessWrites:false};
const subjects=new Map();
for(const role of ['customer','vendor','admin']){
 const account=accounts[role];
 if(!account?.email||!account.password){report.roles.push({role,status:'NOT_TESTED',reason:'Approved test account unavailable'});continue;}
 // Isolate every account, including refreshed session tokens.
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(30000)})}};
 const client=createClient(`https://${project}.supabase.co`,key,options);
 const row={role};
 try{
  const {data,error}=await client.auth.signInWithPassword({email:account.email,password:account.password});
  row.login=error?'FAIL':'PASS';row.authError=error?.code||null;
  if(error){report.roles.push(row);continue;}
  subjects.set(role,data.user.id);
  const profile=await client.from('profiles').select('id,role,vendor_id,suspended,deleted_at').eq('id',data.user.id).single();
  row.actualRole=['customer','vendor','admin'].includes(profile.data?.role)?profile.data.role:null;
  row.profileError=profile.error?.code||null;
  row.suspended=Boolean(profile.data?.suspended);row.deleted=Boolean(profile.data?.deleted_at);row.vendorLinked=Boolean(profile.data?.vendor_id);
  row.profileAndRole=!profile.error&&profile.data?.role===role&&!profile.data.suspended&&!profile.data.deleted_at&&(role!=='vendor'||!!profile.data.vendor_id)?'PASS':'FAIL';
  if(role==='admin'&&row.profileAndRole==='PASS') {
   report.adminAccountDiagnostics=[];
   for(const [expected,id] of subjects) {
    if(expected==='admin')continue;
    const target=await client.from('profiles').select('role,vendor_id,suspended,deleted_at').eq('id',id).single();
    const state={expectedRole:expected,actualRole:target.data?.role||null,profileError:target.error?.code||null,suspended:Boolean(target.data?.suspended),deleted:Boolean(target.data?.deleted_at)};
    if(target.data?.vendor_id){const v=await client.from('vendors').select('status,archived_at,owner_id').eq('id',target.data.vendor_id).single();state.vendorStatus=v.data?.status||null;state.vendorArchived=Boolean(v.data?.archived_at);state.vendorOwnerMatches=v.data?.owner_id===id;}
    report.adminAccountDiagnostics.push(state);
   }
  }
  const restored=createClient(`https://${project}.supabase.co`,key,options);
  const session=await restored.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
  row.restore=!session.error&&session.data.user?.id===data.user.id?'PASS':'FAIL';
  const refreshed=await restored.auth.refreshSession();
  row.refresh=!refreshed.error&&refreshed.data.user?.id===data.user.id?'PASS':'FAIL';
  const visible=await restored.from('profiles').select('id,role');
  row.visibleProfileCount=visible.data?.length??null;
  row.profileIsolation=visible.error?'FAIL':role==='admin'?'NOT_ASSERTED_ADMIN_SCOPE':visible.data.every(p=>p.id===data.user.id)?'PASS':'FAIL';
  const workspace=await restored.rpc('manual_payment_workspace',{p_test_only:true});
  row.paymentWorkspace=workspace.error?'FAIL':'PASS';row.workspaceError=workspace.error?.code||null;
  row.logout=(await restored.auth.signOut({scope:'local'})).error?'FAIL':'PASS';
 }catch{row.status='FAIL';row.reason='Transport or client failure; sensitive response omitted';}
 finally{await client.auth.signOut({scope:'local'}).catch(()=>{});}
 report.roles.push(row);
}
fs.writeFileSync('docs/release/hosted-auth-results-20261028.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.roles.some(r=>Object.values(r).includes('FAIL')||r.status==='NOT_TESTED'))process.exitCode=1;
