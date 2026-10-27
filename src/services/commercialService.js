import { supabase } from './api/supabaseClient';
import { releaseRequestError } from '../utils/releaseAvailability';
async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw releaseRequestError(error, 'Legal configuration is unavailable. Please retry.');
  return data;
}
export const commercialService = {
  customerState: () => rpc('get_customer_legal_state'),
  orderReceipt: (orderId, token) => rpc('get_order_legal_receipt', { p_order: orderId, p_token: token || null }),
  portal: () => rpc('get_legal_portal'),
  workspace: () => rpc('get_commercial_workspace'),
  report: (from, to) => rpc('get_commercial_report', { p_from: from || null, p_to: to || null }),
  action: (action, value) => rpc('admin_commercial_action', { p_action: action, p_value: value }),
  consent: value => rpc('prepare_vendor_consent', { p_documents: value.documents, p_ack: value.acknowledgements }),
  respond: (id, accept) => rpc('respond_corporate_agreement', { p_id: id, p_accept: accept }),
  acceptLegal: (vendorId, value) => rpc('accept_vendor_legal', { p_vendor: vendorId, p_documents: value.documents, p_ack: value.acknowledgements }),
};
