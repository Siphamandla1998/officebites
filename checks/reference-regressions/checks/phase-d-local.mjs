if (process.env.OFFICEBITES_LOCAL_NATIVE || process.env.PGLITE_MODULE) throw new Error('Phase D requires fresh in-memory PGlite only');
process.env.OFFICEBITES_PHASE_B='1';
process.env.OFFICEBITES_PHASE_C='1';
process.env.OFFICEBITES_PHASE_D='1';
await import('./checkout-database.mjs');
