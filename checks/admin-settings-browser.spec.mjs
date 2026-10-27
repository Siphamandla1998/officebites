import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', r => r.abort());
  await page.goto('/checks/browser-harness.html?route=/help/contact');
  await page.waitForFunction(() => window.fixture?.authChanged);
  await page.evaluate(async () => {
    fixture.manualSettings = { eft_enabled: false, payshap_enabled: false, deadline_minutes: 15, review_threshold: 500, settings_revision: 'fixture-revision-0' };
    await fixture.setUser({ id: 'synthetic-settings-admin', role: 'admin', name: 'Synthetic admin' });
    fixture.navigate('/admin/payments');
  });
  await expect(page.getByRole('form', { name: 'Manual checkout controls' })).toBeVisible();
});
const form = page => page.getByRole('form', { name: 'Manual checkout controls' });
const threshold = page => form(page).getByLabel('Admin review threshold (ZAR)');
const reason = page => form(page).getByLabel('Change reason');
const save = page => form(page).getByRole('button', { name: 'Save manual settings' });
const reload = page => form(page).getByRole('button', { name: 'Reload settings (no save)' });
const edit = async page => { await threshold(page).fill('600'); await reason(page).fill('Synthetic controlled settings change'); };
const calls = page => page.evaluate(() => fixture.settingsCalls?.length || 0);

test('unchanged settings cannot submit; successful save clears reason and updates confirmed state', async ({ page }) => {
  await reason(page).fill('Synthetic unchanged operation'); await expect(save(page)).toBeDisabled();
  await edit(page); await save(page).click();
  await expect(form(page).getByText('Save and reload succeeded.', { exact: true })).toBeVisible();
  await expect(reason(page)).toHaveValue(''); await expect(save(page)).toBeDisabled();
  await expect(form(page).getByText(/Last confirmed:.*R600/)).toBeVisible();
  expect(await calls(page)).toBe(1);
});

test('rapid duplicate submission and pending reload lock editable controls', async ({ page }) => {
  await edit(page); await page.evaluate(() => { fixture.deferSettings = true; fixture.deferManualWorkspace = true; });
  await form(page).evaluate(el => { el.requestSubmit(); el.requestSubmit(); });
  await expect(threshold(page)).toBeDisabled(); await expect(reason(page)).toBeDisabled();
  await expect(form(page).getByLabel('EFT available for approved profiles')).toBeDisabled();
  expect(await calls(page)).toBe(1);
  await page.evaluate(() => fixture.releaseSettings());
  await page.waitForFunction(() => fixture.releaseManualWorkspace);
  await expect(threshold(page)).toBeDisabled(); await expect(reload(page)).toBeDisabled();
  await page.evaluate(() => { fixture.deferManualWorkspace = false; fixture.releaseManualWorkspace(); });
  await expect(reason(page)).toHaveValue(''); await expect(threshold(page)).toBeEnabled();
  expect(await calls(page)).toBe(1);
});

test('save error retains reason and draft; reload reconciles without mutation retry', async ({ page }) => {
  await edit(page); await page.evaluate(() => fixture.failSettings = true); await save(page).click();
  await expect(form(page).getByRole('status')).toContainText('Save failed or its outcome could not be confirmed');
  await expect(reason(page)).toHaveValue('Synthetic controlled settings change');
  await expect(threshold(page)).toHaveValue('600'); await expect(save(page)).toBeDisabled();
  await reload(page).click(); await expect(threshold(page)).toBeEnabled();
  await expect(threshold(page)).toHaveValue('600'); expect(await calls(page)).toBe(1);
  await expect(form(page).getByText(/Last confirmed:.*R500/)).toBeVisible();
});

test('committed save plus reload failure is explicit and blocks resubmission until read-only recovery', async ({ page }) => {
  await edit(page); await page.evaluate(() => fixture.failManualWorkspace = true); await save(page).click();
  await expect(form(page).getByRole('status')).toContainText('Save succeeded but settings reload failed');
  await expect(reason(page)).toHaveValue(''); await expect(save(page)).toBeDisabled();
  await expect(form(page).getByText(/Last confirmed:.*R500/)).toBeVisible();
  await reload(page).click(); await expect(form(page).getByRole('status')).toContainText('Settings reload failed');
  await expect(threshold(page)).toHaveValue('600'); expect(await calls(page)).toBe(1);
  await page.evaluate(() => fixture.failManualWorkspace = false); await reload(page).click();
  await expect(form(page).getByText(/Last confirmed:.*R600/)).toBeVisible();
  await expect(save(page)).toBeDisabled(); expect(await calls(page)).toBe(1);
});

test('fresh server state synchronises clean form but preserves dirty draft with conflict', async ({ page }) => {
  await page.evaluate(() => fixture.manualSettings.review_threshold = 550); await reload(page).click();
  await expect(threshold(page)).toHaveValue('550');
  await edit(page); await page.evaluate(() => fixture.manualSettings.review_threshold = 700); await reload(page).click();
  await expect(threshold(page)).toHaveValue('600'); await expect(form(page).getByRole('alert')).toContainText('Server settings changed');
  await expect(save(page)).toBeDisabled(); await expect(form(page).getByText(/Last confirmed:.*R700/)).toBeVisible();
  await reload(page).click(); await expect(save(page)).toBeDisabled(); await expect(form(page).getByRole('alert')).toBeVisible();
  await form(page).getByRole('button', { name: 'Discard draft and use latest settings' }).click();
  await expect(threshold(page)).toHaveValue('700'); await expect(reason(page)).toHaveValue(''); expect(await calls(page)).toBe(0);
});

test('failed read preserves local edits and confirmed baseline; recovery does not silently replace draft', async ({ page }) => {
  await edit(page); await page.evaluate(() => fixture.failManualWorkspace = true); await reload(page).click();
  await expect(threshold(page)).toHaveValue('600'); await expect(reason(page)).toHaveValue('Synthetic controlled settings change');
  await expect(form(page).getByText(/Last confirmed:.*R500/)).toBeVisible(); await expect(save(page)).toBeDisabled();
  await page.evaluate(() => { fixture.failManualWorkspace = false; fixture.manualSettings.review_threshold = 800; }); await reload(page).click();
  await expect(threshold(page)).toHaveValue('600'); await expect(form(page).getByRole('alert')).toBeVisible(); expect(await calls(page)).toBe(0);
});

for (const width of [390, 1440]) test(`settings form keyboard and layout review at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await edit(page);
  await expect(form(page).getByLabel('Payment deadline (minutes)')).toHaveValue('15');
  await expect(form(page).getByLabel('Registered ShapID')).toHaveCount(0);
  await save(page).focus(); await expect(save(page)).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const input of await form(page).locator('input,button').all()) {
    const box = await input.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
  fs.mkdirSync('.officebites-local/admin-settings-review', { recursive: true });
  await form(page).evaluate(el => window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - 80)));
  await form(page).screenshot({ path: `.officebites-local/admin-settings-review/form-${width}.png` });
  await page.keyboard.press('Enter');
  await expect(form(page).getByRole('status')).toHaveText('Save and reload succeeded.');
  await expect(reason(page)).toHaveValue(''); expect(await calls(page)).toBe(1);
});

test('permission failure gives a safe actionable explanation instead of hiding the RPC error',async({page})=>{
 await edit(page);await page.evaluate(()=>{fixture.settingsError={code:'42501',message:'private.internal SQL diagnostic'};});
 await save(page).click();await expect(form(page).getByRole('status')).toContainText('active administrator');
 await expect(form(page)).not.toContainText('private.internal');expect(await calls(page)).toBe(1);
});
test('server change before save rejects stale revision without overwriting the newer settings',async({page})=>{
 await edit(page);await page.evaluate(()=>{fixture.manualSettings.review_threshold=800;fixture.manualSettings.settings_revision='newer-revision';});
 await save(page).click();await expect(form(page).getByRole('status')).toContainText('changed');
 expect(await page.evaluate(()=>fixture.manualSettings.review_threshold)).toBe(800);
 await reload(page).click();await expect(form(page).getByRole('alert')).toContainText('Server settings changed');
});

test('missing checked settings backend is explicit and cannot fall back to a write',async({page})=>{
 await page.evaluate(()=>{delete fixture.manualSettings.settings_revision;});await reload(page).click();await edit(page);
 await expect(form(page).getByRole('alert')).toContainText('not installed');await expect(save(page)).toBeDisabled();expect(await calls(page)).toBe(0);
});
test('offline save cannot submit',async({page,context})=>{
 await edit(page);await context.setOffline(true);await expect(save(page)).toBeDisabled();await expect(form(page).getByRole('alert')).toContainText('Offline');expect(await calls(page)).toBe(0);
});
test('account switch clears prior admin busy state and late completion cannot replace the new form',async({page})=>{
 await edit(page);await page.evaluate(()=>fixture.deferSettings=true);await save(page).click();await expect(save(page)).toBeDisabled();
 await page.evaluate(async()=>{await fixture.setUser({id:'second-synthetic-settings-admin',role:'admin'});});
 await expect(threshold(page)).toBeEnabled();await page.evaluate(()=>{fixture.deferSettings=false;fixture.releaseSettings();});
 await expect(form(page).getByText('Save and reload succeeded.',{exact:true})).toHaveCount(0);
});
