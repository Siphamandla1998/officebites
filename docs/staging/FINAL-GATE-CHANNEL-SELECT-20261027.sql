-- SELECT-only metadata query executed against staging eyhmarmekioovcjibcbr.
-- No notification, subscription, channel broadcast or application RPC invocation.
SELECT jsonb_build_object(
'observed_utc',clock_timestamp(),
'realtime_publications',(SELECT jsonb_agg(jsonb_build_object('publication',pubname,'schema',schemaname,'table',tablename) ORDER BY pubname,schemaname,tablename) FROM pg_publication_tables WHERE pubname LIKE '%realtime%'),
'channel_functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'definition_md5',md5(pg_get_functiondef(p.oid)),'http_call_syntax',pg_get_functiondef(p.oid) ~* '(net[.]http|http_post|http_get|http_request)','notification_syntax',pg_get_functiondef(p.oid) ~* '(insert[[:space:]]+into[[:space:]]+(public[.])?notifications|pg_notify|realtime[.](send|broadcast_changes))') ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private') AND p.prokind='f' AND pg_get_functiondef(p.oid) ~* '(net[.]http|http_post|http_get|http_request|notifications|pg_notify|realtime[.](send|broadcast_changes)|send_email|send_sms)'),
'event_triggers',(SELECT jsonb_agg(jsonb_build_object('name',evtname,'event',evtevent,'enabled',evtenabled,'function',evtfoid::regprocedure::text)) FROM pg_event_trigger),
'queue_relations',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p') AND n.nspname NOT IN('pg_catalog','information_schema') AND (n.nspname IN('pgmq','cron','net') OR c.relname ~* '(outbox|notification|queue|webhook)')),
'channel_extensions',(SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion)) FROM pg_extension WHERE extname IN('pg_cron','pg_net','http','pgmq'))
) evidence;

