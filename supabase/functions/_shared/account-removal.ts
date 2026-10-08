// Kept separate so failure ordering can be tested without calling Auth/Storage.
export async function removeAccount(admin: any, actorId: string, input: any) {
  const prepared = await admin.rpc('prepare_account_removal', { p_actor: actorId, p_kind: input.kind, p_id: input.id, p_fingerprint: input.fingerprint, p_confirmation: input.confirmation });
  if (prepared.error) throw prepared.error;
  const { jobId, manifest } = prepared.data;
  const target = manifest.userId;
  if (!target || target === actorId) throw new Error('Self-removal is prohibited');
  // Access is already blocked by deleted_at/suspended. Ban prevents new Auth sign-ins.
  const ban = await admin.auth.admin.updateUserById(target, { ban_duration: '876000h' });
  // An earlier retry may already have deleted Auth; proceed only for explicit not-found.
  if (ban.error && !['user_not_found','404'].includes(String(ban.error.code || ban.error.status))) throw ban.error;
  const buckets = new Map<string, string[]>();
  for (const file of manifest.storage || []) {
    const paths = buckets.get(file.bucket) || []; paths.push(file.name); buckets.set(file.bucket, paths);
  }
  for (const [bucket, paths] of buckets) {
    for (let offset = 0; offset < paths.length; offset += 100) {
      const removal = await admin.storage.from(bucket).remove(paths.slice(offset, offset + 100));
      if (removal.error) throw new Error('Storage cleanup failed; account remains blocked. Retry this removal job.');
    }
  }
  const deletion = await admin.auth.admin.deleteUser(target);
  if (deletion.error && !['user_not_found','404'].includes(String(deletion.error.code || deletion.error.status))) throw deletion.error;
  const complete = await admin.rpc('complete_account_removal', { p_actor: actorId, p_job_id: jobId });
  if (complete.error) throw complete.error;
  return { jobId, state: 'complete', financialHistoryRetained: true };
}
