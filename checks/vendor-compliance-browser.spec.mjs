import { test, expect } from '@playwright/test';
test.setTimeout(45000);
async function open(page,{admin=false,legacy=false,ready=false,status='pending'}={}) {
 await page.route('**/*.supabase.co/**',route=>route.abort());
 await page.goto('/checks/browser-harness.html?route=/help/contact');await page.waitForFunction(()=>window.fixture?.authChanged);
 await page.evaluate(async options=>{
  fixture.compliance={admin:options.admin,vendor:{id:'fixture-vendor',name:'SYNTHETIC vendor',status:options.status,ownerId:'owner-A'},enrolled:!options.legacy,legacyException:options.legacy,ready:options.ready,workflow:options.ready?'ready for approval':'verification required',accepted:false,assignmentValid:false,events:{},submissions:[],bankProfiles:[],assignments:[],documents:[],history:[]};
  const user=options.admin?{id:'admin-A',name:'Admin A',role:'admin'}:{id:'owner-A',name:'Owner A',role:'vendor',vendorId:'fixture-vendor'};
  await fixture.setUser(user);fixture.navigate(options.admin?'/admin/vendors/fixture-vendor/compliance':'/vendor/compliance');
 },{admin,legacy,ready,status});
 await expect(page.getByRole('heading',{name:'Vendor compliance and approval',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Reload compliance and audit history'})).toBeEnabled();
}
const reason='SYNTHETIC independent review evidence reference only';
test('pending vendor privately uploads evidence and banking without selling privileges',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 await page.getByLabel('Evidence category',{exact:true}).selectOption('coa');
 await page.getByLabel('Document context / premises reference').fill('SYNTHETIC matching premises only');
 await page.getByLabel('Private evidence file').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('SYNTHETIC TEST ONLY')});
 await page.getByRole('button',{name:'Submit evidence for review',exact:true}).click();
 await expect(page.getByText(/Saved. Reloaded status/)).toBeVisible();
 const uploads=await page.evaluate(()=>fixture.complianceUploads);expect(uploads).toHaveLength(1);expect(uploads[0].options.upsert).toBe(false);
 await page.getByLabel('Account holder',{exact:true}).fill('Synthetic vendor');await page.getByLabel('Bank',{exact:true}).fill('Synthetic bank');
 await page.getByLabel('Account number',{exact:true}).fill('123456789');await page.getByLabel('Branch code',{exact:true}).fill('123456');await page.getByLabel('Account type',{exact:true}).fill('Current');
 await page.getByLabel('Account supports EFT',{exact:true}).check();await page.getByRole('button',{name:'Submit banking details',exact:true}).click();
 await expect(page.getByText(/pending independent approval/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Approve vendor after review'})).toHaveCount(0);
 expect(await page.evaluate(()=>fixture.compliance.vendor.status)).toBe('pending');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByText(/Certificate of Acceptability ·/).click();await page.getByRole('button',{name:'Get private evidence link'}).click();
 await expect(page.getByRole('link',{name:/Open evidence/})).toHaveAttribute('rel','noopener noreferrer');
 expect(await page.evaluate(()=>fixture.evidenceLink.seconds)).toBe(60);
 await page.screenshot({path:'.officebites-local/phase-d-vendor-mobile.png',fullPage:true});
});
test('admin assigns only approved scoped versions and retains assignment audit',async({page})=>{
 await open(page,{admin:true});
 await page.evaluate(()=>{fixture.compliance.documents=['vendor-agreement','vendor-fees','vendor-standards','privacy','refund-policy'].map(kind=>({id:'approved-'+kind,kind,title:'SYNTHETIC '+kind,version:'synthetic-v1',vendor_id:kind==='vendor-fees'?'fixture-vendor':null,content_hash:'a'.repeat(64),content:'SYNTHETIC APPROVED-SOURCE FIXTURE ONLY. Not live legal text.'}));fixture.compliance.documents.push({id:'other-schedule',kind:'vendor-fees',title:'Other vendor schedule',vendor_id:'other-vendor',content_hash:'b'.repeat(64)});});
 await page.getByRole('button',{name:'Reload compliance and audit history'}).click();
 await expect(page.getByRole('button',{name:'Assign approved versions',exact:true})).toBeDisabled();
 await page.getByLabel('Review reason / approval evidence').fill(reason);
 const labels={'Vendor Agreement':'vendor-agreement','Vendor-specific Commercial Schedule':'vendor-fees','Operating Standards':'vendor-standards','Privacy':'privacy','Refunds':'refund-policy'};
 for(const [label,kind] of Object.entries(labels))await page.getByLabel(label,{exact:true}).selectOption('approved-'+kind);
 await expect(page.getByLabel('Vendor-specific Commercial Schedule').getByRole('option',{name:'Other vendor schedule'})).toHaveCount(0);
 await page.getByLabel('Notice delivered at (SAST)').fill('2026-10-26T08:00');await page.getByLabel('Effective at (SAST)').fill('2026-10-26T09:00');
 await page.getByRole('button',{name:'Assign approved versions',exact:true}).click();
 await expect(page.getByText('awaiting vendor acceptance',{exact:true})).toBeVisible();
 const call=await page.evaluate(()=>fixture.complianceCalls[0]);expect(call.p_value.schedule).toBe('approved-vendor-fees');expect(call.p_value).not.toHaveProperty('approved_by');expect(call.p_value).not.toHaveProperty('created_at');
 await expect(page.getByText(/Reviewer \/ actor: admin-A/)).toBeVisible();
});
test('approval is disabled until server readiness and independent review',async({page})=>{
 await open(page,{admin:true});await page.getByLabel('Review reason / approval evidence').fill(reason);
 const approve=page.getByRole('button',{name:'Approve vendor after review',exact:true});await expect(approve).toBeDisabled();
 await page.getByRole('button',{name:'Complete activation review',exact:true}).click();
 await page.getByLabel('Review reason / approval evidence').fill(reason);await expect(approve).toBeEnabled();await approve.click();
 await expect(page.getByText('approved',{exact:true})).toHaveCount(2);
 expect(await page.evaluate(()=>fixture.complianceCalls.map(call=>call.p_action))).toEqual(['complete_review','activate']);
});
test('existing-vendor exception requires explicit acknowledgement and enrollment confirmation',async({page})=>{
 await open(page,{admin:true,legacy:true});await expect(page.getByText(/Existing-vendor transition exception:/)).toBeVisible();
 await page.getByLabel('Review reason / approval evidence').fill(reason);await expect(page.getByRole('button',{name:'Approve vendor after review'})).toBeDisabled();
 const acknowledge=page.getByRole('checkbox',{name:/explicitly acknowledge/});await acknowledge.focus();await page.keyboard.press('Space');
 await expect(page.getByRole('button',{name:'Approve vendor after review'})).toBeEnabled();
 await expect(page.getByRole('button',{name:'Enroll in strict compliance review'})).toBeDisabled();
 await page.getByRole('checkbox',{name:/understand strict enrollment/}).check();await page.getByRole('button',{name:'Enroll in strict compliance review'}).click();
 await expect(page.getByText(/Existing-vendor transition exception:/)).toHaveCount(0);
 expect(await page.evaluate(()=>fixture.complianceCalls[0].p_value.confirm)).toBe(true);
});
test('expired and revoked evidence is visible and cannot be presented as ready',async({page})=>{
 await open(page,{admin:true,status:'approved'});
 await page.evaluate(()=>{fixture.compliance.events.identity={status:'revoked'};fixture.compliance.events.coa={status:'verified',valid_until:'2020-01-01T00:00:00Z'};});
 await page.getByRole('button',{name:'Reload compliance and audit history'}).click();
 await expect(page.getByRole('alert').filter({hasText:/New orders are blocked/})).toBeVisible();
 await expect(page.getByText('expired',{exact:true})).toBeVisible();await expect(page.getByText('revoked',{exact:true})).toBeVisible();
});
test('uncertain mutation blocks resubmission until read-only reload',async({page})=>{
 await open(page,{admin:true,ready:true});await page.getByLabel('Review reason / approval evidence').fill(reason);
 await page.evaluate(()=>{fixture.complianceReject=true;});await page.getByRole('button',{name:'Approve vendor after review'}).click();
 await expect(page.getByRole('alert').filter({hasText:/Reload status and audit history/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Approve vendor after review'})).toBeDisabled();
 await page.evaluate(()=>{fixture.complianceReject=false;});await page.getByRole('button',{name:'Reload compliance and audit history'}).click();
 expect(await page.evaluate(()=>fixture.complianceCalls.length)).toBe(1);
});
test('admin account switch ignores delayed write responses and clears evidence view',async({page})=>{
 await open(page,{admin:true,ready:true});await page.getByLabel('Review reason / approval evidence').fill(reason);
 await page.evaluate(()=>{fixture.deferComplianceAction=true;});await page.getByRole('button',{name:'Approve vendor after review'}).click();
 await page.waitForFunction(()=>fixture.resolveComplianceAction);
 await page.evaluate(async()=>{fixture.compliance.history=[];fixture.compliance.vendor.name='New admin context';await fixture.setUser({id:'admin-B',name:'Admin B',role:'admin'});fixture.resolveComplianceAction();});
 await expect(page.getByRole('heading',{name:'New admin context',exact:true})).toBeVisible();await expect(page.getByText(/Reviewer \/ actor: admin-A/)).toHaveCount(0);
 await expect(page.getByText(/Saved. Reloaded status/)).toHaveCount(0);
});

test('offline review disables writes and reconnect requires current server state',async({page,context})=>{
 await open(page,{admin:true,ready:true});await page.getByLabel('Review reason / approval evidence').fill(reason);
 await context.setOffline(true);await expect(page.getByText(/You are offline. Reconnect/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Approve vendor after review',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>fixture.complianceCalls || [])).toHaveLength(0);
 await context.setOffline(false);await expect(page.getByRole('button',{name:'Reload compliance and audit history'})).toBeEnabled();
 expect(await page.evaluate(()=>fixture.complianceCalls || [])).toHaveLength(0);
});