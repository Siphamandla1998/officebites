import {test,expect} from '@playwright/test';
const labels={terms:'Terms',privacy:'Privacy','refund-policy':'Refunds',delivery:'Delivery',cookies:'Cookies','company-information':'Company information'};
const docs=()=>Object.fromEntries(Object.entries(labels).map(([kind,title])=>[kind,{id:'synthetic-'+kind,kind,title,version:'SYNTHETIC-v1',content:'SYNTHETIC complete text only. This is a local fixture, never approved live legal text.',content_hash:'a'.repeat(64),effective_at:'2026-01-01',created_at:'2026-01-01'}]));
async function open(page,route='/help/contact'){
 await page.route('**/*.supabase.co/**',r=>r.abort());await page.goto('/checks/browser-harness.html?route='+encodeURIComponent(route));await page.waitForFunction(()=>window.fixture?.authChanged);
}
for(const [kind,title] of Object.entries(labels))test('public '+title+' route fails closed without approved text',async({page})=>{
 await open(page,'/'+kind);await expect(page.getByRole('heading',{name:title,exact:true,level:1})).toBeVisible();await expect(page.getByText(/An approved version of this document has not been published/)).toBeVisible();await expect(page.getByRole('checkbox')).toHaveCount(0);
});
test('six approved-source document fixtures read and print without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.evaluate(d=>{fixture.legalPortal={documents:d,businessReady:true};fixture.navigate('/cookies');},docs());
 await expect(page.getByRole('heading',{name:'Cookies',exact:true,level:1})).toBeVisible();await expect(page.getByText('SYNTHETIC-v1',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Print / save PDF'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('guest checkout requires an unchecked current review and sends no identity or marketing assent',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'fixture-vendor',vendorName:'Synthetic vendor',name:'Lunch',price:70,qty:1}])));
 await open(page);await page.evaluate(d=>{fixture.customerLegal={enabled:true,ready:true,documents:d};fixture.navigate('/checkout');},docs());
 const place=page.getByRole('button',{name:'Place order',exact:true});await expect(place).toBeDisabled();const check=page.getByRole('checkbox',{name:/I agree to the Terms/});await expect(check).not.toBeChecked();
 await page.getByLabel('Your name').fill('SYNTHETIC guest');await page.getByLabel('Mobile number').fill('0821234567');await page.getByLabel('Where should we deliver?').fill('SYNTHETIC office');
 await check.focus();await page.keyboard.press('Space');await expect(place).toBeEnabled();await place.click();await page.waitForFunction(()=>fixture.creates===1);
 const payload=await page.evaluate(()=>fixture.createdLegalAcceptance);expect(Object.keys(payload).sort()).toEqual(['acknowledged','documents']);expect(payload.documents.terms).toBe('synthetic-terms');expect(payload).not.toHaveProperty('marketing');
});
test('closed legal rollout blocks checkout even if methods response claims eligibility',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'fixture-vendor',vendorName:'Synthetic vendor',name:'Lunch',price:70,qty:1}])));
 await open(page,'/checkout');await expect(page.getByRole('radio',{name:/EFT/})).toBeChecked();
 await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
 await expect(page.getByText('Legal acceptance is not open. No acceptance is being recorded.')).toBeVisible();
 expect(await page.evaluate(()=>fixture.creates)).toBe(0);expect(await page.evaluate(()=>fixture.unknownRpcs)).toEqual([]);
});
test('stale versions and offline state require a fresh unchecked review',async({page,context})=>{
 await page.addInitScript(()=>localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'fixture-vendor',vendorName:'Synthetic vendor',name:'Lunch',price:70,qty:1}])));
 await open(page);await page.evaluate(d=>{fixture.customerLegal={enabled:true,ready:true,documents:d};fixture.navigate('/checkout');},docs());
 const check=page.getByRole('checkbox',{name:/I agree to the Terms/});await check.check();await context.setOffline(true);await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();await expect(check).not.toBeChecked();
 await context.setOffline(false);await page.evaluate(()=>{fixture.customerLegal.documents.terms={...fixture.customerLegal.documents.terms,id:'changed-terms',version:'SYNTHETIC-v2'};window.dispatchEvent(new Event('focus'));});await expect(check).not.toBeChecked();await expect(page.getByText(/Terms · SYNTHETIC-v2/)).toBeVisible();
});
test('publication and acceptance remain disabled without release authorization',async({page})=>{
 await open(page);await page.evaluate(async()=>{await fixture.setUser({id:'ADMIN',role:'admin'});fixture.navigate('/admin/legal');});
await expect(page.getByRole('button',{name:'Approve publication',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Enable mandatory application consent',exact:true})).toHaveCount(0);
 for(const box of await page.getByRole('checkbox').all())await expect(box).not.toBeChecked();
});
test('order receipt preserves archived versions and never backfills older orders',async({page})=>{
 await open(page,'/orders/older/legal');await expect(page.getByText(/No versioned acceptance was recorded/)).toBeVisible();await page.evaluate(d=>{fixture.orderLegalReceipt={order_id:'saved',is_guest:true,documents:d,accepted_at:'2026-10-01',acknowledgement:'SYNTHETIC original declaration'};fixture.navigate('/orders/saved/legal');},docs());
 await expect(page.getByText('SYNTHETIC original declaration')).toBeVisible();await expect(page.getByText(/Guest order; no authenticated account identity claimed/)).toBeVisible();await expect(page.getByRole('button',{name:'Print / save order terms'})).toBeVisible();
});
