import { test, expect } from '@playwright/test';
test('excluded cash instructions cannot display bank details or report payment',async({page})=>{
 await page.route('**/*.supabase.co/**',r=>r.abort());
 await page.addInitScript(()=>{window.fixtureManualMethod='cash';});
 await page.goto('/checks/browser-harness.html?route=/payment/A');
 await expect(page.getByRole('alert')).toContainText('This payment method is unavailable in this release');
 await expect(page.getByRole('button',{name:"I've made payment"})).toHaveCount(0);
 await expect(page.getByText('Synthetic Bank',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Payment Help'})).toBeVisible();
});
test('unavailable checkout offers keyboard retry and support while preserving the cart',async({page})=>{
 await page.route('**/*.supabase.co/**',r=>r.abort());
 await page.addInitScript(()=>{window.fixtureManualUnavailable=true;localStorage.setItem('ob_cart',JSON.stringify([{mealId:'synthetic-meal',vendorId:'fixture-vendor',vendorName:'Synthetic vendor',name:'Lunch',price:70,qty:1}]));});
 await page.setViewportSize({width:390,height:844});await page.goto('/checks/browser-harness.html?route=/checkout');
 const retry=page.getByRole('button',{name:'Check payment options again'});await expect(retry).toBeVisible();await retry.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
 await expect(page.getByRole('link',{name:'Contact support',exact:true})).toHaveAttribute('href','/help/contact');
 expect(await page.evaluate(()=>fixture.creates)).toBe(0);expect(await page.evaluate(()=>fixture.unknownRpcs)).toEqual([]);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ob_cart')).length)).toBe(1);
});
test('historical multi-vendor cart explains separate orders and retains all saved items',async({page})=>{
 await page.route('**/*.supabase.co/**',r=>r.abort());
 await page.addInitScript(()=>localStorage.setItem('ob_cart',JSON.stringify([1,2].map(n=>({mealId:'synthetic-'+n,vendorId:'vendor-'+n,vendorName:'Synthetic vendor '+n,name:'Lunch '+n,price:70,qty:1})))));
 await page.goto('/checks/browser-harness.html?route=/food/search');await page.getByRole('button',{name:'Cart',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Your cart'})).toBeVisible();
 await expect(page.getByText(/Complete one vendor order at a time/)).toBeVisible();
 await expect(page.getByText(/split automatically/)).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ob_cart')).length)).toBe(2);
});
