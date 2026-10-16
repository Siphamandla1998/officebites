import { ozowToken, ozowHostedRequest, ozowTransaction, verifyOzowWebhook } from './ozow.ts';

type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
export type OzowDependencies = {
  env: (name: string) => string | undefined;
  fetcher: typeof fetch;
  rpc: Rpc;
  caller: (req: Request) => Promise<string | null>;
  isAdmin: (req: Request) => Promise<boolean>;
};
// Injectable transport and RPC boundary lets tests run without provider credentials or hosted writes.
export function ozowHandler(mode: 'initiate' | 'webhook' | 'reconcile', deps: OzowDependencies) {
  return async (req: Request) => {
    const origin = req.headers.get('origin');
    const allowed = (deps.env('ALLOWED_ORIGINS') || '').split(',').map(s=>s.trim()).filter(Boolean);
    const headers: Record<string,string> = { 'Content-Type':'application/json', 'Cache-Control':'no-store', Vary:'Origin' };
    if (origin && allowed.includes(origin)) Object.assign(headers, {'Access-Control-Allow-Origin':origin,
      'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS'});
    const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers});
    if (req.method==='OPTIONS' && mode!=='webhook') return json({},origin && !allowed.includes(origin)?403:200);
    if (req.method!=='POST') return json({error:'Method not allowed'},405);
    if (origin && mode!=='webhook' && !allowed.includes(origin)) return json({error:'Origin not allowed'},403);
    // This release is staging-only. No runtime default may silently select production.
    if (deps.env('OZOW_ENVIRONMENT')!=='staging' || deps.env('SUPABASE_URL')!=='https://eyhmarmekioovcjibcbr.supabase.co') return json({error:'Staging configuration required'},503);
    if (mode==='initiate' && deps.env('OZOW_INITIATION_ENABLED')!=='true') return json({error:'Ozow remains disabled'},503);
    if (mode!=='initiate' && deps.env('OZOW_RECONCILIATION_ENABLED')!=='true') return json({error:'Ozow reconciliation not configured'},503);
    try {
      if (Number(req.headers.get('content-length'))>16384) return json({error:'Request too large'},413);
      const raw=await req.text();
      if (new TextEncoder().encode(raw).byteLength>16384) return json({error:'Request too large'},413);
      let transactionId: string | undefined; let deliveryId: string | null=null;
      const site=deps.env('OZOW_SITE_CODE');
      if (!site || !deps.env('OZOW_CLIENT_ID') || !deps.env('OZOW_CLIENT_SECRET')) return json({error:'Provider configuration incomplete'},503);
      if (mode==='webhook') {
        // Only thin transaction.complete subscriptions are configured for this handler.
        let event;
        try { event=await verifyOzowWebhook(raw,req.headers,deps.env('OZOW_WEBHOOK_SECRET')||''); }
        catch { return json({error:'Webhook verification failed'},401); }
        transactionId=event.data.id;
        deliveryId=req.headers.get('svix-id');
      }
      if (mode==='reconcile') {
        if (!await deps.isAdmin(req)) return json({error:'Active administrator required'},403);
        transactionId=JSON.parse(raw).transactionId;
      }
      if (mode==='initiate') {
        const body=JSON.parse(raw);
        if (typeof body.orderId!=='string' || !/^[0-9a-f-]{36}$/i.test(body.orderId)) return json({error:'Valid order ID required'},400);
        const caller=await deps.caller(req);
        const returnBase=deps.env('OZOW_RETURN_ORIGIN');
        const beneficiary=deps.env('OZOW_BENEFICIARY_REFERENCE');
        if (!returnBase || new URL(returnBase).origin!==returnBase || !returnBase.startsWith('https://') || !allowed.includes(returnBase) || !beneficiary || !/^[a-z0-9]+$/i.test(beneficiary)) return json({error:'Return/reference configuration incomplete'},503);
        // Acquire token BEFORE creating an ambiguous attempt. No payment call occurs until persisted.
        const {token}=await ozowToken(deps.fetcher,'staging',deps.env('OZOW_CLIENT_ID')!,deps.env('OZOW_CLIENT_SECRET')!);
        const attempt=await deps.rpc('begin_ozow_attempt',{p_order_id:body.orderId,p_caller_id:caller,
          p_guest_contact:typeof body.guestContact==='string'?body.guestContact:null,p_site_code:site,p_environment:'staging'}) as {id:string;amount:number;reference:string;expires_at:string};
        const payment=await ozowHostedRequest(deps.fetcher,'staging',token,{siteCode:site,amount:{currency:'ZAR',value:Number(attempt.amount)},
          merchantReference:attempt.reference,beneficiaryReference:beneficiary,expireAt:attempt.expires_at,
          returnUrl:`${returnBase}/orders/${body.orderId}`});
        await deps.rpc('bind_ozow_payment',{p_attempt_id:attempt.id,p_payment_id:payment.id,p_redirect_url:payment.redirectUrl});
        return json({redirectUrl:payment.redirectUrl});
      }
      if (typeof transactionId!=='string') return json({error:'Transaction ID required'},400);
      const {token}=await ozowToken(deps.fetcher,'staging',deps.env('OZOW_CLIENT_ID')!,deps.env('OZOW_CLIENT_SECRET')!);
      const transaction=await ozowTransaction(deps.fetcher,'staging',token,transactionId);
      const attempt=await deps.rpc('get_ozow_attempt',{p_reference:transaction.merchantReference}) as {site_code:string;amount:number;currency:string;environment:string}|null;
      if (!attempt || attempt.environment!=='staging' || transaction.siteCode!==site || transaction.siteCode!==attempt.site_code || transaction.amount.currency!==attempt.currency || transaction.amount.value!==Number(attempt.amount)) return json({error:'Provider snapshot mismatch'},409);
      const result=await deps.rpc('record_ozow_transaction',{p_transaction:transaction,p_environment:'staging',p_delivery_id:deliveryId});
      return json(result);
    } catch {
      // No provider response, tokens, raw payloads or contacts are logged/reflected.
      // Retain issued/pending attempt; provider/DB failure must be reconciled before another request.
      return json({error:'Payment operation incomplete; reconcile before retry'},503);
    }
  };
}
