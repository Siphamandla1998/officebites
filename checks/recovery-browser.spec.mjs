import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const pageErrors = new WeakMap();
test.beforeEach(async ({page}, testInfo) => {
 if (!testInfo.title.startsWith('unmocked')) {
  await page.route('**/*.supabase.co/**', route => route.abort());
  // Keep a real reload in the isolated fixture app after BrowserRouter changes the URL.
  await page.route('http://127.0.0.1:5176/**', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch({url:'http://127.0.0.1:5176/checks/browser-harness.html'});
    await route.fulfill({response});
  });
 } pageErrors.set(page, []); page.on('pageerror', error => pageErrors.get(page).push(error.message)); });
test.afterEach(async ({page}) => { if (!pageErrors.has(page)) return; expect(pageErrors.get(page)).toEqual([]); await expect(page.locator('body')).not.toContainText('Something went wrong'); expect(await page.evaluate(() => window.fixture?.unknownRpcs || [])).toEqual([]); });
const user=id=>({id,name:id,email:`${id}@test.invalid`,role:'customer'});
async function open(page,route='/help/tickets') { await page.goto(new URL(`/checks/browser-harness.html?route=${encodeURIComponent(route)}`, test.info().project.use.baseURL).href, {waitUntil: 'domcontentloaded'});await page.waitForFunction(()=>window.fixture?.authChanged); }
test('real provider tree: signed out, reload, signed in, account switching, logout, notification failure/retry',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page);await expect(page.getByText('Sign in to view your tickets')).toBeVisible();
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.fixture?.authChanged);await expect(page.getByText('Sign in to view your tickets')).toBeVisible();
 await page.evaluate(u=>fixture.setUser(u),user('A'));await page.evaluate(()=>fixture.navigate('/notifications'));await expect(page.getByText('Private A')).toBeVisible();
 await page.evaluate(u=>fixture.setUser(u),user('B'));await expect(page.getByText('Private B')).toBeVisible();await expect(page.getByText('Private A')).toHaveCount(0);
 await page.evaluate(()=>fixture.setUser(null));await expect(page.getByText('Private B')).toHaveCount(0);
 await page.evaluate(u=>{fixture.notificationsFail=true;return fixture.setUser(u);},user('C'));
 await expect(page.getByText('Synthetic notification failure')).toBeVisible();
 await page.evaluate(()=>{fixture.notificationsFail=false;});await page.getByRole('button',{name:/retry/i}).click();await expect(page.getByText('Private C')).toBeVisible();
 expect(errors).toEqual([]);
});
test('deferred manual order response cannot replace route B',async({page})=>{
 await open(page,'/orders/A');await expect(page.getByText('OB-A').first()).toBeVisible();
 await page.evaluate(()=>fixture.deferOrder=true);await page.getByRole('button',{name:'Refresh payment status'}).click();await page.waitForFunction(()=>fixture.pending.length>=1);
 await page.evaluate(()=>{fixture.deferOrder=false;fixture.navigate('/orders/B');});await expect(page.getByText('OB-B').first()).toBeVisible();
 await page.evaluate(()=>{while(fixture.pending.length)fixture.resolveOrder();});await expect(page.getByText('OB-B').first()).toBeVisible();await expect(page.getByText('OB-A')).toHaveCount(0);
});
test('payment response cannot redirect after route or account switch',async({page})=>{
 await open(page,'/payment/A');await page.evaluate(u=>fixture.setUser(u),user('A'));await expect(page.getByRole('button',{name:/Pay R100/})).toBeVisible();
 await page.evaluate(()=>fixture.deferPayment=true);await page.getByRole('button',{name:/Pay R100/}).click();await page.waitForFunction(()=>fixture.resolvePayment);
 await page.evaluate(()=>fixture.navigate('/payment/B'));await expect(page.getByText(/existing order OB-B/)).toBeVisible();
 await page.evaluate(()=>fixture.resolvePayment());expect(await page.evaluate(()=>fixture.redirects.length)).toBe(0);
 await page.getByRole('button',{name:/Pay R100/}).click();await page.waitForFunction(()=>fixture.resolvePayment);
 await page.evaluate(u=>fixture.setUser(u),user('B'));await page.evaluate(()=>fixture.resolvePayment());expect(await page.evaluate(()=>fixture.redirects.length)).toBe(0);
});
for(const storageError of ['SecurityError','QuotaExceededError'])test(`verified guest tracking survives ${storageError}`,async({page})=>{
 await open(page,'/track');await page.evaluate(name=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked',name);};},storageError);
 await page.getByLabel('Order code').fill('OB-TRACKED');await page.getByLabel('Phone number used at checkout').fill('fixture-contact');await page.getByRole('button',{name:'Find my order'}).click();
 await expect(page.getByText('OB-TRACKED').first()).toBeVisible();expect(await page.evaluate(()=>fixture.guestAccess('TRACKED')?.contact)).toBe('fixture-contact');
});
test('financial mutation invalidates both visible datasets and downloaded CSV',async({page})=>{
 await open(page);await page.evaluate(u=>fixture.setUser(u),{...user('ADMIN'),role:'admin'});await page.evaluate(()=>fixture.navigate('/admin/reports'));
 const download=async()=>{const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download sales and commissions CSV'}).click();return fs.readFile(await(await event).path(),'utf8');};
 const before=await download();expect(before).toContain('Undecided');expect(before).toContain("'=unsafe");
 await page.getByLabel('Fee policy decision reason').fill('Synthetic policy decision');await page.getByRole('button',{name:'Record fee policy'}).click();
 await expect(page.getByText(/Fee policy: platform_absorbs/)).toBeVisible();const after=await download();expect(after).toContain('platform_absorbs');expect(after).not.toContain('Undecided');
});
test('public request failure has retry, not an empty result',async({page})=>{
 await open(page);await page.evaluate(()=>{fixture.failPublic=true;fixture.navigate('/help/faq');});await expect(page.getByText('Synthetic FAQ failure')).toBeVisible();await expect(page.getByText('No matching FAQs')).toHaveCount(0);
 await page.evaluate(()=>fixture.failPublic=false);await page.getByRole('button',{name:/retry/i}).click();await expect(page.getByText('No matching FAQs')).toBeVisible();
});

for (const storageError of ['SecurityError','QuotaExceededError']) test(`successful checkout recovers without a second create under ${storageError}`, async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('ob_cart', JSON.stringify([{mealId:'fixture-meal',vendorId:'fixture-vendor',vendorName:'Fixture',name:'Lunch',price:100,qty:1}])));
  await open(page, '/checkout');
  await page.getByLabel('Your name').fill('Synthetic guest');
  await page.getByLabel('Mobile number').fill('fixture-contact');
  await page.getByLabel('Where should we deliver?').fill('Synthetic office');
  await page.evaluate(name => { Storage.prototype.setItem = function(){ throw new DOMException('Blocked',name); }; }, storageError);
  await page.getByRole('button',{name:'Place order',exact:true}).click();
  await expect(page.getByText('OB-CREATED',{exact:true})).toBeVisible();
  await expect(page.getByText(/Save this code/)).toBeVisible();
  await page.getByRole('button',{name:'Continue to payment'}).click();
  await expect(page.getByText(/existing order OB-CREATED/)).toBeVisible();
  expect(await page.evaluate(() => fixture.creates)).toBe(1);
});
test('business clocks, date-only values and cutoff across four browser timezones', async ({browser}) => {
  for (const timezoneId of ['Africa/Johannesburg','UTC','America/Los_Angeles','Asia/Tokyo']) {
    const context=await browser.newContext({timezoneId});const page=await context.newPage();await open(page);
    const results=await page.evaluate(()=>fixture.businessDates());
    expect(results.time).toBe('19:00');expect(results.date).toContain('8');expect(results.before).toBe('2026-10-09');expect(results.cutoff).toBe('2026-10-10');expect(results.midnight).toBe('2026-10-10');await context.close();
  }
});
test('unmocked public frontend renders signed out against read-only hosted data', async ({page}) => {
  await page.route('**/*.supabase.co/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const path of ['/','/help/tickets','/track','/help/faq','/help/guides','/food/search']) {
    await page.goto(path, {waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.locator('.skeleton')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    if(path==='/help/tickets')await expect(page.getByText('Sign in to view your tickets')).toBeVisible();
    if(path==='/'){await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('heading').first()).toBeVisible();await expect(page.locator('.skeleton')).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);}
  }
  expect(errors).toEqual([]);
});

test('payment response cannot redirect once the URL leaves the payment page', async ({page}) => {
  await open(page, '/payment/A');
  await page.evaluate(u => fixture.setUser(u), user('A'));
  await expect(page.getByRole('button', {name:/Pay R100/})).toBeVisible();
  await page.evaluate(() => fixture.deferPayment = true);
  await page.getByRole('button', {name:/Pay R100/}).click();
  await page.waitForFunction(() => fixture.resolvePayment);
  await page.evaluate(() => fixture.navigate('/help/tickets'));
  await expect(page).toHaveURL(/help\/tickets/);
  await page.evaluate(() => fixture.resolvePayment());
  expect(await page.evaluate(() => fixture.redirects.length)).toBe(0);
  await expect(page).toHaveURL(/help\/tickets/);
});

for (const leave of ['route', 'account']) test(`checkout response cannot affect a new ${leave} scope`, async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('ob_cart', JSON.stringify([{mealId:'fixture-meal',vendorId:'fixture-vendor',vendorName:'Fixture',name:'Lunch',price:100,qty:1}])));
  await open(page, '/checkout');
  await page.getByLabel('Your name').fill('Synthetic guest');
  await page.getByLabel('Mobile number').fill('fixture-contact');
  await page.getByLabel('Where should we deliver?').fill('Synthetic office');
  await page.evaluate(() => fixture.deferCreate = true);
  await page.getByRole('button', {name:'Place order',exact:true}).click();
  await page.waitForFunction(() => fixture.resolveCreate);
  if (leave === 'route') await page.evaluate(() => fixture.navigate('/track'));
  else await page.evaluate(u => fixture.setUser(u), user('NEW'));
  await page.evaluate(() => fixture.resolveCreate());
  await expect(page.getByText('OB-CREATED',{exact:true})).toHaveCount(0);
  await expect(page).not.toHaveURL(/payment/);
  expect(await page.evaluate(() => fixture.creates)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ob_cart')).length)).toBe(1);
  expect(await page.evaluate(() => fixture.guestAccess('CREATED')?.contact)).toBe('fixture-contact');
});

test('protected financial state resets between admin accounts', async ({page}) => {
  await open(page);
  await page.evaluate(u => fixture.setUser(u), {...user('ADMIN-A'),role:'admin'});
  await page.evaluate(() => fixture.navigate('/admin/reports'));
  await page.getByLabel('Report from date').fill('2001-01-01');
  await expect(page.getByRole('button', {name:'Download sales and commissions CSV'})).toBeVisible();
  await page.evaluate(u => fixture.setUser(u), {...user('ADMIN-B'),role:'admin'});
  await expect(page.getByLabel('Report from date')).not.toHaveValue('2001-01-01');
});

test('failed financial refresh blocks CSV until retry succeeds', async ({page}) => {
  await open(page);
  await page.evaluate(u => fixture.setUser(u), {...user('ADMIN'),role:'admin'});
  await page.evaluate(() => fixture.navigate('/admin/reports'));
  await expect(page.getByRole('button', {name:'Download sales and commissions CSV'})).toBeVisible();
  await page.evaluate(() => fixture.failFinance = true);
  await page.getByLabel('Report from date').fill('2026-01-01');
  await expect(page.getByText('Synthetic report failure')).toBeVisible();
  await expect(page.getByRole('button', {name:'Download sales and commissions CSV'})).toHaveCount(0);
  await page.evaluate(() => fixture.failFinance = false);
  await page.getByRole('button', {name:/retry/i}).click();
  await expect(page.getByRole('button', {name:'Download sales and commissions CSV'})).toBeVisible();
});

test('vendor dashboard refreshes on focus without a navigation', async ({page}) => {
  await open(page);
  await page.evaluate(u => fixture.setUser(u), {...user('VENDOR'),role:'vendor',vendorId:'fixture-vendor'});
  await page.evaluate(() => fixture.navigate('/vendor'));
  await page.waitForFunction(() => fixture.vendorRefreshes > 0);
  const before = await page.evaluate(() => fixture.vendorRefreshes);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(n => fixture.vendorRefreshes > n, before);
});
