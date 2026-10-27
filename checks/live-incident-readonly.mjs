// Anonymous production inspection only. Never logs headers, tokens or response rows.
// No signup/login, settings updates, order creation or payment actions are permitted.
import { chromium } from '@playwright/test';
const origin = 'https://officebites.co.za';
const project = 'gfzhdkitdyqftealgqfi';
const readRPCs = new Set(['get_payment_gateways', 'get_vendor_manual_methods',
  'manual_payment_workspace', 'get_collection_options', 'get_delivery_settings',
  'get_order_assistance_options', 'admin_delivery_origin_queue', 'get_nearby_vendors']);
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const failures = []; const scripts = []; const hosts = new Set();
try {
  await context.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1];
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) &&
        !(req.method() === 'POST' && url.hostname === `${project}.supabase.co` && readRPCs.has(rpc))) {
      failures.push({ kind: 'blocked_write', path: url.pathname });
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.hostname.endsWith('.supabase.co')) hosts.add(url.hostname);
    if (response.status() >= 400) failures.push({ status: response.status(), host: url.hostname, path: url.pathname });
    if (url.origin === origin && url.pathname.endsWith('.js')) scripts.push(response.text().catch(() => ''));
  });
  for (const path of ['/', '/vendors', '/checkout', '/admin/payments']) {
    await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 60000 });
  }
  const texts = (await Promise.all(scripts)).join('\n');
  for (const m of texts.matchAll(/https:\/\/([a-z0-9]+\.supabase\.co)/g)) hosts.add(m[1]);
  // Public client keys already delivered by the site; keep values in memory only.
  const key = texts.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0] ||
    [...texts.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map(m => m[0]).find(value => {
      try { const p = JSON.parse(Buffer.from(value.split('.')[1], 'base64url')); return p.role === 'anon' && p.ref === project; } catch { return false; }
    });
  const probes = [];
  if (key && hosts.size === 1 && hosts.has(`${project}.supabase.co`)) {
    for (const [name, body] of [['get_payment_gateways', {}], ['get_vendor_manual_methods', { p_vendor_id: '00000000-0000-0000-0000-000000000000' }], ['manual_payment_workspace', { p_test_only: true }]]) {
      const response = await context.request.post(`https://${project}.supabase.co/rest/v1/rpc/${name}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, data: body });
      let errorCode = null; try { errorCode = (await response.json()).code || null; } catch { /* No response contents retained. */ }
      probes.push({ rpc: name, status: response.status(), errorCode });
    }
  }
  console.log(JSON.stringify({ observedUtc: new Date().toISOString(), project, compiledOrRequestedHosts: [...hosts], failures, probes, authenticatedAdminTest: 'NOT PERFORMED: no admin session; no hosted writes', ordersCreated: false }, null, 2));
} finally { await context.close(); await browser.close(); }
