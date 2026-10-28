import fs from 'node:fs';
import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
const report={observedUtc:new Date().toISOString(),project:'gfzhdkitdyqftealgqfi',mobileWidth:390,apiFailures:[],blockedWrites:0,ordersCreated:false};
const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
try{
 await context.route('**/*',r=>{
  const req=r.request(),url=new URL(req.url());
  if(['GET','HEAD','OPTIONS'].includes(req.method())||(req.method()==='POST'&&url.hostname==='gfzhdkitdyqftealgqfi.supabase.co'&&/^\/rest\/v1\/rpc\/get_[a-z_]+$/.test(url.pathname)))return r.continue();
  report.blockedWrites++;return r.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('response',r=>{const u=new URL(r.url());if(u.hostname.endsWith('.supabase.co')&&r.status()>=400)report.apiFailures.push({path:u.pathname,status:r.status()});});
 await page.goto('https://officebites.co.za/vendors',{waitUntil:'domcontentloaded'});
 await page.locator('a[href^="/vendors/"]').first().click();report.vendorMenu='PASS';
 await page.getByRole('button',{name:'Add to cart',exact:true}).first().click();report.menuToCart='PASS';
 report.step='openCart';
 if(!await page.getByRole('button',{name:/^Checkout/}).isVisible())await page.getByRole('button',{name:'Cart',exact:true}).click();
 report.step='checkout';
 await page.getByRole('button',{name:/^Checkout/}).click();
 await page.getByRole('button',{name:'Place order',exact:true}).waitFor();
 await page.waitForTimeout(2000);
 report.cartToCheckout='PASS';report.placeOrderDisabled=await page.getByRole('button',{name:'Place order',exact:true}).isDisabled();
 report.ordering=report.placeOrderDisabled?'FAIL':'NOT_SUBMITTED';
 report.cartRetained=await page.evaluate(()=>JSON.parse(localStorage.getItem('ob_cart')||'[]').length>0);
}catch{report.incomplete=true;}
finally{await context.close();await browser.close();}
fs.writeFileSync('docs/release/live-guest-journey-20261028.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
