// Read-only Git/file inventory; writes evidence only inside this release worktree.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const git=args=>execFileSync('git',['-c','core.quotepath=false',...args],{encoding:'utf8',maxBuffer:8e6}).trim();
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(git(['branch','--show-current'])!=='release/vendor-eft-legal-launch')throw new Error('Release worktree required');
const files=[...new Set([...git(['diff','--name-only','HEAD']).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')])].filter(p=>p&&fs.existsSync(p)).sort();
const manifests=new Set(['docs/release/repair-file-manifest.json','docs/release/production-migration-manifest.json']);
const rows=files.filter(p=>!manifests.has(p)).map(file=>({file,sha256:hash(file),bytes:fs.statSync(file).size}));
fs.writeFileSync('docs/release/repair-file-manifest.json',JSON.stringify({observedUtc:new Date().toISOString(),base:git(['rev-parse','HEAD']),verifiedProductionSource:'4b94fbe89e8b5a672e4f308701df61c1224580fd',files:rows,selfExcluded:[...manifests]},null,2));
const migrations=['20261027093453_production_launch_browser_grants.sql','20261027112327_production_minimum_manual_legal_foundation.sql','20261027112437_production_checked_settings.sql','20261027115843_production_compliance_storage_owner_policies.sql'];
fs.writeFileSync('docs/release/production-migration-manifest.json',JSON.stringify({observedUtc:new Date().toISOString(),target:'gfzhdkitdyqftealgqfi',installed:false,approved:false,baseline:{count:38,latest:'20261010101910'},steps:migrations.map((name,i)=>({order:i+1,file:'release/production-candidates/'+name,version:name.slice(0,14),name:name.slice(15,-4),executor:i===3?'separately approved managed supabase_storage_admin owner':'postgres (non-superuser, BYPASSRLS)',sha256:hash('release/production-candidates/'+name),requires:i?migrations[i-1]:'independently verified production preflight',transaction:'one BEGIN/COMMIT per file; authorized runner records ledger only after successful commit'})),expectedFinalHistoryCount:42,stagingCompatible:false,excludedSourceOnly:'20261027094852 transition guard is composed into step 3; NEVER apply it twice'},null,2));
if(!process.argv.includes('--refresh-files-only')){
const productionFiles=git(['ls-tree','-r','--name-only','4b94fbe89e8b5a672e4f308701df61c1224580fd','--','src','package.json','package-lock.json','vite.config.js','vercel.json']).split('\n');
const comparison=productionFiles.map(file=>{const blob=execFileSync('git',['show','4b94fbe89e8b5a672e4f308701df61c1224580fd:'+file],{maxBuffer:8e6});return {file,productionSha256:createHash('sha256').update(blob).digest('hex'),releaseSha256:fs.existsSync(file)?hash(file):null};});
fs.writeFileSync('docs/release/repair-source-comparison.json',JSON.stringify({productionCommit:'4b94fbe89e8b5a672e4f308701df61c1224580fd',releaseBase:git(['rev-parse','HEAD']),files:comparison},null,2));
console.log('Complete runtime comparison:',comparison.length,'paths.');
}
console.log('Release manifest:',rows.length,'files; ordered production delta:',migrations.length,'files. No Git mutation.');
