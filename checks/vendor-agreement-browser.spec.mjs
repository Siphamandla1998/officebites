import { test, expect } from '@playwright/test';
test.setTimeout(45000);
const owner = { id: 'synthetic-owner-A', name: 'Synthetic owner', role: 'vendor', vendorId: 'fixture-vendor' };
async function setup(page, { enabled = true, assigned = true } = {}) {
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto('/checks/browser-harness.html?route=/help/contact');
  await page.waitForFunction(() => window.fixture?.authChanged);
  await page.evaluate(({ owner, enabled, assigned }) => {
    const documents = Object.fromEntries(['vendor-agreement', 'vendor-fees', 'vendor-standards', 'privacy', 'refund-policy'].map(kind => [kind, {
      id: `synthetic-${kind}`, version: 'synthetic-v1', content_hash: 'a'.repeat(64), title: `SYNTHETIC ${kind}`,
      content: `SYNTHETIC TEST ONLY ${kind}. Full approved-source fixture text.\n` + 'Readable agreement text. '.repeat(100),
    }]));
    fixture.agreement = { vendorId: owner.vendorId, enabled, businessReady: true, assignment: assigned ? { id: 'synthetic-assignment', effectiveAt: '2026-10-26T08:00:00Z', changeBasis: 'initial', documents } : null,
      requiresAcceptance: assigned, accepted: false, history: [], vendorStatus: 'pending' };
    return fixture.setUser(owner).then(() => fixture.navigate('/vendor/agreement'));
  }, { owner, enabled, assigned });
  await expect(page.getByRole('heading', { name: 'Vendor Agreement', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload agreement and records' })).toBeEnabled();
}
test('mobile keyboard review, unchecked assent, narrow payload and retained receipt', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  const checkbox = page.getByRole('checkbox', { name: /I have read, understand and agree/ });
  const accept = page.getByRole('button', { name: 'Accept & Continue', exact: true });
  await expect(checkbox).not.toBeChecked(); await expect(accept).toBeDisabled();
  for (const name of ['Vendor Agreement', 'Commercial Fee Schedule', 'Vendor Operating Standards', 'Privacy', 'Refunds']) {
    const region = page.getByRole('region', { name: `${name} full text`, exact: true });
    await expect(region).toBeVisible(); await region.focus(); await expect(region).toBeFocused();
    await page.keyboard.press('PageDown');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await checkbox.focus(); await page.keyboard.press('Space'); await expect(checkbox).toBeChecked();
  await page.keyboard.press('Tab'); await expect(accept).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.getByText(/Your agreement acceptance is saved/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept & Continue', exact: true })).toHaveCount(0);
  const calls = await page.evaluate(() => fixture.agreementCalls);
  expect(calls).toEqual([{ p_assignment: 'synthetic-assignment', p_acknowledged: true }]);
  await page.getByText(/Agreement accepted ·/).click();
  await expect(page.getByText(/Receipt: synthetic-agreement-receipt/)).toBeVisible();
  await expect(page.getByText(/does not activate your store/)).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const printed = await page.getByRole('region', { name: 'Vendor Agreement full text', exact: true }).first().evaluate(element => getComputedStyle(element).maxHeight);
  expect(printed).toBe('none');
  await page.emulateMedia({ media: 'screen' });
  await page.screenshot({ path: '.officebites-local/phase-c-mobile.png', fullPage: true });
});
test('rollout off and missing assigned documents never solicit acceptance', async ({ page }) => {
  await setup(page, { enabled: false });
  await expect(page.getByText(/Agreement acceptance is not yet open/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept & Continue', exact: true })).toBeDisabled();
  await page.evaluate(() => { fixture.agreement.assignment = null; fixture.agreement.requiresAcceptance = false; });
  await page.getByRole('button', { name: 'Reload agreement and records' }).click();
  await expect(page.getByText(/approved vendor-specific agreement is not available/)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /I have read/ })).toHaveCount(0);
});
test('offline cannot accept and reconnect requires a fresh unchecked review', async ({ page }) => {
  await setup(page);
  const checkbox = page.getByRole('checkbox', { name: /I have read/ }); await checkbox.check();
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByRole('button', { name: 'Accept & Continue', exact: true })).toBeDisabled();
  await expect(page.getByText(/Acceptance is never queued offline/)).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(checkbox).not.toBeChecked();
  expect(await page.evaluate(() => fixture.agreementCalls?.length || 0)).toBe(0);
});
test('stale version requires reload and fresh acknowledgement', async ({ page }) => {
  await setup(page); await page.getByRole('checkbox', { name: /I have read/ }).check();
  await page.evaluate(() => { fixture.agreement.assignment.id = 'synthetic-updated'; });
  await page.getByRole('button', { name: 'Accept & Continue', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /agreement has changed/ })).toBeVisible();
  await page.getByRole('button', { name: 'Reload agreement and records' }).click();
  await expect(page.getByRole('checkbox', { name: /I have read/ })).not.toBeChecked();
});
test('lost response recovers saved receipt instead of assuming failure or double acceptance', async ({ page }) => {
  await setup(page); await page.evaluate(() => { fixture.agreementLostResponse = true; });
  await page.getByRole('checkbox', { name: /I have read/ }).check();
  await page.getByRole('button', { name: 'Accept & Continue', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /saved acceptance/ })).toBeVisible();
  await page.getByRole('button', { name: 'Reload agreement and records' }).click();
  await expect(page.getByText(/Your acceptance of these versions is recorded/)).toBeVisible();
  expect(await page.evaluate(() => fixture.agreementCalls.length)).toBe(1);
});
test('switching accounts hides previous documents and ignores delayed acceptance', async ({ page }) => {
  await setup(page); await page.evaluate(() => { fixture.deferAgreementAccept = true; });
  await page.getByRole('checkbox', { name: /I have read/ }).check();
  await page.getByRole('button', { name: 'Accept & Continue', exact: true }).click();
  await page.waitForFunction(() => fixture.resolveAgreementAccept);
  await page.evaluate(async () => {
    fixture.agreement = { vendorId: 'vendor-B', enabled: false, assignment: null, history: [], requiresAcceptance: false };
    await fixture.setUser({ id: 'owner-B', name: 'Owner B', role: 'vendor', vendorId: 'vendor-B' });
    fixture.resolveAgreementAccept();
  });
  await expect(page.getByText(/approved vendor-specific agreement is not available/)).toBeVisible();
  await expect(page.getByText(/Your agreement acceptance is saved/)).toHaveCount(0);
  await expect(page.getByText(/synthetic-agreement-receipt/)).toHaveCount(0);
});
test('vendor registration proceeds to authenticated agreement review with no automatic assent', async ({ page }) => {
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.goto('/checks/browser-harness.html?route=/register');
  await page.waitForFunction(() => window.fixture?.authChanged);
  await page.getByLabel('I want to join as a').selectOption('vendor');
  await page.getByLabel('Your name', { exact: true }).fill('Synthetic applicant');
  await page.getByLabel('Business name', { exact: true }).fill('Synthetic meals');
  await page.getByLabel('What type of food do you sell?').selectOption('Bakery');
  await page.getByLabel('Email address', { exact: true }).fill('applicant@test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123');
  await page.getByRole('button', { name: 'Create vendor account', exact: true }).click();
  await expect(page).toHaveURL(/\/vendor\/agreement$/);
  expect(await page.evaluate(() => fixture.registration.vendorConsent)).toBeNull();
  expect(await page.evaluate(() => fixture.agreementCalls?.length || 0)).toBe(0);
});

test('incomplete disclosures block acceptance even with published documents', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { fixture.agreement.businessReady = false; });
  await page.getByRole('button', { name: 'Reload agreement and records' }).click();
  await expect(page.getByText(/Company disclosures are awaiting approval/)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /I have read/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Accept & Continue', exact: true })).toBeDisabled();
});
test('informational update shows saved records without another acceptance', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    fixture.agreement.requiresAcceptance = false;
    fixture.agreement.assignment.changeBasis = 'informational';
    fixture.agreement.history = [{ id: 'earlier-receipt', actor_id: fixture.user.id, documents: fixture.agreement.assignment.documents,
      accepted_at: '2026-10-25T10:00:00Z', method: 'application', acknowledgements: Array(8).fill(true) }];
  });
  await page.getByRole('button', { name: 'Reload agreement and records' }).click();
  await expect(page.getByText(/This update does not require another acceptance/)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /I have read/ })).toHaveCount(0);
  await page.getByText(/Earlier consent record ·/).click();
  await expect(page.getByText(/Earlier application acknowledgements are retained/)).toBeVisible();
});
test('email confirmation sign-in returns the vendor to agreement review', async ({ page }) => {
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.goto('/checks/browser-harness.html?route=/register');
  await page.waitForFunction(() => window.fixture?.authChanged);
  await page.evaluate(() => { fixture.confirmVendorEmail = true; });
  await page.getByLabel('I want to join as a').selectOption('vendor');
  await page.getByLabel('Your name', { exact: true }).fill('Synthetic applicant');
  await page.getByLabel('Business name', { exact: true }).fill('Synthetic meals');
  await page.getByLabel('What type of food do you sell?').selectOption('Bakery');
  await page.getByLabel('Email address', { exact: true }).fill('applicant@test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123');
  await page.getByRole('button', { name: 'Create vendor account', exact: true }).click();
  await expect(page.getByText('Check your inbox', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Go to sign in' }).click();
  await page.getByLabel(/Email/, { exact: false }).fill('applicant@test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/vendor\/agreement$/);
  await expect(page.getByText(/approved vendor-specific agreement is not available/)).toBeVisible();
});
test('existing customer application continues to review without activation or assent', async ({ page }) => {
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.goto('/checks/browser-harness.html?route=/help/contact');
  await page.waitForFunction(() => window.fixture?.authChanged);
  await page.evaluate(async () => {
    await fixture.setUser({ id: 'existing-customer', role: 'customer', name: 'Customer' });
    fixture.navigate('/become-a-vendor');
  });
  await page.getByLabel('Business name', { exact: true }).fill('Synthetic bakery');
  await page.getByLabel('What type of food do you sell?').selectOption('Bakery');
  await page.getByRole('button', { name: 'Submit vendor application', exact: true }).click();
  await expect(page).toHaveURL(/\/vendor\/agreement$/);
  expect(await page.evaluate(() => fixture.vendorApplication.vendorConsent)).toBeNull();
  expect(await page.evaluate(() => fixture.agreementCalls?.length || 0)).toBe(0);
});

test('stalled response times out and recovers the server receipt without resubmission', async ({ page }) => {
  await setup(page);
  await page.clock.install();
  await page.evaluate(() => { fixture.deferAgreementAccept = true; });
  await page.getByRole('checkbox', { name: /I have read/ }).check();
  await page.getByRole('button', { name: 'Accept & Continue', exact: true }).click();
  await page.waitForFunction(() => fixture.resolveAgreementAccept);
  await page.clock.fastForward(21000);
  await expect(page.getByRole('alert').filter({ hasText: /request timed out/ })).toBeVisible();
  await page.getByRole('button', { name: 'Reload agreement and records' }).click();
  await expect(page.getByText(/Your acceptance of these versions is recorded/)).toBeVisible();
  await page.evaluate(() => fixture.resolveAgreementAccept());
  expect(await page.evaluate(() => fixture.agreementCalls.length)).toBe(1);
});
