import { spawnSync } from 'node:child_process';
const run = (file, timezone) => {
  console.log('\nCHECK', file, timezone || 'system timezone');
  const result = spawnSync(process.execPath, [file], {
    stdio: 'inherit',
    env: { ...process.env, ...(timezone ? { TZ: timezone } : {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
for (const file of ['recovery-scope.mjs', 'recovery-runtime.mjs', 'launch-database.mjs', 'support-service.mjs', 'auth-race.cjs']) run('checks/' + file);
for (const timezone of ['Africa/Johannesburg', 'UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
  for (const file of ['order-rules.mjs', 'catalogue-filters.mjs', 'launch-frontend.mjs']) run('checks/' + file, timezone);
}
console.log('\nAll local regression checks passed; browser and hosted verification are separate.');
