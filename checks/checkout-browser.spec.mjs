import { test, expect } from '@playwright/test';
test.beforeEach(async ({page}) => {
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.route('http://127.0.0.1:5176/**', async route => {
    if(route.request().resourceType()!=='document') return route.continue();
    await route.fulfill({response:await route.fetch({url:'http://127.0.0.1:5176/checks/browser-harness.html'})});
  });
});
const open=async(page,path)=>{await page.goto('/checks/browser-harness.html?route='+encodeURIComponent(path));await page.waitForFunction(()=>window.fixture?.authChanged);};
test('return is navigation; explicit confirmed cancellation is single-shot',async({page})=>{
  await open(page,'/payment/A');
  await page.getByRole('button',{name:'Cancel payment',exact:true}).click();
  expect(await page.evaluate(()=>fixture.cancels||0)).toBe(0);
  await page.getByRole('button',{name:'Return to order without cancelling'}).click();
  await expect(page).toHaveURL(/\/orders\/A/);
  expect(await page.evaluate(()=>fixture.cancels||0)).toBe(0);
  await page.evaluate(()=>fixture.navigate('/payment/A'));
  await page.getByRole('button',{name:'Cancel payment',exact:true}).click();
  await page.getByRole('button',{name:'Confirm cancel unpaid order'}).evaluate(button=>{button.click();button.click();});
  await expect(page).toHaveURL(/\/orders\/A/);
  expect(await page.evaluate(()=>fixture.cancels)).toBe(1);
});
test('processing refusal remains on order payment screen with actionable error',async({page})=>{
  await open(page,'/payment/A');await page.evaluate(()=>fixture.cancelFail=true);
  await page.getByRole('button',{name:'Cancel payment',exact:true}).click();
  await page.getByRole('button',{name:'Confirm cancel unpaid order'}).click();
  await expect(page.getByText('A payment may be processing',{exact:true})).toBeVisible();
  await expect(page).toHaveURL(/\/payment\/A/);
});
test('guest mobile validation prevents creation; valid local number preserves zero',async({page})=>{
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
  await page.addInitScript(()=>{window.fixtureGatewayDisabled=true;});
  await open(page,'/payment/A');
  await expect(page.getByRole('button',{name:/Pay .* with PayFast/})).toBeDisabled();
  await expect(page.getByRole('button',{name:/Pay .* with Ozow/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Return to order',exact:true})).toBeEnabled();
});
test('Ozow control obeys action lock and surfaces ambiguous initiation',async({page})=>{
  await page.addInitScript(()=>{window.fixtureOzowAvailable=true;});
  await open(page,'/payment/A');
  await page.evaluate(()=>fixture.setUser({id:'SYNTHETIC-CUSTOMER',name:'Synthetic',email:'synthetic@test.invalid',role:'customer'}));
  const button=page.getByRole('button',{name:/Pay .* with Ozow/});
  await expect(button).toBeEnabled();
  await button.evaluate(el=>{el.click();el.click();});
  await expect(page.getByText('Synthetic Ozow reconciliation required',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>fixture.ozowCalls)).toBe(1);
  await expect(button).toBeEnabled();
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
