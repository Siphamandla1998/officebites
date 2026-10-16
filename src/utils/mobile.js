// Validate new contact input only; never rewrite stored guest-order proof.
export const MOBILE_MESSAGE = 'Enter a 10-digit South African mobile number, for example 0821234567.';
export function validateMobile(value, mode = 'local') {
  if (typeof value !== 'string') return { valid: false, value: '', message: MOBILE_MESSAGE };
  const input = value.trim();
  if (mode === 'international' && /^\+[1-9][0-9]{7,14}$/.test(input) && !input.startsWith('+27')) return { valid: true, value: input, message: '' };
  // Explicit international mode accepts +27 mobile numbers; no foreign-number guessing.
  const local = mode === 'international' && /^\+27/.test(input) ? '0' + input.slice(3) : input;
  if (!/^[0-9 ()-]+$/.test(local)) return { valid: false, value: input, message: MOBILE_MESSAGE };
  const normalized = local.replace(/[ ()-]/g, '');
  const valid = /^0(?:6[0-9]|7[1-9]|8[1-4])[0-9]{7}$/.test(normalized);
  return { valid, value: normalized, message: valid ? '' : MOBILE_MESSAGE };
}
