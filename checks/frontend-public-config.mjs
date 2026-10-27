import assert from 'node:assert/strict';
import { loadEnv } from 'vite';
export function assessPublicConfig(env) {
 const url=env.VITE_SUPABASE_URL;const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;const missing=['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY'].filter(k=>!env[k]);
 if(missing.length)return {ready:false,reason:'missing_public_configuration',missing};
 let parsed;try{parsed=new URL(url);}catch{return {ready:false,reason:'invalid_url'};}
 if(parsed.username || parsed.password || parsed.search || parsed.hash)return {ready:false,reason:'invalid_url'};
 if(parsed.hostname==='gfzhdkitdyqftealgqfi.supabase.co')return {ready:false,reason:'production_project_forbidden'};
 if(!['eyhmarmekioovcjibcbr.supabase.co','127.0.0.1','localhost'].includes(parsed.hostname))return {ready:false,reason:'unverified_project'};
 if(parsed.hostname.endsWith('.supabase.co')&&parsed.protocol!=='https:')return {ready:false,reason:'https_required'};
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return {ready:false,reason:'publishable_key_required'};
 return {ready:true,reason:'public_pair_present',target:parsed.hostname.endsWith('.supabase.co')?'staging':'local_disposable',keyMembership:'not_verified_by_format'};
}
if(process.argv.includes('--self-test')) {
 const staging='https://eyhmarmekioovcjibcbr.supabase.co';const key='sb_publishable_SYNTHETIC';
 for(const [env,expected] of [[{},false],[{VITE_SUPABASE_URL:staging},false],[{VITE_SUPABASE_URL:staging,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_SYNTHETIC'},false],[{VITE_SUPABASE_URL:'https://gfzhdkitdyqftealgqfi.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:key},false],[{VITE_SUPABASE_URL:'https://other.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:key},false],[{VITE_SUPABASE_URL:staging,VITE_SUPABASE_PUBLISHABLE_KEY:key},true]])assert.equal(assessPublicConfig(env).ready,expected);
 console.log('6 secret-safe frontend configuration assertions passed. No values printed or requests sent.');
} else {
 const result=assessPublicConfig(loadEnv(process.env.OFFICEBITES_VITE_MODE || 'production',process.cwd(),'VITE_'));
 console.log(JSON.stringify(result));if(!result.ready)process.exitCode=2;
}