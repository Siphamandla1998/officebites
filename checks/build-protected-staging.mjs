// Local build only. Public config comes from this process, never copied into .env.
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const expected='eyhmarmekioovcjibcbr.supabase.co';
const url=new URL(process.env.VITE_SUPABASE_URL||'https://missing.invalid');
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'';
if(url.href!=='https://'+expected+'/' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))throw new Error('Exact staging URL and modern publishable key required');
const hash=createHash('sha256').update(key).digest('hex');
if(hash!==process.env.OFFICEBITES_STAGING_PUBLIC_KEY_SHA256)throw new Error('Public key must match the independently retrieved staging key fingerprint');
const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','protected-staging','--configLoader','native'],{stdio:'inherit',env:process.env});
if(build.status!==0)process.exit(build.status||1);
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const assets=walk('dist').filter(p=>p.endsWith('.js'));
const hosts=new Set();
for(const file of assets){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/https:\/\/([a-z0-9]+\.supabase\.co)/g))hosts.add(m[1]);}
if(hosts.size!==1 || !hosts.has(expected))throw new Error('Built frontend has an unexpected or absent Supabase target');
fs.writeFileSync('docs/release/protected-staging-build.json',JSON.stringify({observedUtc:new Date().toISOString(),mode:'protected-staging',hostname:expected,publicKeySha256:hash,keyMembership:'matched read-only project public-key API',javascriptAssets:assets.length,compiledHosts:[...hosts],assets:assets.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),deployed:false,activeTests:false},null,2));
console.log('Local build verified: staging target only; no deployment or active hosted tests.');
