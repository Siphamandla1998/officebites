if(process.env.OFFICEBITES_LOCAL_NATIVE || process.env.PGLITE_MODULE || process.env.OFFICEBITES_INSTALL_PACKAGE) throw new Error('Fresh in-memory fixture only');
process.env.OFFICEBITES_LAUNCH_GUARDS='1';
await import('./verify-reference-security.mjs');

if(process.env.OFFICEBITES_LAUNCH_GUARDS_VERIFIED!=='1') throw new Error('Launch guard assertions did not complete');
