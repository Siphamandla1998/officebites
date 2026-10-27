if (process.env.OFFICEBITES_LOCAL_NATIVE || process.env.PGLITE_MODULE) throw new Error('Phase E requires fresh disposable in-memory PGlite');
for (const phase of ['B','C','D','E']) process.env['OFFICEBITES_PHASE_'+phase]='1';
await import('./checkout-database.mjs');