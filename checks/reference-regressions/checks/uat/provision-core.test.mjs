import assert from 'node:assert/strict';
import { PROJECT, RUN, RELEASE, IDENTITIES, reconcile, validateCheckpoint, validateReleaseReference } from './provision-core.mjs';
let assertions = 0;
const checkpoint = { project: PROJECT, run: RUN, ...RELEASE, provisioningApproved: true, migration: '20261020100740', name: 'officebites-staging', status: 'ACTIVE_HEALTHY', notificationIsolationVerified: true, backendRestrictionVerified: true, authHooksReviewed: true, allPaymentsDisabled: true, checkedAt: new Date().toISOString() };
validateCheckpoint(checkpoint); assertions++;
for (const changes of [{ project: 'production' }, { notificationIsolationVerified: false }, { allPaymentsDisabled: false }, { checkedAt: '2000-01-01' }, { checkedAt: 'invalid' }, { backendRestrictionVerified: false }, { authHooksReviewed: false }, { provisioningApproved: false }, { preview: 'old-preview' }, { releaseCommit: 'unreviewed' }, { previewUrl: 'https://officebites.co.za' }, { previewUrl: RELEASE.previewUrl + '?bypass=invalid' }]) {
  assert.throws(() => validateCheckpoint({ ...checkpoint, ...changes })); assertions++;
}
const users = []; let writes = 0; const snapshots = [];
const state = { project: PROJECT, run: RUN, ...RELEASE, accounts: {} };
const api = {
  async listUsers() { return users; },
  async createUser(input) {
    assert.equal(snapshots.at(-1).accounts[input.app_metadata.uat_fixture].password, input.password); assertions++;
    assert.equal(input.email_confirm, true); assertions++;
    assert.notEqual(input.user_metadata.role, 'admin'); assertions++;
    assert.equal(input.password.length >= 43, true); assertions++;
    writes++;
    const u = { ...input, id: `generated-${writes}` }; users.push(u); return u;
  },
  async profile(id) { const u = users.find(x => x.id === id); return { id, email: u.email, role: u.user_metadata.role, vendor_id: `vendor-${id}`, suspended: false }; },
  async vendor(id) { const uid = id.slice('vendor-'.length); const u = users.find(x => x.id === uid); return { id, owner_id: uid, name: u.user_metadata.name, status: 'pending' }; },
};
const save = async value => { snapshots.push(structuredClone(value)); };
await reconcile({ api, state, save });
assert.equal(writes, 4); assertions++;
await reconcile({ api, state, save }); assert.equal(writes, 4); assertions++;
const manifest = structuredClone(state); delete manifest.accounts.vendorA.password;
await assert.rejects(() => reconcile({ api, state: manifest, save }), /checkpoint/); assertions++;
const foreign = { ...users[0], app_metadata: {} };
await assert.rejects(() => reconcile({ api: { ...api, listUsers: async () => [foreign] }, state, save }), /Unowned/); assertions++;
await assert.rejects(() => reconcile({ api: { ...api, listUsers: async () => [users[0], users[0]] }, state, save }), /Duplicate/); assertions++;
await assert.rejects(() => reconcile({ api, state: { ...state, project: 'production' }, save }), /target/); assertions++;
const partial = { project: PROJECT, run: RUN, ...RELEASE, accounts: {} };
const lostResponse = [];
await assert.rejects(() => reconcile({ state: partial, save, api: { ...api, listUsers: async () => lostResponse, createUser: async input => { lostResponse.push({ ...input, id: 'recovered' }); throw Error('timeout'); } } }), /timeout/); assertions++;
assert.ok(partial.accounts.vendorA.password); assertions++;
const recoveredUsers = [...lostResponse];
const recoveryApi = {
  ...api,
  listUsers: async () => recoveredUsers,
  createUser: async input => { const u = { ...input, id: `recovery-${recoveredUsers.length}` }; recoveredUsers.push(u); return u; },
  profile: async uid => { const u = recoveredUsers.find(x => x.id === uid); return { id: uid, email: u.email, role: u.user_metadata.role, vendor_id: `vendor-${uid}` }; },
  vendor: async vid => { const u = recoveredUsers.find(x => `vendor-${x.id}` === vid); return { id: vid, owner_id: u.id, name: u.user_metadata.name, status: 'pending' }; },
};
const originalPassword = partial.accounts.vendorA.password;
await reconcile({ api: recoveryApi, state: partial, save });
assert.equal(recoveredUsers.length, 4); assertions++;
assert.equal(partial.accounts.vendorA.id, 'recovered'); assertions++;
assert.equal(partial.accounts.vendorA.password, originalPassword); assertions++;
assert.equal(IDENTITIES.length, 4); assertions++;
assert.throws(() => validateReleaseReference({ ...RELEASE, preview: 'old-preview' }), /release reference/); assertions++;
let apiCalls = 0;
await assert.rejects(() => reconcile({ api: { listUsers: async () => { apiCalls++; return []; } }, state: { ...state, preview: 'old-preview' }, save }), /release reference/); assertions++;
assert.equal(apiCalls, 0); assertions++;
console.log(`${assertions} provisioning safeguard assertions passed; all APIs mocked, no hosted writes.`);
