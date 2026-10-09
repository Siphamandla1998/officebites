import { invalidateFinancialData, financialRevision } from '../utils/financialInvalidation';
import { supabase } from './api/supabaseClient';
import { periodDates } from '../utils/reportingDates';
const pendingReports = new Map();

export async function financialRpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === 'PGRST202' ? 'Financial backend update is not installed. This screen cannot show reliable figures yet.' : error.message);
  if (data == null && !['admin_set_fee_policy','admin_reconcile_payout','admin_configure_retention','admin_record_historical_commission'].includes(name)) throw new Error('Financial backend returned no result. Please retry.');
  if (['admin_set_fee_policy','admin_allocate_payout','admin_reconcile_payout','admin_classify_test_order','admin_record_historical_commission'].includes(name)) {
    pendingReports.clear();
    invalidateFinancialData();
  }
  return data;
}

export const financialService = {
  async report({ vendorId = null, period = 'month', from, to } = {}) {
    const window = periodDates(period);
    const args = { p_vendor_id: vendorId, p_from: from === undefined ? window.from : from || null, p_to: to === undefined ? window.to : to || null };
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const uid = data.session?.user?.id;
    if (!uid) throw new Error('Sign in to view financial reports.');
    const key = JSON.stringify([uid, args, financialRevision()]);
    if (pendingReports.has(key)) return pendingReports.get(key);
    const request = financialRpc('get_financial_report', args);
    pendingReports.set(key, request);
    try { return await request; } finally { if (pendingReports.get(key) === request) pendingReports.delete(key); }
  },
  payouts(vendorId = null) { return financialRpc('get_payout_ledger', { p_vendor_id: vendorId }); },
  setFeePolicy(policy, reason) { return financialRpc('admin_set_fee_policy', { p_policy: policy, p_reason: reason }); },
  allocate(vendorId, suborderIds, requestId) { return financialRpc('admin_allocate_payout', { p_vendor_id: vendorId, p_suborder_ids: suborderIds, p_request_id: requestId }); },
  reconcile(id, status, reference) { return financialRpc('admin_reconcile_payout', { p_payout_id: id, p_status: status, p_reference: reference }); },
  previewTestOrder(id) { return financialRpc('admin_preview_test_order', { p_order_id: id }); },
  classifyTestOrder(id, reason, expectedVersion) { return financialRpc('admin_classify_test_order', { p_order_id: id, p_reason: reason, p_expected_version: expectedVersion }); },
};
