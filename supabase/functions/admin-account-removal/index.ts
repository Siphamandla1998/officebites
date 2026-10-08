import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { removeAccount } from '../_shared/account-removal.ts';

const allowedOrigins = new Set((Deno.env.get('OFFICEBITES_ALLOWED_ORIGINS') || 'https://officebites.co.za,https://www.officebites.co.za,http://127.0.0.1:5173').split(',').map(value => value.trim()));
Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Vary': 'Origin', 'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : '', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowedOrigins.has(origin)) return reply({ error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Sign in required' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data, error } = await caller.auth.getUser(authorization.slice(7));
    if (error || !data.user) return reply({ error: 'Invalid session' }, 401);
    const { data: profile } = await caller.from('profiles').select('role,suspended,deleted_at').eq('id', data.user.id).single();
    if (profile?.role !== 'admin' || profile.suspended || profile.deleted_at) return reply({ error: 'Active administrator required' }, 403);
    const input = await req.json();
    if (!['customer','vendor'].includes(input.kind) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id || '')) return reply({ error: 'Invalid designated record' }, 400);
    if (input.action === 'preview') {
      const preview = await caller.rpc('admin_preview_account_removal', { p_kind: input.kind, p_id: input.id });
      if (preview.error) throw preview.error;
      return reply(preview.data);
    }
    if (input.action !== 'remove') return reply({ error: 'Unknown action' }, 400);
    // Service credentials never reach the browser. The DB rechecks actor and dependencies.
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const result = await removeAccount(admin, data.user.id, input);
    return reply(result);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : (error as { message?: string })?.message || 'Removal failed. Refresh the preview before retrying.' }, 400);
  }
});
