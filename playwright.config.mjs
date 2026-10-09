import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './checks', testMatch: 'recovery-browser.spec.mjs',
  workers: 1, timeout: 180000, expect: { timeout: 60000 },
  use: {
    baseURL: 'http://127.0.0.1:5176',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true, acceptDownloads: true,
    launchOptions: process.env.PLAYWRIGHT_DISABLE_GPU ? { args: ['--disable-gpu'] } : {}, trace: process.env.PLAYWRIGHT_TRACE ? 'retain-on-failure' : 'off', screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --config checks/vite.browser.config.mjs --configLoader native --host 127.0.0.1 --port 5176 --strictPort',
    url: 'http://127.0.0.1:5176/checks/browser-harness.html',
    reuseExistingServer: false, timeout: 120000,
  },
  reporter: 'list',
});
