import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.route('**/*.supabase.co/**',r=>r.abort());
 await page.goto('/checks/browser-harness.html?route=/help/contact');
 await page.waitForFunction(()=>window.fixture?.authChanged);
});
test('vendor submits synthetic EFT and PayShap profile and requests a new pending version',async({page})=>{
 await page.evaluate(async()=>{await fixture.setUser({id:'synthetic-vendor-owner',role:'vendor',vendorId:'fixture-vendor'});fixture.navigate('/vendor/settings');});
 const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Vendor-direct payments',exact:true})});
 for(const [label,value] of Object.entries({'Account holder':'Synthetic non-delivering recipient','Bank':'Synthetic bank — no transfers','Account number':'0000000000','Account type':'Synthetic','Branch code':'000000','Registered ShapID':'synthetic@bank.invalid'}))await section.getByLabel(label,{exact:true}).fill(value);
 await section.getByLabel('Account supports EFT',{exact:true}).check();
 await section.getByLabel('Registered ShapID supports receiving PayShap',{exact:true}).check();
 await section.getByRole('button',{name:'Submit for independent approval'}).click();
 await expect(section.getByText('Saved and reloaded.',{exact:true})).toBeVisible();
 await section.getByText('Payment profile versions (1)',{exact:true}).click();
 await expect(section.getByText(/Pending verification/)).toBeVisible();
 await section.getByLabel('Registered ShapID',{exact:true}).fill('updated-synthetic@bank.invalid');
 await section.getByRole('button',{name:'Submit for independent approval'}).click();
 await expect(section.getByText('Payment profile versions (2)',{exact:true})).toBeVisible();
 const profiles=await page.evaluate(()=>fixture.paymentProfiles);
 expect(profiles).toHaveLength(2);expect(profiles.every(p=>!p.approved_at&&p.eft&&p.payshap)).toBe(true);
 expect(profiles[0].destination.shapId).toBe('synthetic@bank.invalid');
 expect(profiles[1].destination.shapId).toBe('updated-synthetic@bank.invalid');
});
test('admin profile review requires evidence and reloads approved status locally',async({page})=>{
 await page.evaluate(async()=>{fixture.paymentProfiles=[{id:'synthetic-pending-profile',vendor_id:'fixture-vendor',created_at:'2026-10-21T10:00:00Z',approved_at:null,destination:{accountHolder:'Synthetic recipient',bank:'Synthetic bank',shapId:'synthetic@bank.invalid'}}];await fixture.setUser({id:'synthetic-independent-admin',role:'admin'});fixture.navigate('/admin/payments');});
 await page.getByText('Payment profile versions (1)',{exact:true}).click();
 const button=page.getByRole('button',{name:'Approve verified profile'});
 await button.click();expect(await page.evaluate(()=>fixture.profileApprovals?.length||0)).toBe(0);
 await page.getByLabel('Independent ownership, recipient and receiving-capability evidence').fill('Synthetic local review only; independent recipient verification fixture');
 await button.click();await expect(page.getByText(/Version synthetic-pending-profile.*Approved/)).toBeVisible();
 expect(await page.evaluate(()=>fixture.profileApprovals.length)).toBe(1);
 await expect(button).toHaveCount(0);
});
