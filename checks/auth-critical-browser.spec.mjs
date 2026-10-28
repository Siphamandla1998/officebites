import { test, expect } from '@playwright/test';

// Real authService/profile resolution and providers; synthetic Auth transport only.
// All hosted traffic is blocked. These tests do not certify hosted passwords/JWTs.
for (const [role, destination] of [['customer','/'],['vendor','/vendor'],['admin','/admin']]) {
 test(`${role} login resolves the database role and reload restores its session`, async ({page}) => {
  await page.route('**/*.supabase.co/**', r=>r.abort());
  await page.addInitScript(role=>{
   window.fixtureAuthTransport=true;
   window.fixtureAuthProfile={id:'synthetic-'+role,name:'Synthetic '+role,email:'test@example.invalid',role,vendor_id:role==='vendor'?'fixture-vendor':null};
  },role);
  await page.goto('/checks/browser-harness.html?route=/login');
  await page.getByLabel('Email',{exact:true}).fill('test@example.invalid');
  await page.getByLabel('Password',{exact:true}).fill('synthetic-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(destination==='/'?'/$':destination+'$'));
  await page.addInitScript(()=>{window.fixtureRestoreSession=true;});
  await page.goto('/checks/browser-harness.html?route='+destination);
  await expect(page).toHaveURL(new RegExp(destination==='/'?'/$':destination+'$'));
  await expect(page.getByRole('heading').first()).toBeVisible();
  if(role==='customer') {
   await page.evaluate(()=>fixture.navigate('/admin/payments'));
   await expect(page).toHaveURL(/\/$/);
   await expect(page.getByRole('form',{name:'Manual checkout controls'})).toHaveCount(0);
  }
 });
}

for (const [role, vendorId] of [['unrecognised',null],['vendor',null]]) {
 test(`unresolved profile ${role} cannot enter protected screens`,async({page})=>{
  await page.route('**/*.supabase.co/**',r=>r.abort());
  await page.addInitScript(({role,vendorId})=>{
   window.fixtureAuthTransport=true;
   window.fixtureAuthProfile={id:'synthetic-invalid',role,vendor_id:vendorId};
  },{role,vendorId});
  await page.goto('/checks/browser-harness.html?route=/login');
  await page.getByLabel('Email',{exact:true}).fill('test@example.invalid');
  await page.getByLabel('Password',{exact:true}).fill('synthetic-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('account role could not be resolved');
  await expect(page).toHaveURL(/\/login$/);
 });
}

test('invalid credentials give actionable feedback without entering a protected route',async({page})=>{
 await page.route('**/*.supabase.co/**',r=>r.abort());
 await page.addInitScript(()=>{window.fixtureAuthTransport=true;window.fixtureAuthError={code:'invalid_credentials',status:400};});
 await page.goto('/checks/browser-harness.html?route=/login');
 await page.getByLabel('Email',{exact:true}).fill('test@example.invalid');
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Check your email and password');
 await expect(page).toHaveURL(/\/login$/);
});

test('signed-out reset link fails closed and offers recovery',async({page})=>{
 await page.route('**/*.supabase.co/**',r=>r.abort());
 await page.goto('/checks/browser-harness.html?route=/reset-password');
 await expect(page.getByRole('alert')).toContainText('invalid or has expired');
 await expect(page.getByRole('link',{name:'Request a new link'})).toHaveAttribute('href','/forgot-password');
 await expect(page.getByRole('button',{name:'Update password'})).toHaveCount(0);
});
