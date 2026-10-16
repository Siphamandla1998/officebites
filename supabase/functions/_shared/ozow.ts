// One API adapter. Activation requires merchant staging verification and owner approval.
type Environment = 'staging' | 'production';
export const ozowBase = (environment: Environment) => {
  if (!['staging','production'].includes(environment)) throw new Error('Explicit Ozow environment required');
  return environment === 'staging' ? 'https://stagingone.ozow.com/v1' : 'https://one.ozow.com/v1';
};
export async function ozowToken(fetcher: typeof fetch, environment: Environment, clientId: string, clientSecret: string) {
  if (!clientId || !clientSecret) throw new Error('Ozow One API client credentials are required');
  const response = await fetcher(`${ozowBase(environment)}/token`, { method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: 'payments', grant_type: 'client_credentials' }) });
  if (!response.ok) throw new Error('Ozow authentication failed');
  const result = await response.json();
  if (typeof result.access_token !== 'string' || !result.access_token || !Number.isFinite(Number(result.expires_in)) || Number(result.expires_in)<=0) throw new Error('Invalid Ozow token response');
  return { token: result.access_token as string, expiresIn: Number(result.expires_in) };
}
export async function ozowHostedRequest(fetcher: typeof fetch, environment: Environment, token: string, request: {
  siteCode: string; amount: { currency: string; value: number }; merchantReference: string;
  beneficiaryReference: string; expireAt: string; returnUrl: string;
}) {
  if (!token || !request.siteCode || request.amount.currency !== 'ZAR' || !Number.isFinite(request.amount.value) || request.amount.value<=0 || Math.abs(request.amount.value*100-Math.round(request.amount.value*100))>1e-6 || !request.merchantReference || !/^[a-z0-9]+$/i.test(request.beneficiaryReference) || !Number.isFinite(Date.parse(request.expireAt)) || Date.parse(request.expireAt)<=Date.now() || new URL(request.returnUrl).protocol!=='https:') throw new Error('Invalid authoritative Ozow payment request');
  const response = await fetcher(`${ozowBase(environment)}/payments`, { method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request), signal: AbortSignal.timeout(15000) });
  // An ambiguous timeout must retain the attempted request for reconciliation, not be retried blindly.
  if (!response.ok) throw new Error('Ozow initiation requires reconciliation before retry');
  const result = await response.json();
  if (!result.id || String(result.status).toLowerCase()!=='created' || typeof result.redirectUrl!=='string' || new URL(result.redirectUrl).protocol!=='https:') throw new Error('Invalid Ozow hosted response; reconcile before retry');
  return result;
}
export async function verifyOzowWebhook(raw: string, headers: Headers, secret: string, nowSeconds = Date.now()/1000) {
  const id=headers.get('svix-id'), timestamp=headers.get('svix-timestamp'), signatures=headers.get('svix-signature');
  if (!id || !timestamp || !/^\d+$/.test(timestamp) || !signatures || !secret.startsWith('whsec_') || Math.abs(nowSeconds-Number(timestamp))>300) throw new Error('Invalid or stale webhook signature');
  const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const message=new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
  let valid=false;
  for (const signature of signatures.split(' ')) {
    const [version,encoded]=signature.split(',');
    if(version!=='v1' || !encoded)continue;
    try { if(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),message)) valid=true; } catch { /* Invalid encoding is not authentication. */ }
  }
  if (!valid) throw new Error('Invalid webhook signature');
  const event=JSON.parse(raw);
  if(event.type!=='transaction.complete' || !event.data?.id || !['Successful','Incomplete','Pending','Error'].includes(event.data.status)) throw new Error('Unsupported Ozow event contract');
  // Caller MUST fetch authoritative transaction data and match site/amount/currency/reference,
  // then atomically deduplicate provider transaction ID before recording any paid transition.
  return event;
}

export async function ozowTransaction(fetcher: typeof fetch, environment: Environment, token: string, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !token) throw new Error('Invalid transaction lookup');
  const response = await fetcher(`${ozowBase(environment)}/transactions/${id}`, {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Transaction lookup unavailable; retry reconciliation');
  const result = await response.json();
  if (result.id !== id || !['Successful','Incomplete','Pending','Error','Refunded'].includes(result.status) ||
      typeof result.siteCode !== 'string' || typeof result.merchantReference !== 'string' ||
      result.amount?.currency !== 'ZAR' || typeof result.amount.value !== 'number' || !Number.isFinite(result.amount.value) ||
      result.amount.value <= 0 || Math.abs(result.amount.value*100-Math.round(result.amount.value*100))>1e-6) throw new Error('Invalid transaction response');
  // Persist only settlement identity/status, never payer banking or contact details.
  return { id: result.id, status: result.status, siteCode: result.siteCode,
    merchantReference: result.merchantReference, amount: result.amount };
}
