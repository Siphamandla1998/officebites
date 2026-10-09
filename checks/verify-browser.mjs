import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const temporary = path.resolve('.officebites-local/browser-temp');
fs.mkdirSync(temporary, {recursive:true});
const env = {...process.env, TEMP:temporary, TMP:temporary, TMPDIR:temporary};
for (const args of [
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'checks/vite.browser.config.mjs', '--configLoader', 'native'],
  ['node_modules/playwright/cli.js', 'test', ...process.argv.slice(2)],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
