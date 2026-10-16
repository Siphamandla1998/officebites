import { coordinatePair } from './coordinates.js';
export function distanceKm(origin, destination) {
  const a = coordinatePair(origin?.latitude, origin?.longitude);
  const b = coordinatePair(destination?.latitude, destination?.longitude);
  if (!a || !b) throw new Error('Valid coordinates are required.');
  const rad = n => n * Math.PI / 180;
  const h = Math.sin(rad(b.latitude-a.latitude)/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}
export function validatePosition(position, { maxAccuracyM = 100, maxAgeMs = 60000, now = Date.now() } = {}) {
  const pair = coordinatePair(position?.coords?.latitude, position?.coords?.longitude);
  const accuracy = position?.coords?.accuracy;
  if (!pair || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > maxAccuracyM) throw new Error('Location accuracy is too low. Retry outdoors or select a verified location.');
  if (!Number.isFinite(position.timestamp) || now-position.timestamp > maxAgeMs || position.timestamp-now > 10000) throw new Error('Location is stale. Please retry.');
  return { ...pair, accuracy, capturedAt: position.timestamp };
}
