// Remove caches created by older releases; never delete unrelated site caches.
export async function clearLegacyPrivateCaches() {
  if (!('caches' in globalThis)) return;
  const names = await caches.keys();
  await Promise.all(names.filter(name => ['officebites-api-cache', 'officebites-image-cache'].includes(name)).map(name => caches.delete(name)));
}
