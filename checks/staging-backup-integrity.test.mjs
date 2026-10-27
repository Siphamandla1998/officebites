// Synthetic bytes only, outside Git. Does not export or restore any database.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';
import {createManifest,verifyManifest,compareEvidence,privateRoot} from './staging-backup-integrity.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'officebites-backup-integrity-'));
assert.ok(root.startsWith(path.join(os.tmpdir(),'officebites-backup-integrity-')));
let assertions=0;
try{
 assert.throws(()=>privateRoot(process.cwd()));assertions++;
 fs.writeFileSync(path.join(root,'.git'),'SYNTHETIC git marker');
 assert.throws(()=>privateRoot(root));assertions++;fs.unlinkSync(path.join(root,'.git'));
 for(const name of ['roles.sql','database.dump','archive.toc','source-catalog.jsonl','source-data.jsonl'])fs.writeFileSync(path.join(root,name),'SYNTHETIC TEST BYTES '+name);
 assert.equal((await createManifest(root)).files.length,5);assertions++;
 assert.equal((await verifyManifest(root)).verified,true);assertions++;
 await assert.rejects(createManifest(root));assertions++;
 fs.appendFileSync(path.join(root,'database.dump'),'corrupt');
 await assert.rejects(verifyManifest(root));assertions++;
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 manifest.files[0].name='../outside.sql';fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest));
 await assert.rejects(verifyManifest(root));assertions++;
 const a=path.join(root,'a.jsonl'),b=path.join(root,'b.jsonl');
 fs.writeFileSync(a,'{"kind":"counts","value":2}\n{"kind":"catalog","value":"same"}\n');
 fs.writeFileSync(b,'{"kind":"catalog","value":"same"}\n{"kind":"counts","value":2}\n');
 assert.equal(compareEvidence(a,b),true);assertions++;
 fs.appendFileSync(b,'{"kind":"extra"}\n');assert.throws(()=>compareEvidence(a,b));assertions++;
 console.log(assertions+' synthetic integrity/path/tampering/evidence assertions passed; no database restore performed.');
}finally{
 // Only files created in this positively identified synthetic temp directory.
 for(const entry of fs.readdirSync(root)){const file=path.join(root,entry);assert.equal(path.dirname(file),root);assert.ok(fs.lstatSync(file).isFile());fs.unlinkSync(file);}
 fs.rmdirSync(root);
}
