-- SELECT ONLY. Independently select gfzhdkitdyqftealgqfi in the control plane.
-- Session identity/database names alone are not project identity proof.
SELECT jsonb_build_object(
 'observed_utc',clock_timestamp(),
 'observer',current_user,
 'history',(SELECT jsonb_build_object('count',count(*),'latest',max(version),
   'digest',md5(string_agg(version||':'||coalesce(name,''),E'\n' ORDER BY version)),
   'matches_20261028',count(*)=38 AND max(version)='20261010101910' AND
    md5(string_agg(version||':'||coalesce(name,''),E'\n' ORDER BY version))='ffa2bc5fbcf4470b5f0d0277d6d2bfa1')
   FROM supabase_migrations.schema_migrations),
 'security_functions',(SELECT jsonb_agg(jsonb_build_object('signature',signature,'expected',expected,
   'actual',md5(pg_get_functiondef(p.oid)),'matches',md5(pg_get_functiondef(p.oid))=expected))
   FROM (VALUES
    ('public.handle_new_user()','086649c1a17a57fbcfde261ea7bdba6a'),
    ('public.guard_vendor_privileged_fields()','405aaa6295945413607a5413a8d965a3'),
    ('public.guard_profile_privileged_fields()','389319aa4e0b30ada46bc315e97afbad')
   ) f(signature,expected) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(signature)),
 'core_objects',(SELECT jsonb_agg(jsonb_build_object('name',relname,'owner',pg_get_userbyid(relowner),'rls',relrowsecurity))
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
   AND relname IN('profiles','vendors','orders','order_suborders','order_items')),
 'new_objects',(SELECT jsonb_agg(jsonb_build_object('name',name,'exists',to_regclass(name) IS NOT NULL)) FROM unnest(ARRAY[
   'private.vendor_payment_profiles','private.manual_order_payments','private.legal_versions',
   'private.vendor_compliance_events','private.order_legal_acceptances']) name),
 'orders',(SELECT jsonb_build_object('count',count(*),'pending',count(*) FILTER(WHERE status='pending_payment'),
   'preparing',count(*) FILTER(WHERE status='preparing'),'digest',md5(string_agg(to_jsonb(o)::text,'' ORDER BY id))) FROM public.orders o),
 'suborder_digest',(SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) FROM public.order_suborders s),
 'item_digest',(SELECT md5(string_agg(to_jsonb(i)::text,'' ORDER BY id)) FROM public.order_items i),
 'vendor_restrictions_digest',(SELECT md5(string_agg(jsonb_build_object('id',id,'owner_id',owner_id,'status',status,
   'archived_at',archived_at,'commission_rate',commission_rate)::text,'' ORDER BY id)) FROM public.vendors),
 'profile_restrictions_digest',(SELECT md5(string_agg(jsonb_build_object('id',id,'role',role,'vendor_id',vendor_id,
   'suspended',suspended,'deleted_at',deleted_at)::text,'' ORDER BY id)) FROM public.profiles),
 'storage',(SELECT jsonb_agg(jsonb_build_object('name',relname,'owner',pg_get_userbyid(relowner),'rls',relrowsecurity))
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND relname IN('objects','buckets')),
 'policy_delegation',jsonb_build_object(
   'session_preload_libraries',current_setting('session_preload_libraries',true),
   'postgres_objects',coalesce((current_setting('supautils.policy_grants',true)::jsonb->'postgres') ? 'storage.objects',false),
   'postgres_buckets',coalesce((current_setting('supautils.policy_grants',true)::jsonb->'postgres') ? 'storage.buckets',false),
   'postgres_is_storage_owner_member',pg_has_role('postgres','supabase_storage_admin','MEMBER')),
 'storage_counts',jsonb_build_object('buckets',(SELECT count(*) FROM storage.buckets),'objects',(SELECT count(*) FROM storage.objects)),
 'backup_proof','NOT PROVIDED BY THIS QUERY: require private archive and isolated restore evidence'
) AS recovery_preflight;
