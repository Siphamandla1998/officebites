import { randomBytes } from 'node:crypto';
export const PROJECT = 'eyhmarmekioovcjibcbr';
export const RUN = 'OB-UAT-20261020';
export const ORIGIN = `https://${PROJECT}.supabase.co`;
export const RELEASE = Object.freeze({
  releaseCommit: '695e5e19cf581f6202dcc058afad1ee2fba23208',
  preview: 'dpl_DGWZnPj1ubqxzCfzDcZVUJ3iEYTQ',
  previewUrl: 'https://officebites-70l6nc42z-sp24tg-6983s-projects.vercel.app',
});
export function validateReleaseReference(reference) {
  if (Object.entries(RELEASE).some(([key, value]) => reference?.[key] !== value)) {
    throw Error('Reviewed staging release reference required; inspect stale manifest/checkpoint without overwriting it');
  }
}
export const IDENTITIES = [
  ['vendorA', 'vendor-a', 'Vendor A', 'vendor'],
  ['vendorB', 'vendor-b', 'Vendor B', 'vendor'],
  ['customer', 'customer', 'Customer', 'customer'],
  ['admin', 'admin', 'Admin', 'customer'],
].map(([fixture, local, name, role]) => ({ fixture, email: `${local}@officebites-uat.invalid`, name: `${RUN} ${name}`, role }));

export function validateCheckpoint(checkpoint, now = Date.now()) {
  validateReleaseReference(checkpoint);
  if (checkpoint.project !== PROJECT || checkpoint.run !== RUN || checkpoint.migration !== '20261020100740'
    || checkpoint.name !== 'officebites-staging' || checkpoint.status !== 'ACTIVE_HEALTHY'
    || checkpoint.notificationIsolationVerified !== true || checkpoint.backendRestrictionVerified !== true
    || checkpoint.authHooksReviewed !== true || checkpoint.allPaymentsDisabled !== true
    || checkpoint.provisioningApproved !== true
    || !Number.isFinite(Date.parse(checkpoint.checkedAt)) || now - Date.parse(checkpoint.checkedAt) > 30 * 60000
    || Date.parse(checkpoint.checkedAt) > now) throw Error('Fresh verified staging checkpoint required');
}

export async function reconcile({ api, state, save }) {
  if (state.project !== PROJECT || state.run !== RUN) throw Error('Wrong manifest target');
  validateReleaseReference(state);
  const users = await api.listUsers();
  // Validate every collision before generating passwords or creating the first identity.
  for (const identity of IDENTITIES) {
    const matches = users.filter(u => u.email?.toLowerCase() === identity.email);
    const entry = state.accounts[identity.fixture];
    if (matches.length > 1) throw Error('Duplicate fixture email');
    if (matches.length) {
      const u = matches[0];
      if (u.app_metadata?.uat_run !== RUN || u.app_metadata?.uat_fixture !== identity.fixture
        || !entry?.password || (entry.id && entry.id !== u.id)) throw Error('Unowned account or missing encrypted checkpoint');
    } else if (entry?.id) throw Error('Previously provisioned identity missing; inspect before retry');
  }
  for (const identity of IDENTITIES) {
    let entry = state.accounts[identity.fixture];
    if (!entry) {
      entry = state.accounts[identity.fixture] = { email: identity.email, password: randomBytes(32).toString('base64url') };
      await save(state); // Persist encrypted credentials BEFORE network write.
    }
    let user = users.find(u => u.email?.toLowerCase() === identity.email);
    if (!user) {
      user = await api.createUser({ email: identity.email, password: entry.password, email_confirm: true,
        app_metadata: { uat_run: RUN, uat_fixture: identity.fixture },
        user_metadata: { name: identity.name, role: identity.role, building: `${RUN} Synthetic office`,
          ...(identity.role === 'vendor' ? { business_name: identity.name, business_category: 'UAT synthetic meals' } : {}) } });
    }
    if (!user?.id || user.email?.toLowerCase() !== identity.email || user.app_metadata?.uat_run !== RUN
      || user.app_metadata?.uat_fixture !== identity.fixture) throw Error('Unexpected Auth response; reconcile before retry');
    entry.id = user.id;
    await save(state);
    const profile = await api.profile(user.id);
    const expectedRoles = identity.fixture === 'admin' ? ['customer', 'admin'] : [identity.role];
    if (profile.id !== user.id || profile.email?.toLowerCase() !== identity.email || !expectedRoles.includes(profile.role)
      || profile.suspended || profile.deleted_at) throw Error('Unexpected fixture profile');
    entry.profileId = profile.id;
    entry.actualRole = profile.role;
    if (identity.role === 'vendor') {
      const vendor = await api.vendor(profile.vendor_id);
      if (vendor.owner_id !== user.id || vendor.name !== identity.name || vendor.archived_at || vendor.status !== 'pending') throw Error('Unexpected fixture storefront; onboarding is a separate phase');
      entry.vendorId = vendor.id;
    }
    await save(state);
  }
  return state;
}
