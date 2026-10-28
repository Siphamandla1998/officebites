// Catalog metadata only; no customer rows or credentials. No hosted requests.
import fs from 'node:fs';
import path from 'node:path';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const live=JSON.parse(fs.readFileSync('docs/release/live-critical-catalog-20261028.json','utf8'));
const candidate=JSON.parse(fs.readFileSync('docs/release/production-delta-rpc-manifest.json','utf8')).functions;
const functions=new Map(live.functions.map(f=>[f.name,f]));
const final=new Set(candidate.filter(f=>f.schema_name==='public').map(f=>f.proname));
const inactiveFiles=new Set(['checkoutService.js']); // no runtime import in launch source
const inactiveCalls=new Set(['get_commercial_report','admin_commercial_action','respond_corporate_agreement']);
const rpcs=new Map(),tables=new Map(),edges=new Map();
const add=(map,name,file)=>{const files=map.get(name)||new Set();files.add(file.replaceAll('\\','/'));map.set(name,files);};
for(const file of walk('src').filter(f=>/\.[jt]sx?$/.test(f))){
 const source=fs.readFileSync(file,'utf8');
 for(const m of source.matchAll(/\b(?:rpc|call|financialRpc)\(\s*['"]([a-z_]+)['"]/g))add(rpcs,m[1],file);
 // Conditional order creator is the only dynamic choice of RPC name in source.
 if(source.includes("legalAcceptance ? 'create_order_with_legal' : 'create_manual_order'"))for(const name of ['create_order_with_legal','create_manual_order'])add(rpcs,name,file);
 for(const m of source.matchAll(/\.from\(\s*['"]([a-z_-]+)['"]/g))add(tables,m[1],file);
 for(const m of source.matchAll(/functions\.invoke\(\s*['"]([a-z_-]+)['"]/g))add(edges,m[1],file);
}
const rows=[...rpcs].sort().map(([name,files])=>({name,files:[...files],live:functions.get(name)||null,candidate:final.has(name),launchActive:!inactiveCalls.has(name)&&![...files].every(f=>inactiveFiles.has(path.basename(f)))}));
const report={observedDate:live.observedDate,project:live.project,method:'All src literal RPC/call/financialRpc calls plus conditional creator, literal table/storage references and Edge invocations; unused service methods identified separately. Does not certify nested selects or managed API behavior.',
 rpcs:rows,tablesAndBuckets:[...tables].sort().map(([name,files])=>({name,files:[...files],live:live.tables.find(t=>t.name===name)||null,storageBucket:name==='vendor-compliance'})),edges:[...edges].sort().map(([name,files])=>({name,files:[...files],live:['payfast-initiate','admin-account-removal'].includes(name),launchActive:name==='admin-account-removal'}))};
fs.writeFileSync('docs/release/frontend-dependencies-20261028.json',JSON.stringify(report,null,2)+'\n');
const uncovered=rows.filter(r=>r.launchActive&&!r.candidate);
console.log(JSON.stringify({rpcs:rows.length,missingLive:rows.filter(r=>r.launchActive&&!r.live).map(r=>r.name),uncoveredByCandidate:uncovered.map(r=>r.name),tables:[...tables.keys()]},null,2));
if(uncovered.length)process.exitCode=1;
