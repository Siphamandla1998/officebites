import { supabase } from './api/supabaseClient';

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || 'Legal document service is unavailable. Please retry.');
  return data;
}

export const commercialService = {
  portal: () => rpc('get_legal_portal'),
  workspace: () => rpc('get_commercial_workspace'),
  action: (action, value) => rpc('admin_commercial_action', { p_action: action, p_value: value }),
};
