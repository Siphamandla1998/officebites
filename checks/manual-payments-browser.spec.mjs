import { test, expect } from '@playwright/test';
import fs from 'node:fs';
test.beforeEach(async ({page}) => {
 await page.route('**/*.supabase.co/**',route=>route.abort());
 await page.route('http://127.0.0.1:5176/**',async route=>{
  if(route.request().resourceType()!=='document')return route.continue();
  await route.fulfill({response:await route.fetch({url:'http://127.0.0.1:5176/checks/browser-harness.html'})});
 });
});
const open=async(page,route)=>{await page.goto('/checks/browser-harness.html?route='+encodeURIComponent(route));await page.waitForFunction(()=>window.fixture?.authChanged);};

test('support is contextual to payment instructions and order tracking on mobile and desktop',async({page})=>{
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await open(page,'/payment/A');
  const help=page.getByRole('link',{name:'Payment Help',exact:true});await help.focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/help\/contact$/);await expect(page.getByLabel('Message',{exact:true})).toBeVisible();
  await open(page,'/orders/A');await page.getByRole('link',{name:'Get Help with This Order',exact:true}).click();
  await expect(page).toHaveURL(/\/help\/contact$/);
  expect(await page.evaluate(()=>fixture.creates)).toBe(0);
 }
});
test('direct support and refresh use the real SPA fallback and contact route',async({page})=>{
 // Remove document substitution: this exercises index.html and the actual router,
 // rather than making a harness response appear to prove the server fallback.
 await page.unroute('http://127.0.0.1:5176/**');
 const response=await page.goto('/support');expect(response.status()).toBe(200);
 await expect(page).toHaveURL(/\/help\/contact$/);
 await expect(page.getByLabel('Subject',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:'Submit request',exact:true})).toBeVisible();
 await page.goto('/support');await expect(page).toHaveURL(/\/help\/contact$/);
 await page.reload();await expect(page.getByLabel('Message',{exact:true})).toBeVisible();
});

test('copy snapshot details and report payment remain separate from settlement at both widths',async({page})=>{
 fs.mkdirSync('.officebites-local/manual-payment-visuals',{recursive:true});
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedPayment=text;}}}));
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});await open(page,'/payment/A');
  const copy=page.getByRole('button',{name:'Copy Payment Details',exact:true});
  await copy.focus();await page.keyboard.press('Enter');await expect(page.getByText('Copied',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.copiedPayment)).toContain('Account number: 1234567890');
  expect(await page.evaluate(()=>window.copiedPayment)).toContain('Payment reference: OB-SYNTHETIC');
  expect(await page.evaluate(()=>window.copiedPayment)).not.toContain('synthetic@bank');
  await expect(page.getByText(/Reporting payment does not confirm receipt or authorise fulfilment/)).toBeVisible();
  await page.getByRole('button',{name:"I've made payment"}).click();
  await expect(page.getByText(/Payment reported. Awaiting independent verification/)).toBeVisible();
  await expect(page.getByRole('button',{name:"I've made payment"})).toBeDisabled();
  expect(await page.evaluate(()=>fixture.manualState)).toBe('payment_reported');
  await expect(page.getByText('1234567890',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.officebites-local/manual-payment-visuals/payment-controls-${width}.png`,fullPage:true});
 }
});

test('clipboard failure leaves original details and reporting available',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Synthetic clipboard denied');}}}));
 await open(page,'/payment/A');await page.getByRole('button',{name:'Copy Payment Details',exact:true}).click();
 await expect(page.getByText('Copy unavailable. Select and copy the value shown.')).toBeVisible();
 await expect(page.getByText('1234567890',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:"I've made payment"})).toBeEnabled();
 expect(await page.evaluate(()=>fixture.manualReports||0)).toBe(0);
});

test('PayShap copy contains the order ShapID without EFT-only account fields',async({page})=>{
 await page.addInitScript(()=>{window.fixtureManualMethod='manual_payshap';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedPayment=text;}}});});
 await open(page,'/payment/A');await page.getByRole('button',{name:'Copy Payment Details',exact:true}).click();
 const copied=await page.evaluate(()=>window.copiedPayment);
 expect(copied).toContain('Registered ShapID: synthetic@bank');expect(copied).toContain('Payment reference: OB-SYNTHETIC');
 expect(copied).not.toContain('1234567890');expect(copied).not.toContain('Branch code');
});

test('confirmed cancelled and disputed payment screens cannot report again',async({page})=>{
 await page.addInitScript(()=>{window.fixtureManualState=new URLSearchParams(location.search).get('manualState');});
 for(const state of ['paid','cancelled','disputed']){
  await page.goto(`/checks/browser-harness.html?manualState=${state}&route=${encodeURIComponent('/payment/A')}`);
  await page.waitForFunction(()=>window.fixture?.authChanged);
  expect(await page.evaluate(()=>window.fixtureManualState)).toBe(state);
  await expect(page.getByRole('button',{name:"I've made payment"})).toBeDisabled();
  await expect(page.getByText('1234567890',{exact:true})).toBeVisible();
  await expect(page.getByText(/The vendor handles refunds after checking their bank account/)).toBeVisible();
  await expect(page.getByRole('link',{name:'Payment Help',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>fixture.manualReports||0)).toBe(0);
 }
});
test('manual EFT instructions, reporting lock, and no gateway fallback at mobile and desktop',async({page})=>{
 fs.mkdirSync('.officebites-local/manual-payment-visuals',{recursive:true});
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await open(page,'/payment/A');
  await expect(page.getByText('1234567890',{exact:true})).toBeVisible();
  await expect(page.getByText('OB-SYNTHETIC',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/with PayFast|with Ozow/})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.officebites-local/manual-payment-visuals/eft-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:"I've made payment"}).evaluate(el=>{el.click();el.click();});
  await expect(page.getByText(/Payment reported. Awaiting independent verification/)).toBeVisible();
  expect(await page.evaluate(()=>fixture.manualReports)).toBe(1);
  expect(await page.evaluate(()=>fixture.redirects)).toEqual([]);
 }
});
test('PayShap displays registered ShapID and protects absent capability',async({page})=>{
 await page.addInitScript(()=>window.fixtureManualMethod='manual_payshap');await open(page,'/payment/A');
 await expect(page.getByText('synthetic@bank',{exact:true})).toBeVisible();
 await expect(page.getByText('1234567890',{exact:true})).toHaveCount(0);
});
test('missing protected access never reveals bank instructions',async({page})=>{
 await page.addInitScript(()=>window.fixtureManualAccessDenied=true);await open(page,'/payment/A');
 await expect(page.getByText('Payment access unavailable',{exact:true})).toBeVisible();
 await expect(page.getByText('1234567890',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:"I've made payment"})).toHaveCount(0);
});
test('guest checkout supports only approved vendor methods',async({page})=>{
 await page.addInitScript(()=>{window.fixtureEftOnly=true;localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'fixture-vendor',vendorName:'Synthetic vendor',name:'Lunch',price:100,qty:1}]));});
 await page.setViewportSize({width:390,height:900});await open(page,'/checkout');
 await expect(page.getByRole('radio',{name:/PayShap/})).toHaveCount(0);
 await expect(page.getByRole('radio',{name:/EFT/})).toBeChecked();
 await page.getByLabel('Your name').fill('Synthetic guest');await page.getByLabel('Mobile number').fill('0821234567');await page.getByLabel('Where should we deliver?').fill('Synthetic office');
 await page.getByRole('button',{name:'Place order',exact:true}).click();
 await expect(page).toHaveURL(/\/payment\/CREATED/);expect(await page.evaluate(()=>fixture.creates)).toBe(1);
 expect(await page.evaluate(()=>fixture.guestAccess('CREATED').contact)).toBe('0821234567');
});
test('unapproved profile blocks checkout and preserves cart',async({page})=>{
 await page.addInitScript(()=>{window.fixtureManualUnavailable=true;localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'fixture-vendor',vendorName:'Synthetic vendor',name:'Lunch',price:100,qty:1}]));});
 await open(page,'/checkout');await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ob_cart')).length)).toBe(1);
 expect(await page.evaluate(()=>fixture.creates)).toBe(0);
});

for(const [name,methods,selected] of [
 ['PayShap only',{manual_payshap:true,manual_eft:false},'PayShap'],
 ['EFT only',{manual_payshap:false,manual_eft:true},'EFT'],
 ['both eligible',{manual_payshap:true,manual_eft:true},'PayShap'],
 ['neither eligible',{manual_payshap:false,manual_eft:false},null],
])test(`payment hierarchy: ${name}`,async({page})=>{
 fs.mkdirSync('.officebites-local/payment-hierarchy',{recursive:true});
 await page.addInitScript(value=>{window.fixtureManualMethods=value;window.fixtureOzowAvailable=true;localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'fixture-vendor',vendorName:'Synthetic vendor',name:'Lunch',price:70,qty:1}]));},methods);
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});await open(page,'/checkout');
  await expect(page.getByRole('heading',{name:'Payment',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Other Payment Methods',exact:true})).toHaveCount(0);
  await expect(page.getByRole('radio',{name:/PayFast|Ozow/})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Contact Support|Payment Help/})).toHaveCount(0);
  if(selected){
   await expect(page.getByRole('radio',{name:new RegExp(selected)})).toBeChecked();
   await expect(page.getByRole('radio')).toHaveCount(Object.values(methods).filter(Boolean).length);
   await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeEnabled();
  }else{
   await expect(page.getByText('Online ordering is temporarily unavailable.',{exact:true})).toBeVisible();
   await expect(page.getByRole('radio')).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
   await expect(page.getByRole('link',{name:'Back to menu',exact:true})).toHaveAttribute('href','/food/search');
  }
  expect(await page.evaluate(()=>fixture.creates)).toBe(0);expect(await page.evaluate(()=>fixture.redirects)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('region',{name:'Payment',exact:true}).evaluate(el=>window.scrollTo(0,Math.max(0,el.getBoundingClientRect().top+window.scrollY-130)));
  await page.screenshot({path:`.officebites-local/payment-hierarchy/${name.replaceAll(' ','-')}-${width}.png`});
  if(!selected){
   await page.getByRole('link',{name:'Back to menu',exact:true}).click();await expect(page).toHaveURL(/\/food\/search$/);
   expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ob_cart')).length)).toBe(1);
  }
 }
});
test('permitted primary methods select with keyboard and order creation retains EFT',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'fixture-vendor',vendorName:'Synthetic vendor',name:'Lunch',price:70,qty:1}])));
 await open(page,'/checkout');
 const payshap=page.getByRole('radio',{name:/PayShap/});const eft=page.getByRole('radio',{name:/EFT/});
 await expect(payshap).toBeChecked();await payshap.focus();await page.keyboard.press('ArrowDown');await expect(eft).toBeChecked();
 await page.getByLabel('Your name').fill('Synthetic guest');await page.getByLabel('Mobile number').fill('0821234567');await page.getByLabel('Where should we deliver?').fill('Synthetic office');
 await page.getByRole('button',{name:'Place order',exact:true}).click();
 await expect(page).toHaveURL(/\/payment\/CREATED/);
 expect(await page.evaluate(()=>fixture.createdPaymentMethod)).toBe('manual_eft');
 expect(await page.evaluate(()=>fixture.redirects)).toEqual([]);
});

test('backend availability refresh removes disabled primary choices without provider fallback',async({page})=>{
 await page.addInitScript(()=>{window.fixtureManualMethodsByVendor={'fixture-vendor':{manual_eft:false,manual_payshap:true}};localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'fixture-vendor',vendorName:'Synthetic vendor',name:'Lunch',price:70,qty:1}]));});
 await open(page,'/checkout');
 await expect(page.getByRole('radio',{name:/PayShap/})).toBeChecked();await expect(page.getByRole('radio',{name:/EFT/})).toHaveCount(0);
 await page.evaluate(()=>{window.fixtureManualMethodsByVendor['fixture-vendor']={manual_eft:false,manual_payshap:false};window.dispatchEvent(new Event('focus'));});
 await expect(page.getByRole('radio',{name:/PayShap/})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>fixture.creates)).toBe(0);
 await expect(page.getByRole('button',{name:'Other Payment Methods',exact:true})).toHaveCount(0);
});

test('method loading and error stay distinct from confirmed unavailability and retry safely',async({page})=>{
 await page.addInitScript(()=>{window.fixtureDeferManualMethods=true;window.fixtureManualMethods={manual_eft:true};localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'fixture-vendor',vendorName:'Synthetic vendor',name:'Lunch',price:70,qty:1}]));});
 await open(page,'/checkout');await expect(page.getByText('Checking available payment options…',{exact:true})).toBeVisible();
 await expect(page.getByText('Online ordering is temporarily unavailable.',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
 await page.evaluate(()=>{window.fixtureDeferManualMethods=false;fixture.resolveManualMethods();});
 await expect(page.getByRole('radio',{name:/EFT/})).toBeChecked();
 await page.evaluate(()=>{window.fixtureManualMethodsError=true;window.dispatchEvent(new Event('focus'));});
 await expect(page.getByText('Synthetic method refresh failed',{exact:true})).toBeVisible();
 await expect(page.getByRole('radio')).toHaveCount(0);
 await expect(page.getByText('Online ordering is temporarily unavailable.',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
 await page.evaluate(()=>{window.fixtureManualMethodsError=false;});await page.getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.getByRole('radio',{name:/EFT/})).toBeChecked();
 expect(await page.evaluate(()=>fixture.creates)).toBe(0);
});
test('synthetic statements are opt-in, labelled, and blocked after a failed refresh',async({page})=>{
 await page.addInitScript(()=>{
  window.fixtureManualWorkspace={true:{settings:null,profiles:[],payments:[],events:[],receivables:[{order_id:'SYNTHETIC-TEST',vendor_id:'fixture-vendor',reference:'OB-TEST-ONLY',created_at:new Date().toISOString(),gross:'100.00',commission:'17.00',refunds:'0.00',credits:'5.95',collected:'5.00'}]}};
 });
 await open(page,'/help');
 await page.evaluate(async()=>{await fixture.setUser({id:'VENDOR',role:'vendor',vendorId:'fixture-vendor'});fixture.navigate('/vendor/orders');});
 const toggle=page.getByLabel('Show synthetic test orders only');
 const exportButton=page.getByRole('button',{name:'Export commission statement CSV'});
 await expect(exportButton).toBeDisabled();await toggle.check();
 await expect(page.getByText(/Test orders only. These figures/)).toBeVisible();
 const download=page.waitForEvent('download');await exportButton.click();const file=await download;
 expect(file.suggestedFilename()).toBe('synthetic-vendor-direct-statement.csv');
 const csv=fs.readFileSync(await file.path(),'utf8');expect(csv).toContain('synthetic');expect(csv).toContain('OB-TEST-ONLY');expect(csv).toContain('6.05');
 await page.evaluate(()=>fixture.failManualWorkspace=true);await page.getByRole('button',{name:'Refresh payment workspace'}).click();
 await expect(page.getByText('Synthetic manual workspace refresh failed',{exact:true})).toBeVisible();await expect(exportButton).toBeDisabled();
});
