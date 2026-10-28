// Offline review only. Does not connect, create buckets or execute SQL.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const original=JSON.parse(fs.readFileSync(path.join(root,'docs/release/production-migration-manifest.json')));
for(const step of original.steps)assert.equal(hash(fs.readFileSync(path.join(root,step.file))),step.sha256,'Original migration changed: '+step.file);
const replacement='release/storage-alternative/20261028073200_production_compliance_delegated_policies.sql';
const source=fs.readFileSync(path.join(root,original.steps[3].file),'utf8');
const revised=fs.readFileSync(path.join(root,replacement),'utf8');
const policies=sql=>sql.slice(sql.indexOf('CREATE POLICY compliance_object_insert'),sql.lastIndexOf('COMMIT;')).trim().replaceAll('\r\n','\n');
assert.equal(policies(revised),policies(source),'All six policy definitions must remain identical');
assert.equal((revised.match(/CREATE POLICY /g)||[]).length,6);
assert.doesNotMatch(revised,/\b(?:INSERT INTO|UPDATE|DELETE FROM) storage\./i,'Storage metadata must use API');
assert.doesNotMatch(revised,/\b(?:ALTER ROLE|ALTER TABLE|GRANT|SET ROLE|SET SESSION AUTHORIZATION)\b/i);
assert.match(revised,/name='supautils.policy_grants'/);
assert.match(revised,/context='sighup' AND source='configuration file'/);
assert.match(revised,/Release controls must remain closed/);
assert.match(revised,/Reviewed P1-P3 migration history required/);
const report={project:original.target,installed:false,approved:false,
 status:'review-only; provider delegation configured; managed rehearsal and recovery evidence outstanding',
 replaces:original.steps[3].file,neverApplyTogether:true,
 steps:[...original.steps.slice(0,3),{order:4,file:replacement,
 version:'20261028073200',name:'production_compliance_delegated_policies',
 sha256:hash(fs.readFileSync(path.join(root,replacement))),
 executor:'postgres via provider-installed supautils policy delegation',
 requires:'P1-P3 recorded; API-created private empty bucket; closed rollout controls; managed rehearsal'}],
 bucket:{id:'vendor-compliance',name:'vendor-compliance',public:false,fileSizeLimit:5242880,
 allowedMimeTypes:['application/pdf','image/jpeg','image/png'],executor:'owner through Storage API/dashboard; separately authorized'},
 expectedFinalHistoryCount:42,expectedLatest:'20261028073200',policyDefinitionsIdentical:true,
 managedRehearsalVerified:false,recoveryVerified:false,productionApproval:false};
if(process.argv.includes('--write-manifest'))fs.writeFileSync(path.join(root,'docs/release/production-storage-alternative-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log('Original four migration hashes and six unchanged Storage policies verified. No SQL executed; alternative remains unapproved.');
