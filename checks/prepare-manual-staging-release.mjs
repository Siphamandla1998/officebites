// Local source packaging only. No Git writes, network, environment reads or deployment.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const base=path.resolve(root,'.officebites-local/staging-release-20261020');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const files=[];
function collect(relative){
 const absolute=path.resolve(root,relative);
 if(!absolute.startsWith(root+path.sep))throw Error('Source outside workspace');
 const stat=fs.lstatSync(absolute);
 if(stat.isSymbolicLink())throw Error('Symlinks are not accepted in release source: '+relative);
 if(stat.isDirectory())for(const name of fs.readdirSync(absolute).sort())collect(path.join(relative,name));
 else if(stat.isFile())files.push(relative.replaceAll(path.sep,'/'));
}
for(const name of ['src','public','index.html','package.json','package-lock.json','vite.config.js','tailwind.config.js','postcss.config.js','vercel.json'])collect(name);
const generated={
 '.vercel/project.json':JSON.stringify({projectId:'prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71',orgId:'team_kKRzCLk1pNHoIA4sV1M0ciSg',projectName:'officebites'},null,2)+'\n',
 '.vercelignore':'.git\nnode_modules\ndist\n.env*\nchecks\ndocs\n',
};
const entries=[...files.sort().map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))})),...Object.entries(generated).map(([file,content])=>({file,sha256:hash(content)}))].sort((a,b)=>a.file.localeCompare(b.file));
const fingerprint=hash(JSON.stringify(entries));
const destination=path.join(base,'candidate-'+fingerprint.slice(0,12));
fs.mkdirSync(destination,{recursive:true});
for(const entry of entries){
 const target=path.join(destination,entry.file);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 if(fs.existsSync(target)&&hash(fs.readFileSync(target))!==entry.sha256)throw Error('Existing release source was modified: '+entry.file);
 if(Object.hasOwn(generated,entry.file))fs.writeFileSync(target,generated[entry.file]);
 else fs.copyFileSync(path.join(root,entry.file),target);
}
const migration='supabase/migrations/20261020090841_vendor_direct_manual_payments.sql';
const manifest={projectId:'eyhmarmekioovcjibcbr',vercelProjectId:'prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71',vercelTeamId:'team_kKRzCLk1pNHoIA4sV1M0ciSg',deploymentTarget:'preview',sourceFingerprint:fingerprint,sourceDirectory:destination,migration,migrationSha256:hash(fs.readFileSync(migration)),schemaPreimageSha256:hash(fs.readFileSync(path.join(base,'schema-preimage.json'))),entries};
fs.writeFileSync(path.join(base,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({sourceDirectory:destination,sourceFingerprint:fingerprint,migrationSha256:manifest.migrationSha256,schemaPreimageSha256:manifest.schemaPreimageSha256,sourceFiles:entries.length,envFilesIncluded:false,hostedWrites:false},null,2));
