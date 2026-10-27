import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('diagnose missing local Supabase configuration without any hosted request', async ({ page }) => {
 test.setTimeout(30000);
 const requests=[];const warnings=[];
 page.on('console', message => { if(message.text().includes('Missing environment variables'))warnings.push(message.text()); });
 await page.route('**/*.supabase.co/**', route => {
  requests.push({host:new URL(route.request().url()).host,method:route.request().method()});
  return route.abort();
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('alert').filter({hasText:/Failed to fetch/})).toBeVisible();
 expect(requests.some(request=>request.host==='placeholder.supabase.co')).toBe(true);
 expect(warnings.some(warning=>warning.includes('VITE_SUPABASE_URL'))).toBe(true);
 await fs.mkdir('.officebites-local',{recursive:true});
 await fs.writeFile('.officebites-local/phase-d-fetch-diagnostic.json',JSON.stringify({outcome:'Reproduced configuration-related fetch failure; NOT resolved',network:'All Supabase requests aborted locally',requests,warnings},null,2));
});
