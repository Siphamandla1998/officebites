-- READ ONLY psql capture in the SAME exported snapshot as the archive.
-- All non-system table/sequence schemas, including Vault and managed schemas.
-- Permission errors or any omitted required relation are a STOP, not an exclusion.
SELECT format(
 'SELECT jsonb_build_object(''kind'',''table'',''schema'',%L,''name'',%L,''count'',count(*),''digest'',md5(coalesce(string_agg(md5(to_jsonb(t)::text),E''\n'' ORDER BY md5(to_jsonb(t)::text)),''''))) FROM ONLY %I.%I t;',
 n.nspname,c.relname,n.nspname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
 AND c.relkind IN('r','p') ORDER BY n.nspname,c.relname
\gexec
SELECT format(
 'SELECT jsonb_build_object(''kind'',''sequence'',''schema'',%L,''name'',%L,''last_value'',last_value,''is_called'',is_called) FROM %I.%I;',
 n.nspname,c.relname,n.nspname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
 AND c.relkind='S' ORDER BY n.nspname,c.relname
\gexec
