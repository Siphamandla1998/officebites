import { test, expect } from '@playwright/test';
import fs from 'node:fs';
test.beforeEach(async ({page}) => {
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.route('http://127.0.0.1:5176/**', async route => {
    if(route.request().resourceType()!=='document') return route.continue();
    await route.fulfill({response:await route.fetch({url:'http://127.0.0.1:5176/checks/browser-harness.html'})});
  });
});
const open=async(page,path)=>{await page.goto('/checks/browser-harness.html?route='+encodeURIComponent(path));await page.waitForFunction(()=>window.fixture?.authChanged);};

test('mobile and desktop customer vendor admin visual checks',async({page})=>{
 fs.mkdirSync('.officebites-local/current-audit-visuals',{recursive:true});
 for(const width of [390,1440]) {
  await page.setViewportSize({width,height:width===390?844:1000});
  await open(page,'/payment/A');
  await expect(page.getByText(/Pay the vendor directly through your banking app/)).toBeVisible();
  await page.screenshot({path:`.officebites-local/current-audit-visuals/local-${width}-payment.png`,fullPage:true,animations:'disabled'});
  await page.evaluate(()=>fixture.navigate('/terms'));
  await expect(page.getByText('An approved version of this document has not been published.',{exact:false})).toBeVisible();
  await page.screenshot({path:`.officebites-local/current-audit-visuals/local-${width}-policies.png`,fullPage:true,animations:'disabled'});
  await page.evaluate(async()=>{await fixture.setUser({id:'ADMIN',role:'admin'});fixture.navigate('/admin/payments');});
  await expect(page.getByRole('form',{name:'PayFast gateway settings'})).toBeVisible();
  await page.screenshot({path:`.officebites-local/current-audit-visuals/local-${width}-admin-payments.png`,fullPage:true,animations:'disabled'});
  await page.getByText('Delivery policy and vendor origins',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Vendor-origin approval queue'})).toBeVisible();
  await page.evaluate(()=>fixture.navigate('/admin/analytics'));
  await expect(page.getByText('Payment processor fees',{exact:true})).toBeVisible();
  await page.screenshot({path:`.officebites-local/current-audit-visuals/local-${width}-analytics.png`,fullPage:true,animations:'disabled'});
  await page.evaluate(()=>fixture.navigate('/admin/commercial'));
  await expect(page.getByText('Legal documents and business disclosures',{exact:true})).toBeVisible();
  await page.screenshot({path:`.officebites-local/current-audit-visuals/local-${width}-legal-admin.png`,fullPage:true,animations:'disabled'});
  await page.getByText('Legal documents and business disclosures',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Business disclosures',exact:true})).toBeVisible();
  await page.evaluate(()=>fixture.setUser({id:'VENDOR',role:'vendor',vendorId:'fixture-vendor'}));
  await expect(page).toHaveURL(/\/vendor$/);
  await page.evaluate(()=>fixture.navigate('/vendor/orders'));
  await expect(page.getByRole('heading',{name:'Orders',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Vendor fees',exact:true})).toBeVisible();
  await page.screenshot({path:`.officebites-local/current-audit-visuals/local-${width}-vendor-orders.png`,fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('admin gateway saves are independent, confirmed and survive route refresh after receipt failure',async({page})=>{

 await open(page,'/help');await page.evaluate(()=>{fixture.failFinance=true;fixture.setUser({id:'ADMIN',role:'admin'});fixture.navigate('/admin/payments');});
 const form=page.getByRole('form',{name:'PayFast gateway settings'});
 await expect(form.getByLabel('Unavailable for new marketplace payments')).toBeDisabled();
 await expect(form.getByLabel('Unavailable for new marketplace payments')).not.toBeChecked();
 await form.getByRole('button',{name:'Save gateway settings'}).click();
 await expect(page.getByText('Gateway settings saved and reloaded.')).toBeVisible();
 await page.evaluate(()=>{fixture.failFinance=false;fixture.navigate('/help');});await page.evaluate(()=>fixture.navigate('/admin/payments'));
 await expect(form.getByLabel('Unavailable for new marketplace payments')).not.toBeChecked();

});
test('unpaid inconsistent completion is not presented as fulfilled or safe to retry',async({page})=>{
 await page.addInitScript(()=>{window.fixtureOrderOverride={status:'completed',subOrders:[{vendorId:'fixture-vendor',vendorName:'Synthetic',status:'completed',paymentStatus:'unpaid',items:[]}]};});
 await open(page,'/orders/A/ticket');
 await expect(page.getByText('Status needs review',{exact:true})).toBeVisible();
 await expect(page.getByText(/Payment is still required/)).toBeVisible();
 await expect(page.getByText(/Your order is complete/)).toHaveCount(0);
 await page.evaluate(()=>fixture.navigate('/payment/A'));
 await expect(page.getByRole('button',{name:/Pay .* with PayFast/})).toHaveCount(0);
});
test('admin payment badge is Paid independently of fulfilled source rows and includes delivery',async({page})=>{
 await page.addInitScript(()=>{window.fixtureVerifiedReceipt=true;});await open(page,'/help');
 await page.evaluate(()=>{fixture.setUser({id:'SYNTHETIC-ADMIN',role:'admin'});fixture.navigate('/admin/payments');});
 await expect(page.getByText('Paid',{exact:true})).toBeVisible();
 await expect(page.getByText('Completed',{exact:true})).toHaveCount(0);
 await expect(page.getByText(/115[.,]00/)).toBeVisible();
});

test('vendor payment badge says Paid while fulfilment awaits acceptance',async({page})=>{
 await page.addInitScript(()=>{window.fixtureVendorOrders=[{id:'VENDOR-ORDER',ticketNumber:'OB-SYNTHETIC',customerName:'Synthetic guest',customerId:null,total:100,createdAt:'2026-10-16T10:00:00Z',deliveryDate:'2026-10-19',subOrder:{vendorId:'fixture-vendor',vendorName:'Synthetic',status:'confirmed',paymentStatus:'paid',subtotal:100,items:[]}}];});
 await open(page,'/help');
 await page.evaluate(async()=>{await fixture.setUser({id:'VENDOR',role:'vendor',vendorId:'fixture-vendor'});fixture.navigate('/vendor/orders');});
 await page.getByRole('button',{name:/view/i}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByText('Paid',{exact:true})).toBeVisible();
 await expect(dialog.getByText('Completed',{exact:true})).toHaveCount(0);
 for(const width of [390,1440]) {
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.screenshot({path:`.officebites-local/current-audit-visuals/local-${width}-vendor-payment.png`,fullPage:true,animations:'disabled'});
 }
});
test('admin vendor list never requests a persisted foreign-origin blob',async({page})=>{
 const blobs=[];page.on('request',r=>{if(r.url().startsWith('blob:'))blobs.push(r.url());});
 await page.addInitScript(()=>{window.fixturePersistedBlob=true;});await open(page,'/help');
 await page.evaluate(()=>{fixture.setUser({id:'SYNTHETIC-ADMIN',role:'admin'});fixture.navigate('/admin/vendors');});
 await expect(page.getByText('Synthetic blob vendor',{exact:true})).toBeVisible();
 expect(await page.locator('img[src^="blob:"]').count()).toBe(0);expect(blobs).toEqual([]);
});

test('public legal routes disclose unpublished status on mobile without authentication',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const path of ['/terms','/privacy','/refund-policy']) {
  await open(page,path);
  await expect(page.getByText('An approved version of this document has not been published.',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:'Back to marketplace'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(page.getByRole('link',{name:'Vendor fees',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Vendor agreement',exact:true})).toHaveCount(0);
 }
 expect(await page.evaluate(()=>fixture.unknownRpcs)).toEqual([]);
});

test('commercial document routes require vendor or administrator role',async({page})=>{
 await open(page,'/vendor-fees');
 await expect(page.locator('input[type="password"]')).toBeVisible();
 await page.evaluate(async()=>{await fixture.setUser({id:'CUSTOMER',role:'customer'});fixture.navigate('/vendor-agreement');});
 await expect(page).not.toHaveURL(/\/vendor-agreement/);
 await page.evaluate(async()=>{await fixture.setUser({id:'VENDOR',role:'vendor',vendorId:'fixture-vendor'});fixture.navigate('/vendor-agreement');});
 await expect(page).toHaveURL(/\/vendor-agreement$/);
 await expect(page.getByText('An approved version of this document has not been published.',{exact:false})).toBeVisible();
});

test('unknown processor fees remain unresolved in Analytics',async({page})=>{
 await open(page,'/help');
 await page.evaluate(()=>{fixture.unknownFees=true;fixture.setUser({id:'ADMIN',role:'admin'});fixture.navigate('/admin/analytics');});
 await expect(page.getByText('Payment processor fees',{exact:true})).toBeVisible();
 await expect(page.getByText('Unresolved',{exact:true})).toHaveCount(2);
});
test('return is navigation; explicit confirmed cancellation is single-shot',async({page})=>{

 await open(page,'/payment/A');await page.getByRole('link',{name:'Track order',exact:true}).click();
 expect(await page.evaluate(()=>fixture.cancels||0)).toBe(0);
 await page.evaluate(()=>fixture.navigate('/payment/A'));page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Cancel unpaid order',exact:true}).evaluate(el=>{el.click();el.click();});
 expect(await page.evaluate(()=>fixture.cancels)).toBe(1);

});test('processing refusal remains on order payment screen with actionable error',async({page})=>{

 await open(page,'/payment/A');await page.evaluate(()=>fixture.cancelFail=true);page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Cancel unpaid order',exact:true}).click();
 await expect(page.getByText('A payment may be processing',{exact:true})).toBeVisible();
 await expect(page).toHaveURL(/\/payment\/A/);

});test('guest mobile validation prevents creation; valid local number preserves zero',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'synthetic-vendor',vendorName:'Synthetic',name:'Lunch',price:100,qty:1}])));
  await open(page,'/checkout');
  await page.getByLabel('Your name').fill('Synthetic guest');await page.getByLabel('Where should we deliver?').fill('Synthetic office');
  await page.getByLabel('Mobile number').fill('invalid123');await page.getByRole('button',{name:'Place order',exact:true}).click();
  await expect(page.getByText(/Enter a 10-digit South African mobile number/)).toBeVisible();
  expect(await page.evaluate(()=>fixture.creates)).toBe(0);
  await page.getByLabel('Mobile number').fill('082 123 4567');await page.getByRole('button',{name:'Place order',exact:true}).click();
  await expect(page).toHaveURL(/\/payment\/CREATED/);
  expect(await page.evaluate(()=>fixture.guestAccess('CREATED')?.contact)).toBe('0821234567');
});
test('disabled gateway prevents initiation while keeping return navigation',async({page})=>{

 await page.addInitScript(()=>{window.fixtureOzowAvailable=true;window.fixtureGatewayDisabled=true;window.fixtureMissingGatewayRpc=true;});
 await open(page,'/payment/A');
 await expect(page.getByRole('button',{name:/with PayFast|with Ozow/})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Track order',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>fixture.redirects)).toEqual([]);expect(await page.evaluate(()=>fixture.ozowCalls||0)).toBe(0);

});
test('missing gateway backend fails closed without a payment redirect',async({page})=>{

 await page.addInitScript(()=>{window.fixtureOzowAvailable=true;window.fixtureGatewayDisabled=true;window.fixtureMissingGatewayRpc=true;});
 await open(page,'/payment/A');
 await expect(page.getByRole('button',{name:/with PayFast|with Ozow/})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Track order',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>fixture.redirects)).toEqual([]);expect(await page.evaluate(()=>fixture.ozowCalls||0)).toBe(0);

});
test('checkout retains cart and refuses order creation when every gateway is unavailable',async({page})=>{

 await page.addInitScript(()=>{window.fixtureManualUnavailable=true;localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'synthetic-vendor',vendorName:'Synthetic',name:'Lunch',price:100,qty:1}]));});
 await open(page,'/checkout');await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>fixture.creates)).toBe(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ob_cart')).length)).toBe(1);

});test('Ozow control obeys action lock and surfaces ambiguous initiation',async({page})=>{

 await page.addInitScript(()=>{window.fixtureOzowAvailable=true;window.fixtureGatewayDisabled=true;window.fixtureMissingGatewayRpc=true;});
 await open(page,'/payment/A');
 await expect(page.getByRole('button',{name:/with PayFast|with Ozow/})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Track order',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>fixture.redirects)).toEqual([]);expect(await page.evaluate(()=>fixture.ozowCalls||0)).toBe(0);

});
test('Ozow visibility requires enabled ready and no maintenance, independently of PayFast',async({page})=>{

 await open(page,'/help');
 for(const [enabled,ready,maintenance] of [[false,false,false],[true,false,false],[true,true,false]]) {
  await page.evaluate(({enabled,ready,maintenance})=>{fixture.gateways=[{provider:'payfast',enabled:true,ready:true,maintenance:false},{provider:'ozow',enabled,ready,maintenance}];fixture.navigate('/payment/A');},{enabled,ready,maintenance});
  await expect(page.getByRole('button',{name:/with PayFast|with Ozow/})).toHaveCount(0);await page.evaluate(()=>fixture.navigate('/help'));
 }

});
test('Ozow return cancellation and failure query parameters never establish paid status',async({page})=>{
 for(const outcome of ['return','cancel','failure','success']) {
  await open(page,`/orders/A?ozow=${outcome}`);
  await expect(page.getByText(/Payment: Unpaid/)).toBeVisible();
  await expect(page.getByText('Paid',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>fixture.ozowCalls||0)).toBe(0);
 }
});
test('enabled delivery requires permission and review of a server quote',async({page,context})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:-29.721180,longitude:31.071621,accuracy:10});
  await page.addInitScript(()=>{
    window.fixtureDeliveryConfig={enabled:true};
    localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'synthetic-vendor',vendorName:'Synthetic',name:'Lunch',price:100,qty:1}]));
  });
  await open(page,'/checkout');
  await page.getByLabel('Your name').fill('Synthetic guest');await page.getByLabel('Mobile number').fill('0821234567');await page.getByLabel('Where should we deliver?').fill('Synthetic destination');
  await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Use my location and calculate delivery'}).click();
  await expect(page.getByText(/1.10 km/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeEnabled();
  await page.getByLabel('Mobile number').fill('0831234567');
  await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
});
