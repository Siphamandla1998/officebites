// In-process disposable PostgreSQL only; accepts no database URL or external adapter.
if(process.env.OFFICEBITES_LOCAL_NATIVE || process.env.PGLITE_MODULE)throw Error('Only bundled in-process PGlite permitted');
process.env.OFFICEBITES_EFT_PACKAGE='1';
await import('./checkout-database.mjs');
