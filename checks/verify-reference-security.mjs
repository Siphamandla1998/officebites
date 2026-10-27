// Reference compatibility only: this does NOT rehearse a production installer.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.env.OFFICEBITES_LOCAL_NATIVE || process.env.PGLITE_MODULE || process.env.OFFICEBITES_INSTALL_PACKAGE) {
  throw new Error('Only a newly constructed in-memory PGlite fixture is permitted');
}
const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.join(root, 'reference-regressions'));
for (const phase of ['B', 'C', 'D', 'E']) process.env['OFFICEBITES_PHASE_' + phase] = '1';
console.log('REFERENCE FIXTURE ONLY: synthetic staging foundations, not the production schema or installation package.');
await import('./reference-regressions/checks/checkout-database.mjs');
