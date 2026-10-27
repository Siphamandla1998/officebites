// Native/hosted connections and alternate clients are deliberately unsupported.
if (process.env.OFFICEBITES_LOCAL_NATIVE || process.env.PGLITE_MODULE) {
  throw new Error('Phase C permits only the fresh in-memory PGlite fixture');
}
process.env.OFFICEBITES_PHASE_B = '1';
process.env.OFFICEBITES_PHASE_C = '1';
await import('./checkout-database.mjs');
