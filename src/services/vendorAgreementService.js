import { supabase } from './api/supabaseClient';
async function call(name, args) {
  let timeout;
  let result;
  try {
    result = await Promise.race([
      supabase.rpc(name, args),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('The request timed out. Reload to check for a saved acceptance before retrying.')), 20000);
      }),
    ]);
  } finally { clearTimeout(timeout); }
  // Timing out does not prove that the transaction failed. The server deduplicates
  // retries; the UI offers receipt recovery and never invents a local receipt.
  const { data, error } = result;
  if (error) {
    const failure = new Error(error.code === '40001'
      ? 'The agreement has changed. Reload and review the current documents before accepting.'
      : 'Agreement review is unavailable. Reload to check for a saved acceptance, or contact Support.');
    failure.code = error.code;
    throw failure;
  }
  return data;
}
export const vendorAgreementService = {
  state: () => call('get_vendor_agreement_state'),
  // The only client inputs are the reviewed assignment ID and deliberate assent.
  accept: assignmentId => call('accept_assigned_vendor_agreement', {
    p_assignment: assignmentId, p_acknowledged: true,
  }),
};
