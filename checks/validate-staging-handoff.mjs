// Local-only artifact validation. Does not connect to any database or provider.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const inventory=JSON.parse(fs.readFileSync('docs/staging/FILES.json','utf8'));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sensitive=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[0-9A-Z]{16}\b/,/\bsb_secret_[A-Za-z0-9_-]{20,}\b/,/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/];
for(const item of inventory.files){
 assert.equal(hash(item.file),item.sha256,'Artifact hash mismatch: '+item.file);
 const text=fs.readFileSync(item.file,'utf8');
 assert.ok(!sensitive.some(re=>re.test(text)),'Potential sensitive value: '+item.file);
 assert.ok(!/^(?:<{7}|>{7}) /m.test(text),'Conflict marker: '+item.file);
}
const production=JSON.parse(fs.readFileSync('docs/release/production-migration-manifest.json','utf8'));
for(const item of production.steps)assert.equal(hash(item.file),item.sha256,'Production candidate changed: '+item.file);
fs.writeFileSync('docs/release/staging-handoff-validation.json',JSON.stringify({observedUtc:new Date().toISOString(),result:'passed',artifactHashes:inventory.files.length,originalProductionCandidatesUnchanged:production.steps.length,secretPatternScan:'No private keys, AWS access IDs, Supabase secret keys or JWT literals detected in handoff artifacts; not proof against every possible sensitive value',separateChecks:'Run node --check, git diff --check and npm run lint separately; this validator does not spawn child processes',hostedSqlExecuted:false},null,2));
console.log('Local handoff validation passed:',inventory.files.length,'artifact hashes, production hashes and sensitive-literal checks.');
