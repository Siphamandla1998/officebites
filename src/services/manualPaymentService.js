import { supabase } from './api/supabaseClient';
const tokenKey = id => `ob_manual_payment:${id}`;
const memory = new Map();
export async function manualRequestKey(payload) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const key = 'ob_manual_request:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
  let id = memory.get(key);
  try { id ||= sessionStorage.getItem(key); } catch { /* Use this tab. */ }
  id ||= crypto.randomUUID();memory.set(key,id);
  try { sessionStorage.setItem(key,id); } catch { /* Use this tab. */ }
  return {id,clear:()=>{memory.delete(key);try { sessionStorage.removeItem(key); } catch { /* Optional persistence. */ }}};
}
export function savePaymentToken(id, token) {
  if (!token) return;
  memory.set(id, token);
  try { sessionStorage.setItem(tokenKey(id), token); } catch { /* Retain in this tab. */ }
}
function token(id) {
  try { return memory.get(id) || sessionStorage.getItem(tokenKey(id)) || null; } catch { return memory.get(id) || null; }
}
async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || 'Payment request unavailable. Please retry.');
  return data;
}
export const manualPaymentService = {
  methods: vendorId => rpc('get_vendor_manual_methods', { p_vendor_id: vendorId }),
  instructions: id => rpc('get_manual_payment', { p_order_id: id, p_token: token(id) }),
  report: id => rpc('report_manual_payment', { p_order_id: id, p_token: token(id) }),
  workspace: (testOnly = false) => rpc('manual_payment_workspace', { p_test_only: testOnly }),
  submit: (vendorId, destination, eft, payshap) => rpc('submit_vendor_payment_profile', { p_vendor_id: vendorId, p_destination: destination, p_eft: eft, p_payshap: payshap }),
  approve: (id, evidence) => rpc('approve_vendor_payment_profile', { p_profile_id: id, p_evidence: evidence }),
  verify: (id, amount, reference, suspicious) => rpc('verify_manual_payment', { p_order_id: id, p_amount: Number(amount), p_bank_reference: reference, p_suspicious: suspicious }),
  flag: (id, reason) => rpc('flag_manual_payment', { p_order_id: id, p_reason: reason }),
  resolveDispute: (id, evidence) => rpc('resolve_manual_payment_dispute', { p_order_id: id, p_evidence: evidence }),
  cancelRefunded: (id, reason) => rpc('admin_cancel_refunded_manual_order', { p_order_id: id, p_reason: reason }),
  refund: (id, status, amount, productRefund, evidence) => rpc('record_manual_refund_status', { p_order_id: id, p_status: status, p_amount: amount === '' ? null : Number(amount), p_product_refund: Number(productRefund), p_evidence: evidence }),
  settings: (eft, payshap, minutes, threshold, reason) => rpc('admin_manual_settings', { p_eft: eft, p_payshap: payshap, p_minutes: Number(minutes), p_threshold: Number(threshold), p_reason: reason }),
  entry: (id, kind, amount, evidence, productRefund = 0) => rpc('admin_manual_receivable_entry', { p_order_id: id, p_kind: kind, p_amount: Number(amount), p_evidence: evidence, p_product_refund: Number(productRefund) }),
};
