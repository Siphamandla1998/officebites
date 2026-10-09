export function coordinate(value, limit) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}
export function coordinatePair(latitude, longitude) {
  const lat = coordinate(latitude, 90), lng = coordinate(longitude, 180);
  return lat === null || lng === null ? null : { latitude: lat, longitude: lng };
}
