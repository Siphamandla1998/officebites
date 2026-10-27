import { supabase } from './api/supabaseClient';
import { manualPaymentService } from './manualPaymentService';
async function rpc(name, args) {
 let timer;
 try {
  const result = await Promise.race([supabase.rpc(name, args), new Promise((_, reject) => {
   timer = setTimeout(() => reject(new Error('Request timed out. Reload the audit history before retrying.')), 20000);
  })]);
  if (result.error) {
   const error = new Error(result.error.code === '40001' ? 'The vendor state changed. Reload before reviewing.' : result.error.message || 'Compliance service unavailable.');
   error.code = result.error.code; throw error;
  }
  return result.data;
 } finally { clearTimeout(timer); }
}
export const vendorComplianceService = {
 state: vendorId => rpc('get_vendor_compliance', { p_vendor: vendorId }),
 action: (vendorId, action, value) => rpc('admin_vendor_compliance', { p_vendor: vendorId, p_action: action, p_value: value }),
 submitBank: (...args) => manualPaymentService.submit(...args),
 finalize: id => rpc('finalize_vendor_evidence', { p_submission: id }),
 async uploadEvidence(kind, note, file) {
  if (!file || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) throw new Error('Choose a PDF, JPEG or PNG file no larger than 5MB.');
  const reservation = await rpc('reserve_vendor_evidence', { p_kind: kind, p_note: note });
  const { error } = await supabase.storage.from('vendor-compliance').upload(reservation.path, file, { upsert: false, contentType: file.type, cacheControl: '0' });
  if (error) throw new Error('The private upload could not be confirmed. Reload submissions before retrying.');
  await rpc('finalize_vendor_evidence', { p_submission: reservation.id });
 },
 async evidenceUrl(path) {
  const { data, error } = await supabase.storage.from('vendor-compliance').createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw new Error('Private evidence access unavailable.');
  return data.signedUrl;
 },
};
