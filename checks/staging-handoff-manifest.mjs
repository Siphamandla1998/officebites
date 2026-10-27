// Local-only evidence inventory. No publication, migration, secret or banking input.
import fs from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
fs.mkdirSync('docs/staging',{recursive:true});
const documents=[];
for(const name of fs.readdirSync('checks/reference-regressions/docs/legal-implementation/policies').sort()){
 const file='checks/reference-regressions/docs/legal-implementation/policies/'+name;
 const text=fs.readFileSync(file,'utf8');
 documents.push({file,sha256:digest(file),publicationBlockerLines:text.split('\n').flatMap((line,i)=>/\[.*(?:verify|insert|confirm|approval|decision|placeholder)|working draft|not for publication|pre-publication|\bTBD\b|\bTODO\b/i.test(line)?[i+1]:[]),inApplicationBundle:false,approvedDatabaseVersionCreated:false});
}
fs.writeFileSync('docs/staging/OWNER-APPROVAL-RECORD.json',JSON.stringify({recordedUtc:new Date().toISOString(),source:'Owner message in this conversation',instructionVerbatim:'I approve all the terms and conditions we creaed',interpretation:'Owner approval of created terms recorded; current task expressly prohibits publication. No invented business/tax facts or alteration of publication guards.',exactVersionApprovalManifest:'Not created; these hashes identify available files for finalisation, not proof that incomplete fields are verified',documents,missingReleaseText:['Vendor Agreement','Vendor Operating Standards','SHE COOKS BY SNE vendor-specific Commercial Fee Schedule'],publicationPerformed:false},null,2));
const m=JSON.parse(fs.readFileSync('docs/release/staging-installation-manifest.json'));
for(const step of m.steps){assert.equal(digest(step.sql),step.sha256);assert.equal(digest(step.installationBundle),step.bundleSha256);}
const files=['checks/prepare-staging-integration.mjs','checks/native-staging-installation.mjs','checks/native-staging-recovery.mjs','checks/staging-forward-containment.sql','checks/staging-cold-restore.mjs','checks/staging-recovery-drill.ps1','checks/verify-staging-cold-restore.mjs','checks/verify-staging-query-files.mjs','checks/staging-installation-preflight.sql','checks/staging-installation-postflight.sql','checks/she-cooks-existing-account-preflight.sql',...m.steps.flatMap(s=>[s.sql,s.installationBundle]),'docs/release/staging-installation-manifest.json','docs/release/staging-preimage-rehearsal.json','docs/release/native-staging-installation-result.json','docs/release/staging-query-file-tests.json','docs/release/staging-channel-control-plane.json',...fs.readdirSync('docs/staging').filter(n=>n!=='FILES.json').map(n=>'docs/staging/'+n)];
files.push('checks/staging-handoff-manifest.mjs','checks/validate-staging-handoff.mjs','checks/native-release-scenarios.mjs','release/staging-candidates/README.md','docs/release/staging-cold-restore-preimage.json');
if(fs.existsSync('docs/release/staging-cold-restore-result.json'))files.push('docs/release/staging-cold-restore-result.json');
fs.writeFileSync('docs/staging/FILES.json',JSON.stringify({preparedUtc:new Date().toISOString(),hostedSqlExecuted:false,files:[...new Set(files)].map(file=>({file,sha256:digest(file)}))},null,2));
console.log('Staging handoff hashes verified; owner instruction recorded; no legal text or release flags published.');
