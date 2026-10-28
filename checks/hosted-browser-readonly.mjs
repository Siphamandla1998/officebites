// Approved production test identities only. No business writes, password changes,
// emails, screenshots, traces or persisted browser/token state.
import fs from 'node:fs';
import { chromium } from '@playwright/test';
const project='gfzhdkitdyqftealgqfi',origin='https://officebites.co.za';
if(process.env.OFFICEBITES_UAT_PROJECT!==project)throw new Error('Explicit production UAT target required');
const accounts=JSON.parse(fs.readFileSync(process.env.OFFICEBITES_UAT_CREDENTIALS_PATH||'.officebites-local/uat-credentials.json','utf8'));
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!key?.startsWith('sb_publishable_'))throw new Error('Verified production publishable key required');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
const report={observedUtc:new Date().toISOString(),project,origin,roles:[],businessWrites:false};
try{
 for(const role of ['customer','vendor','admin'].filter(r=>!process.env.OFFICEBITES_UAT_ROLE||r===process.env.OFFICEBITES_UAT_ROLE)){
  const account=accounts[role],result={role,pages:[],apiFailures:[],blockedWrites:0,blockedPaths:[],pageErrors:0};
  if(!account?.email||!account.password){report.roles.push({...result,login:'NOT_TESTED'});continue;}
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(['GET','HEAD','OPTIONS'].includes(req.method()))return route.continue();
   if(url.hostname===`${project}.supabase.co`&&req.method()==='POST'&&(
    ['/auth/v1/token','/auth/v1/logout'].includes(url.pathname)||
    /^\/rest\/v1\/rpc\/(get_[a-z_]+|manual_payment_workspace|admin_recent_payments|admin_customer_favourite_counts)$/.test(url.pathname)))return route.continue();
   result.blockedWrites++;result.blockedPaths.push(url.pathname);return route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',()=>result.pageErrors++);
  page.on('response',response=>{
   const u=new URL(response.url());
   if(u.hostname===`${project}.supabase.co`&&response.status()>=400)result.apiFailures.push({path:u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,'[id]'),status:response.status()});
  });
  try{
   await page.goto(origin+'/login',{waitUntil:'domcontentloaded'});
   await page.getByLabel('Email',{exact:true}).fill(account.email);
   await page.getByLabel('Password',{exact:true}).fill(account.password);
   await page.getByRole('button',{name:'Sign in',exact:true}).click();
   const destination=role==='customer'?'/':`/${role}`;
   await page.waitForURL(url=>url.origin===origin&&url.pathname===destination,{timeout:45000});
   result.login='PASS';
   await page.reload({waitUntil:'domcontentloaded'});
   // Wait for restored authenticated navigation rather than merely the same URL.
   if(role==='admin')await page.getByRole('link',{name:'Payments',exact:true}).first().waitFor();
   else await page.getByRole('heading').first().waitFor();
   await page.waitForURL(url=>url.pathname.replace(/\/$/,'')===destination.replace(/\/$/,''));
   result.restoredPath=new URL(page.url()).pathname;
   result.restore='PASS';
   const routes=role==='customer'?['/orders','/notifications','/admin/payments']:role==='vendor'?['/vendor/orders','/vendor/settings']:['/admin/payments','/admin/vendors','/admin/legal'];
   for(const path of routes){
    await page.goto(origin+path,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    result.pages.push({path,landedPath:new URL(page.url()).pathname,alerts:await page.getByRole('alert').count(),headings:await page.getByRole('heading').count()});
   }
  }catch{result.login||='FAIL';result.transportOrRouteFailure=true;}
  finally{
   // Revoke only the test session created by this context. Never log its contents.
   const token=await page.evaluate(ref=>{
    try{return JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`))?.access_token||null;}catch{return null;}
   },project).catch(()=>null);
   if(token)await context.request.post(`https://${project}.supabase.co/auth/v1/logout?scope=local`,{headers:{apikey:key,Authorization:`Bearer ${token}`}}).catch(()=>{});
   await context.close();
  }
  report.roles.push(result);
 }
}finally{await browser.close();}
fs.writeFileSync('docs/release/hosted-browser-results-20261028.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.roles.some(r=>r.login!=='PASS'||r.restore!=='PASS'||r.pageErrors||r.transportOrRouteFailure))process.exitCode=1;
