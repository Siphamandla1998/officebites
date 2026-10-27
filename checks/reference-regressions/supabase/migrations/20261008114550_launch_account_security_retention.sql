-- LOCAL ONLY. No existing account is removed and no purge job is enabled.
ALTER TABLE public.profiles ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.vendors ADD COLUMN archived_at timestamptz;
-- Auth identities may be removed while an explicitly deleted profile tombstone retains financial FKs.
ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
CREATE FUNCTION private.require_auth_identity_on_profile_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=NEW.id) THEN RAISE EXCEPTION 'Profile requires Auth identity'; END IF; RETURN NEW; END $$;
CREATE TRIGGER require_auth_identity BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.require_auth_identity_on_profile_insert();
ALTER TABLE public.vendors ADD CONSTRAINT archived_vendor_inactive CHECK(archived_at IS NULL OR status='suspended');
CREATE OR REPLACE FUNCTION private.active_account() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=auth.uid() AND NOT p.suspended AND p.deleted_at IS NULL
 AND (p.role<>'vendor' OR EXISTS(SELECT 1 FROM public.vendors v WHERE v.id=p.vendor_id AND v.owner_id=p.id AND v.status<>'suspended' AND v.archived_at IS NULL)));
$$;
CREATE OR REPLACE FUNCTION private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.active_account() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin');
$$;
CREATE OR REPLACE FUNCTION private.current_vendor_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.vendor_id FROM public.profiles p JOIN public.vendors v ON v.id=p.vendor_id
 WHERE p.id=auth.uid() AND p.role='vendor' AND private.active_account()
 AND v.owner_id=p.id AND v.status<>'suspended' AND v.archived_at IS NULL;
$$;
GRANT USAGE ON SCHEMA private TO anon,authenticated;
REVOKE ALL ON FUNCTION private.active_account(),private.is_admin(),private.current_vendor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.active_account(),private.is_admin(),private.current_vendor_id() TO anon,authenticated;

-- Restrictive policies intersect existing ownership policies rather than widening them.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('CREATE POLICY active_account_access ON public.%I AS RESTRICTIVE FOR ALL TO anon,authenticated USING(auth.uid() IS NULL OR private.active_account()) WITH CHECK(auth.uid() IS NULL OR private.active_account())',t.tablename);
 END LOOP;
END $$;
CREATE POLICY active_account_storage ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING(auth.uid() IS NULL OR private.active_account()) WITH CHECK(auth.uid() IS NULL OR private.active_account());
CREATE FUNCTION private.reject_inactive_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.profiles%rowtype;
BEGIN
 IF auth.uid() IS NOT NULL THEN
  SELECT * INTO p FROM public.profiles WHERE id=auth.uid() FOR SHARE;
  IF NOT FOUND OR p.suspended OR p.deleted_at IS NOT NULL OR NOT private.active_account() THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER active_account_storage_write BEFORE INSERT OR UPDATE OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION private.reject_inactive_write();
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('CREATE TRIGGER active_account_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.reject_inactive_write()',t.tablename);
 END LOOP;
END $$;
-- Prevent browser writes from changing classifications, snapshots, ledger fields or account lifecycle.
REVOKE UPDATE ON public.orders FROM anon,authenticated;
REVOKE UPDATE ON public.order_items FROM anon,authenticated;
REVOKE DELETE ON public.orders,public.order_suborders,public.order_items,public.payfast_itn_log FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.guard_vendor_privileged_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.is_admin() or auth.role()='service_role' then
    return new;
  end if;

  if new.archived_at is distinct from old.archived_at or new.id is distinct from old.id
    or new.owner_id is distinct from old.owner_id
    or new.status is distinct from old.status
    or new.featured is distinct from old.featured
    or new.rating is distinct from old.rating
    or new.review_count is distinct from old.review_count
    or new.subscription_tier is distinct from old.subscription_tier
    or new.plan is distinct from old.plan
    or new.commission_rate is distinct from old.commission_rate
    or new.analytics_enabled is distinct from old.analytics_enabled
    or new.recommendations_enabled is distinct from old.recommendations_enabled
    or new.corporate_orders_enabled is distinct from old.corporate_orders_enabled
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Privileged vendor fields cannot be changed by this user';
  end if;

  return new;
end
$function$;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.is_admin() or auth.role()='service_role' then return new; end if;
  -- Only a nested auth signup trigger can link a freshly inserted vendor profile.
  if pg_trigger_depth() > 1 and old.role::text='vendor' and new.role=old.role
    and old.vendor_id is null and new.vendor_id is not null
    and new.id=old.id and new.email is not distinct from old.email
    and new.suspended is not distinct from old.suspended
    and new.created_at is not distinct from old.created_at
    and exists(select 1 from public.vendors v where v.id=new.vendor_id and v.owner_id=new.id)
  then return new; end if;
  if old.role::text='customer' and new.role::text='vendor'
    and old.vendor_id is null and new.vendor_id is not null
    and new.id=old.id and new.email is not distinct from old.email
    and new.suspended is not distinct from old.suspended
    and new.created_at is not distinct from old.created_at
    and auth.uid()=old.id
    and exists(select 1 from public.vendors v where v.id=new.vendor_id and v.owner_id=auth.uid())
  then return new; end if;
  if new.deleted_at is distinct from old.deleted_at or new.id is distinct from old.id or new.role is distinct from old.role
    or new.vendor_id is distinct from old.vendor_id or new.suspended is distinct from old.suspended
    or new.created_at is distinct from old.created_at or new.email is distinct from old.email
  then raise exception 'Privileged profile fields cannot be changed by this user'; end if;
  return new;
end $function$;

-- Guard new SECURITY DEFINER PL/pgSQL RPCs as well as the current live write RPCs.
DO $$ DECLARE f record; d text; BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
  WHERE p.pronamespace='public'::regnamespace AND p.prosecdef AND l.lanname='plpgsql' AND p.prorettype<>'trigger'::regtype LOOP
  d:=pg_get_functiondef(f.oid);
  d:=regexp_replace(d,'\m[Bb][Ee][Gg][Ii][Nn]\M','BEGIN IF auth.uid() IS NOT NULL AND NOT private.active_account() THEN RAISE EXCEPTION ''Active account required'' USING ERRCODE=''42501''; END IF;');
  EXECUTE d;
 END LOOP;
END $$;

CREATE TABLE private.account_removal_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL,target_user_id uuid NOT NULL,
 kind text NOT NULL,state text NOT NULL DEFAULT 'prepared',manifest jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz);
REVOKE ALL ON private.account_removal_jobs FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.account_removal_preview(p_actor uuid,p_kind text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; profile public.profiles%rowtype; r jsonb;
BEGIN
 IF auth.role()<>'service_role' AND p_actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Actor identity mismatch' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=p_actor AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL) THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF p_kind='vendor' THEN SELECT owner_id INTO target FROM public.vendors WHERE id=p_id; ELSIF p_kind='customer' THEN target:=p_id; ELSE RAISE EXCEPTION 'Invalid removal kind'; END IF;
 IF target IS NULL THEN RAISE EXCEPTION 'Account owner not found; requires manual review'; END IF;
 SELECT * INTO STRICT profile FROM public.profiles WHERE id=target;
 IF target=p_actor THEN RAISE EXCEPTION 'Self-removal is prohibited'; END IF;
 IF profile.role='admin' AND (SELECT count(*) FROM public.profiles WHERE role='admin' AND NOT suspended AND deleted_at IS NULL)<=1 THEN RAISE EXCEPTION 'Cannot remove last active administrator'; END IF;
 IF profile.role='admin' OR(p_kind='customer' AND profile.role<>'customer') THEN RAISE EXCEPTION 'Use an account type matching the designated record'; END IF;
 r:=jsonb_build_object('kind',p_kind,'recordId',p_id,'userId',target,'name',profile.name,'confirmation',p_kind||':'||p_id::text,
  'vendors',(SELECT coalesce(jsonb_agg(id),'[]') FROM public.vendors WHERE owner_id=target),
  'orders',(SELECT count(*) FROM public.orders WHERE customer_id=target OR id IN(SELECT order_id FROM public.order_suborders WHERE vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target))),
  'suborders',(SELECT count(*) FROM public.order_suborders WHERE vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target)),
  'meals',(SELECT count(*) FROM public.meals WHERE vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target)),
  'conversations',(SELECT count(*) FROM public.conversations WHERE customer_id=target OR vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target)),
  'notifications',(SELECT count(*) FROM public.notifications WHERE user_id=target),
  'storage',(SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'name',name) ORDER BY bucket_id,name),'[]') FROM storage.objects
    WHERE owner_id=target::text OR owner=target OR (bucket_id IN('meal-images','vendor-images') AND split_part(name,'/',1) IN(SELECT id::text FROM public.vendors WHERE owner_id=target))),
  'financialHistory','Retained. Vendor records are archived; profiles are anonymised. Auth identity is deleted only after Storage cleanup.');
 RETURN r||jsonb_build_object('fingerprint',md5(r::text));
END $$;
CREATE FUNCTION public.admin_preview_account_removal(p_kind text,p_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.account_removal_preview(auth.uid(),p_kind,p_id);
$$;
CREATE FUNCTION public.prepare_account_removal(p_actor uuid,p_kind text,p_id uuid,p_fingerprint text,p_confirmation text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; target uuid; job uuid;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-account-removal'));
 r:=private.account_removal_preview(p_actor,p_kind,p_id); target:=(r->>'userId')::uuid;
 IF p_confirmation IS DISTINCT FROM r->>'confirmation' THEN RAISE EXCEPTION 'Confirmation does not match'; END IF;
 SELECT id INTO job FROM private.account_removal_jobs WHERE target_user_id=target AND actor_id=p_actor AND state='prepared' ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN
  UPDATE private.account_removal_jobs SET manifest=manifest||jsonb_build_object('storage',(SELECT coalesce(jsonb_agg(x),'[]') FROM(SELECT DISTINCT value x FROM jsonb_array_elements(manifest->'storage') UNION SELECT DISTINCT value x FROM jsonb_array_elements(r->'storage')) files)) WHERE id=job;
  RETURN jsonb_build_object('jobId',job,'manifest',(SELECT manifest FROM private.account_removal_jobs WHERE id=job));
 END IF;
 IF p_confirmation IS DISTINCT FROM r->>'confirmation' OR p_fingerprint IS DISTINCT FROM r->>'fingerprint' THEN RAISE EXCEPTION 'Dependencies changed or confirmation does not match; preview again'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=target FOR UPDATE;
 UPDATE public.profiles SET suspended=true,deleted_at=now(),name='Removed account',email='removed-'||id::text||'@invalid.local',avatar_url=NULL,building=NULL WHERE id=target;
 UPDATE public.vendors SET archived_at=now(),status='suspended',featured=false,email=NULL,contact_number=NULL,address=NULL,building=NULL,latitude=NULL,longitude=NULL,logo=NULL,cover_image=NULL WHERE owner_id=target;
 UPDATE public.meals SET available=false,image='' WHERE vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target);
 UPDATE public.support_tickets SET requester_name='Removed account',requester_email=NULL,requester_contact=NULL,attachment_url=NULL,meta=meta-'attachment_path' WHERE requester_id=target;
 UPDATE public.conversations SET closed_at=coalesce(closed_at,now()) WHERE customer_id=target OR vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target);
 INSERT INTO private.account_removal_jobs(actor_id,target_user_id,kind,manifest) VALUES(p_actor,target,p_kind,r) RETURNING id INTO job;
 INSERT INTO private.business_audit(actor_id,action,record_id,reason,details) VALUES(p_actor,'prepare_account_removal',target,'Confirmed dependency preview',jsonb_build_object('jobId',job,'kind',p_kind));
 RETURN jsonb_build_object('jobId',job,'manifest',r);
END $$;
CREATE FUNCTION public.complete_account_removal(p_actor uuid,p_job_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job private.account_removal_jobs%rowtype;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT job FROM private.account_removal_jobs WHERE id=p_job_id AND actor_id=p_actor FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=p_actor AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL) THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id=job.target_user_id) THEN RAISE EXCEPTION 'Auth identity still exists'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects o JOIN jsonb_to_recordset(job.manifest->'storage') x(bucket text,name text) ON o.bucket_id=x.bucket AND o.name=x.name) THEN RAISE EXCEPTION 'Storage cleanup incomplete'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE owner_id=job.target_user_id::text OR owner=job.target_user_id OR(bucket_id IN('meal-images','vendor-images') AND split_part(name,'/',1) IN(SELECT id::text FROM public.vendors WHERE owner_id=job.target_user_id))) THEN RAISE EXCEPTION 'New Storage dependencies found; retry cleanup'; END IF;
 UPDATE private.account_removal_jobs SET state='complete',completed_at=now() WHERE id=job.id;
 INSERT INTO private.business_audit(actor_id,action,record_id,reason) VALUES(p_actor,'complete_account_removal',job.target_user_id,'Auth deletion and Storage cleanup verified');
END $$;
REVOKE ALL ON FUNCTION private.account_removal_preview(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.account_removal_preview(uuid,text,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.admin_preview_account_removal(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_account_removal(text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.prepare_account_removal(uuid,text,uuid,text,text),public.complete_account_removal(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_removal(uuid,text,uuid,text,text),public.complete_account_removal(uuid,uuid) TO service_role;

CREATE TABLE private.retention_settings(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),days integer NOT NULL DEFAULT 30 CHECK(days BETWEEN 1 AND 3650),
 schedule text NOT NULL DEFAULT '0 0 * * *',enabled boolean NOT NULL DEFAULT false,job_id bigint);
INSERT INTO private.retention_settings(singleton) VALUES(true);
REVOKE ALL ON private.retention_settings FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.admin_preview_retention() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE settings private.retention_settings%rowtype;
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT settings FROM private.retention_settings;
 RETURN jsonb_build_object('days',settings.days,'scheduleUTC',settings.schedule,'enabled',settings.enabled,'schedulerAvailable',to_regclass('cron.job') IS NOT NULL,
  'count',(SELECT count(*) FROM public.conversations WHERE closed_at<now()-make_interval(days=>settings.days)),
  'conversations',(SELECT coalesce(jsonb_agg(x),'[]') FROM(SELECT id,closed_at,(SELECT count(*) FROM public.messages m WHERE m.conversation_id=c.id) messages FROM public.conversations c
    WHERE closed_at<now()-make_interval(days=>settings.days) ORDER BY id LIMIT 200) x));
END $$;
CREATE FUNCTION public.admin_configure_retention(p_days integer,p_schedule text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF p_schedule IS NULL OR p_schedule !~ '^[0-9*/,-]+ [0-9*/,-]+ [0-9*/,-]+ [0-9*/,-]+ [0-9*/,-]+$' THEN RAISE EXCEPTION 'Five-field UTC cron schedule required'; END IF;
 UPDATE private.retention_settings SET days=p_days,schedule=p_schedule,enabled=false;
 IF to_regclass('cron.job') IS NOT NULL THEN
  EXECUTE 'SELECT cron.alter_job($1,schedule:=$2,active:=false)' USING (SELECT job_id FROM private.retention_settings),p_schedule;
 END IF;
 INSERT INTO private.business_audit(actor_id,action,reason,details) VALUES(auth.uid(),'configure_retention','Dry-run scheduling only',jsonb_build_object('days',p_days,'schedule',p_schedule));
END $$;
CREATE FUNCTION private.conversation_retention_tick() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE removed integer; settings private.retention_settings%rowtype;
BEGIN
 SELECT * INTO STRICT settings FROM private.retention_settings;
 IF NOT settings.enabled THEN RETURN jsonb_build_object('dryRun',true,'count',(SELECT count(*) FROM public.conversations WHERE closed_at<now()-make_interval(days=>settings.days))); END IF;
 DELETE FROM public.conversations WHERE closed_at<now()-make_interval(days=>settings.days); GET DIAGNOSTICS removed=ROW_COUNT;
 INSERT INTO private.business_audit(action,reason,details) VALUES('retention_purge','Previously enabled retention schedule',jsonb_build_object('removed',removed));
 RETURN jsonb_build_object('dryRun',false,'removed',removed);
END $$;
REVOKE ALL ON FUNCTION private.conversation_retention_tick() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_preview_retention(),public.admin_configure_retention(integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_retention(),public.admin_configure_retention(integer,text) TO authenticated;
-- Replace the previously exposed purge routine with an inert preview. No public purge bypass.
CREATE OR REPLACE FUNCTION public.erase_old_conversations() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Use reviewed retention settings and private scheduled runner'; END $$;
REVOKE ALL ON FUNCTION public.erase_old_conversations() FROM PUBLIC,anon,authenticated;
-- pg_cron is not enabled/installed by this migration. When available, register an inactive job.
DO $$ DECLARE job bigint; BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
  EXECUTE 'SELECT cron.schedule(''officebites-conversation-retention'',''0 0 * * *'',''SELECT private.conversation_retention_tick();'')' INTO job;
  EXECUTE 'SELECT cron.alter_job($1,active:=false)' USING job;
  UPDATE private.retention_settings SET job_id=job;
 END IF;
END $$;
