// Fresh in-memory PGlite only. Never use a native or externally selected client.
if (process.env.OFFICEBITES_LOCAL_NATIVE || process.env.PGLITE_MODULE) {
  throw new Error('Unset OFFICEBITES_LOCAL_NATIVE and PGLITE_MODULE; Phase B permits only fresh in-memory PGlite');
}
process.env.OFFICEBITES_PHASE_B = '1';
await import('./checkout-database.mjs');
