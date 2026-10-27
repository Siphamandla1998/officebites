// Object URLs belong only to the document that created them. Never restore one
// from a database row, another preview deployment or another browser session.
export function persistentImage(value, fallback = '') {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const image = value.trim();
  if (image.startsWith('/') && !image.startsWith('//') && !image.includes('\\')) return image;
  try {
    const url = new URL(image);
    return url.protocol === 'https:' && !url.username && !url.password ? image : fallback;
  } catch { return fallback; }
}
export function requirePersistentImage(value) {
  if (value == null || value === '') return value;
  const image = persistentImage(value);
  if (!image) throw new Error('Upload the image before saving. Temporary preview URLs cannot be saved.');
  return image;
}
