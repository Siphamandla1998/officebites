// Fresh in-process PGlite only; this runner accepts no external database adapter.
if(process.env.OFFICEBITES_LOCAL_NATIVE || process.env.PGLITE_MODULE)throw Error('Only bundled disposable PGlite permitted');
process.env.OFFICEBITES_SETTINGS_FIX='1';
process.env.OFFICEBITES_EFT_PACKAGE='1';
await import('./checkout-database.mjs');
