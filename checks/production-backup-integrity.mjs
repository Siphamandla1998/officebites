// Hash/compare private operator artifacts only. No network or database operations.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const project='gfzhdkitdyqftealgqfi';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const required=['roles.sql','database.dump','archive.toc','source-catalog.jsonl','source-data.jsonl'];
export function privateRoot(directory){
 const root=fs.realpathSync(directory);
 const relative=path.relative(repository,root);
 assert.ok(relative.startsWith('..'+path.sep)||path.isAbsolute(relative),'Backup must be outside the entire officebites repository');
 assert.ok(!root.startsWith('\\\\'),'Network paths require a separate reviewed storage process');
 assert.ok(fs.statSync(root).isDirectory(),'Directory required');
 for(let ancestor=root;;){
  assert.ok(!fs.existsSync(path.join(ancestor,'.git')),'Backup cannot be inside any Git repository/worktree');
  const parent=path.dirname(ancestor);if(parent===ancestor)break;ancestor=parent;
 }
 return root;
}
async function digest(file){
 const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');
}
function fileAt(root,name){
 assert.ok(typeof name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name),'Basename only');
 const file=path.join(root,name),stat=fs.lstatSync(file);
 assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1,'Regular, unlinked file required');
 assert.equal(fs.realpathSync(file),file,'Reparse/symlink redirection forbidden');
 assert.ok(stat.size>0,'Empty artifact');return {file,stat};
}
export async function createManifest(directory){
 const root=privateRoot(directory),files=[];
 for(const name of required){const {file,stat}=fileAt(root,name);files.push({name,bytes:stat.size,sha256:await digest(file)});}
 const manifest={project,createdUtc:new Date().toISOString(),kind:'operator-logical-export',files,
  limitations:'Hashes prove byte consistency, not origin/authenticity, completeness, successful restore, ACL privacy, encryption or external-state recovery.'};
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
 return manifest;
}
export async function verifyManifest(directory){
 const root=privateRoot(directory);fileAt(root,'manifest.json');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 assert.equal(manifest.project,project);assert.equal(manifest.kind,'operator-logical-export');
 assert.deepEqual(manifest.files.map(f=>f.name).sort(),[...required].sort());
 for(const item of manifest.files){const {file,stat}=fileAt(root,item.name);assert.equal(stat.size,item.bytes,'Size mismatch: '+item.name);assert.equal(await digest(file),item.sha256,'Hash mismatch: '+item.name);}
 return {files:manifest.files.length,verified:true};
}
export function compareEvidence(sourceFile,restoredFile){
 const read=p=>fs.readFileSync(p,'utf8').split(/\r?\n/).filter(l=>l.trim()).map(l=>JSON.parse(l));
 const sorted=rows=>rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 assert.deepEqual(sorted(read(sourceFile)),sorted(read(restoredFile)),'Recovery evidence differs');
 return true;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [action,folder,other]=process.argv.slice(2);
  if(action==='create'&&!other){const result=await createManifest(folder);console.log('Integrity manifest created for '+result.files.length+' private artifacts; restore not verified.');}
  else if(action==='verify'&&!other){await verifyManifest(folder);console.log('Five private artifact hashes verified; restore not verified.');}
  else if(action==='compare'&&folder&&other){privateRoot(path.dirname(folder));privateRoot(path.dirname(other));compareEvidence(folder,other);console.log('Evidence comparison passed; scope depends on supplied captures.');}
  else throw Error('Usage: create|verify PRIVATE_DIRECTORY, or compare SOURCE_JSONL RESTORED_JSONL');
 }catch{console.error('Private backup validation failed. Inspect files privately; no paths, data or secrets printed.');process.exitCode=1;}
}
