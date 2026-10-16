import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import type { OzowDependencies } from './ozow-handlers.ts';
export function ozowRuntime(): OzowDependencies {
  const url=Deno.env.get('SUPABASE_URL')||'';
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
  const userClient=(req:Request)=>createClient(url,Deno.env.get('SUPABASE_ANON_KEY')||'',{
    global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false,autoRefreshToken:false},
  });
  return {
    env:name=>Deno.env.get(name),fetcher:fetch,
    rpc:async(name,args)=>{const {data,error}=await admin.rpc(name,args);if(error)throw new Error('RPC rejected');return data;},
    caller:async req=>{
      if(!req.headers.get('Authorization'))return null;
      const {data,error}=await userClient(req).auth.getUser();
      // Anonymous SDK invocations may carry their public key as a bearer fallback.
      // No invalid token establishes identity; guest proof is still mandatory in the RPC.
      if(error||!data.user)return null;return data.user.id;
    },
    isAdmin:async req=>{
      const client=userClient(req);const {data,error}=await client.auth.getUser();
      if(error||!data.user)return false;
      const {data:profile,error:failure}=await client.from('profiles').select('role,suspended,deleted_at').eq('id',data.user.id).single();
      return !failure&&profile?.role==='admin'&&!profile.suspended&&!profile.deleted_at;
    },
  };
}
