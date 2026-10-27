-- READ ONLY psql script; produces only count/content fingerprints, no row records.
-- Use the exported-snapshot source session; restored copy uses READ ONLY transaction.
-- Hashing large tables can be expensive. Use only during an approved bounded export.
-- Exclude inherited parent row duplication with ONLY; include every actual table.
SELECT format(
 'SELECT jsonb_build_object(''kind'',''table'',''schema'',%L,''name'',%L,''count'',count(*),''digest'',md5(coalesce(string_agg(md5(to_jsonb(t)::text),E''\n'' ORDER BY md5(to_jsonb(t)::text)),''''))) FROM ONLY %I.%I t;',
 n.nspname,c.relname,n.nspname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN('public','private','auth','storage','supabase_migrations')
 AND c.relkind IN('r','p') ORDER BY n.nspname,c.relname
\gexec
SELECT format(
 'SELECT jsonb_build_object(''kind'',''sequence'',''schema'',%L,''name'',%L,''last_value'',last_value,''is_called'',is_called) FROM %I.%I;',
 n.nspname,c.relname,n.nspname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN('public','private','auth','storage','supabase_migrations')
 AND c.relkind='S' ORDER BY n.nspname,c.relname
\gexec
-- Permission failure, timeouts, omitted tables or different digests are a STOP.
-- MD5 is a deterministic recovery comparison; archive integrity uses SHA-256.
