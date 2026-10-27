-- Additive central-hub policy. Never enables enforcement or rewrites historical orders.
BEGIN;
SET LOCAL lock_timeout='10s';
ALTER TABLE private.delivery_settings ADD COLUMN hub_id uuid NOT NULL DEFAULT gen_random_uuid(),
 ADD COLUMN hub_name text NOT NULL DEFAULT 'OfficeBites — Eduvos Umhlanga',
 ADD COLUMN hub_address text NOT NULL DEFAULT '1D Lunar Row, Umhlanga Ridge Boulevard, Umhlanga New Town Centre, 4319',
 ADD COLUMN hub_pin_verified boolean NOT NULL DEFAULT false,
 ADD COLUMN fee_structure_confirmed boolean NOT NULL DEFAULT false,
 ADD COLUMN activation_ready boolean NOT NULL DEFAULT false;
UPDATE private.delivery_settings SET enabled=false,free_radius_km=0.5,max_radius_km=5,paid_fee=15,revision=revision+1;
ALTER TABLE private.delivery_quotes ADD COLUMN origin_details jsonb;
ALTER TABLE public.order_suborders ADD COLUMN delivery_snapshot jsonb;
CREATE TABLE private.vendor_delivery_origins(
 vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id),mode text NOT NULL DEFAULT 'CENTRAL' CHECK(mode IN('CENTRAL','VENDOR')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','revoked')),
 address text NOT NULL,latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 origin_id uuid,service_radius_km double precision CHECK(service_radius_km>0 AND service_radius_km<=1000),
 revision integer NOT NULL DEFAULT 1,requested_by uuid NOT NULL,requested_at timestamptz NOT NULL DEFAULT now(),
 decided_by uuid,decided_at timestamptz,reason text,
 CHECK(mode='CENTRAL' OR (status='approved' AND origin_id IS NOT NULL))
);
CREATE TABLE private.delivery_origin_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 actor_id uuid,action text NOT NULL,reason text NOT NULL,revision integer NOT NULL,details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX delivery_origin_history_vendor ON private.delivery_origin_history(vendor_id,created_at);
ALTER TABLE private.vendor_delivery_origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.delivery_origin_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.vendor_delivery_origins,private.delivery_origin_history FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.origin_event(p_vendor uuid,p_action text,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d private.vendor_delivery_origins%rowtype; owner uuid;
BEGIN
 SELECT * INTO STRICT d FROM private.vendor_delivery_origins WHERE vendor_id=p_vendor;
 INSERT INTO private.delivery_origin_history(vendor_id,actor_id,action,reason,revision,details) VALUES(p_vendor,auth.uid(),p_action,p_reason,d.revision,to_jsonb(d));
 INSERT INTO private.business_audit(actor_id,action,record_id,reason,details) VALUES(auth.uid(),'delivery_origin_'||p_action,p_vendor,p_reason,to_jsonb(d));
 IF p_action<>'requested' THEN
  SELECT owner_id INTO owner FROM public.vendors WHERE id=p_vendor;
  INSERT INTO public.notifications(user_id,type,title,body,action_url) VALUES(owner,'general','Delivery origin updated',format('%s. Current delivery mode: %s. %s',p_action,d.mode,p_reason),'/vendor/settings');
 END IF;
END $$;
CREATE FUNCTION public.request_vendor_delivery_origin(p_vendor_id uuid,p_address text,p_latitude double precision,p_longitude double precision) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id WHERE v.id=p_vendor_id AND v.owner_id=auth.uid() AND v.status='approved' AND v.archived_at IS NULL AND NOT p.suspended AND p.deleted_at IS NULL AND private.active_account() FOR UPDATE OF v;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active approved vendor owner required' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_address),'') IS NULL OR length(p_address)>1000 OR p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Valid proposed address and coordinates required'; END IF;
 INSERT INTO private.vendor_delivery_origins(vendor_id,address,latitude,longitude,requested_by) VALUES(p_vendor_id,btrim(p_address),p_latitude,p_longitude,auth.uid())
 ON CONFLICT(vendor_id) DO UPDATE SET address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,mode='CENTRAL',status='pending',origin_id=NULL,service_radius_km=NULL,revision=private.vendor_delivery_origins.revision+1,requested_by=auth.uid(),requested_at=now(),decided_by=NULL,decided_at=NULL,reason=NULL;
 PERFORM private.origin_event(p_vendor_id,'requested','Vendor submitted a location for administrator verification; CENTRAL applies pending review');
END $$;
CREATE FUNCTION public.admin_decide_delivery_origin(p_vendor_id uuid,p_revision integer,p_action text,p_reason text,p_radius_km double precision DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d private.vendor_delivery_origins%rowtype; v public.vendors%rowtype;
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT v FROM public.vendors WHERE id=p_vendor_id FOR UPDATE;
 SELECT * INTO d FROM private.vendor_delivery_origins WHERE vendor_id=p_vendor_id FOR UPDATE;
 IF NOT FOUND OR p_revision IS DISTINCT FROM d.revision THEN RAISE EXCEPTION 'Location request changed; reload before deciding'; END IF;
 IF nullif(btrim(p_reason),'') IS NULL OR length(p_reason)>1000 OR p_action IS NULL OR p_action NOT IN('approve','reject','revoke','central','vendor') THEN RAISE EXCEPTION 'Explicit action and reason required'; END IF;
 IF p_action IN('approve','vendor') AND (v.status<>'approved' OR v.archived_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v.owner_id AND NOT suspended AND deleted_at IS NULL)) THEN RAISE EXCEPTION 'Active approved vendor required'; END IF;
 IF p_action='approve' AND (d.status<>'pending' OR d.latitude NOT BETWEEN -90 AND 90 OR d.longitude NOT BETWEEN -180 AND 180) THEN RAISE EXCEPTION 'Valid pending location required'; END IF;
 IF p_action='vendor' AND d.status<>'approved' THEN RAISE EXCEPTION 'Approved location required'; END IF;
 IF p_action='reject' AND d.status<>'pending' THEN RAISE EXCEPTION 'Pending location required'; END IF;
 IF p_radius_km IS NOT NULL AND (p_radius_km<=0 OR p_radius_km>1000 OR p_radius_km::text IN('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Valid service radius required'; END IF;
 UPDATE private.vendor_delivery_origins SET
  mode=CASE WHEN p_action='vendor' THEN 'VENDOR' ELSE 'CENTRAL' END,
  status=CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' WHEN 'revoke' THEN 'revoked' ELSE status END,
  origin_id=CASE WHEN p_action='approve' THEN gen_random_uuid() WHEN p_action IN('reject','revoke') THEN NULL ELSE origin_id END,
  service_radius_km=CASE WHEN p_action='approve' THEN p_radius_km ELSE service_radius_km END,
  revision=revision+1,decided_by=auth.uid(),decided_at=now(),reason=btrim(p_reason) WHERE vendor_id=p_vendor_id;
 PERFORM private.origin_event(p_vendor_id,p_action,p_reason);
END $$;
-- Direct vendor profile writes cannot retain approval for an altered location.
CREATE FUNCTION private.invalidate_vendor_delivery_origin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude OR NEW.address IS DISTINCT FROM OLD.address OR NEW.status IS DISTINCT FROM OLD.status OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
  IF (NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude OR NEW.address IS DISTINCT FROM OLD.address) AND auth.uid()=OLD.owner_id AND (OLD.status<>'approved' OR OLD.archived_at IS NOT NULL OR NOT private.active_account()) THEN RAISE EXCEPTION 'Inactive vendors cannot change delivery origins' USING ERRCODE='42501'; END IF;
  UPDATE private.vendor_delivery_origins SET mode='CENTRAL',status='revoked',origin_id=NULL,revision=revision+1,decided_at=now(),decided_by=auth.uid(),reason='Profile location or vendor availability changed; CENTRAL applies until a new request is reviewed' WHERE vendor_id=NEW.id;
  IF FOUND THEN PERFORM private.origin_event(NEW.id,'invalidated','Profile location or vendor availability changed; CENTRAL applies until a new request is reviewed'); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invalidate_vendor_delivery_origin AFTER UPDATE OF latitude,longitude,address,status,archived_at ON public.vendors FOR EACH ROW EXECUTE FUNCTION private.invalidate_vendor_delivery_origin();
CREATE FUNCTION public.get_vendor_delivery_origin(p_vendor_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.active_account() OR NOT(private.is_admin() OR EXISTS(SELECT 1 FROM public.vendors WHERE id=p_vendor_id AND owner_id=auth.uid())) THEN RAISE EXCEPTION 'Vendor owner or administrator required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('current',coalesce((SELECT to_jsonb(d) FROM private.vendor_delivery_origins d WHERE vendor_id=p_vendor_id),jsonb_build_object('mode','CENTRAL','status','not_requested')),'history',(SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY created_at DESC,id),'[]') FROM private.delivery_origin_history h WHERE vendor_id=p_vendor_id));
END $$;
CREATE FUNCTION public.admin_delivery_origin_queue() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('vendor_name',v.name,'vendor_status',v.status) ORDER BY d.requested_at),'[]') FROM private.vendor_delivery_origins d JOIN public.vendors v ON v.id=d.vendor_id);
END $$;
CREATE FUNCTION public.admin_save_delivery_hub(p_settings jsonb,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.delivery_settings%rowtype; lat double precision;lng double precision;free double precision;max_km double precision;fee numeric; pin boolean;confirmed boolean;
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT s FROM private.delivery_settings FOR UPDATE;
 IF (p_settings->>'revision')::integer IS DISTINCT FROM s.revision THEN RAISE EXCEPTION 'Delivery configuration changed; reload before saving'; END IF;
 lat:=(p_settings->>'latitude')::double precision;lng:=(p_settings->>'longitude')::double precision;free:=(p_settings->>'free_radius_km')::double precision;max_km:=(p_settings->>'max_radius_km')::double precision;fee:=(p_settings->>'paid_fee')::numeric;
 pin:=coalesce((p_settings->>'hub_pin_verified')::boolean,false);confirmed:=coalesce((p_settings->>'fee_structure_confirmed')::boolean,false);
 IF nullif(btrim(p_reason),'') IS NULL OR length(p_reason)>1000 OR nullif(btrim(p_settings->>'hub_name'),'') IS NULL OR length(p_settings->>'hub_name')>200 OR nullif(btrim(p_settings->>'hub_address'),'') IS NULL OR length(p_settings->>'hub_address')>1000 OR lat IS NULL OR lng IS NULL OR lat NOT BETWEEN -90 AND 90 OR lng NOT BETWEEN -180 AND 180 OR free IS NULL OR free<0 OR free>1000 OR max_km IS NULL OR max_km<free OR max_km>1000 OR fee IS NULL OR fee<0 OR fee>10000 OR fee<>round(fee,2) THEN RAISE EXCEPTION 'Valid hub, radii, decimal fee and reason required'; END IF;
 IF coalesce((p_settings->>'enabled')::boolean,false) AND (NOT pin OR NOT confirmed OR NOT s.activation_ready OR lat IS DISTINCT FROM s.latitude OR lng IS DISTINCT FROM s.longitude OR free IS DISTINCT FROM s.free_radius_km OR max_km IS DISTINCT FROM s.max_radius_km OR fee IS DISTINCT FROM s.paid_fee) THEN RAISE EXCEPTION 'Save policy disabled, verify operational pin, owner fee approval and authenticated/guest staging checks before enabling'; END IF;
 UPDATE private.delivery_settings SET hub_name=btrim(p_settings->>'hub_name'),hub_address=btrim(p_settings->>'hub_address'),latitude=lat,longitude=lng,free_radius_km=free,max_radius_km=max_km,paid_fee=fee,hub_pin_verified=pin,fee_structure_confirmed=confirmed,
 activation_ready=activation_ready AND pin AND confirmed AND lat=s.latitude AND lng=s.longitude AND free=s.free_radius_km AND max_km=s.max_radius_km AND fee=s.paid_fee,
 enabled=coalesce((p_settings->>'enabled')::boolean,false),revision=revision+1;
 INSERT INTO private.business_audit(actor_id,action,reason,details) VALUES(auth.uid(),'delivery_hub_settings',p_reason,p_settings-'activation_ready');
END $$;
-- Preserve old signature, but it cannot attest a pin or bypass the new release gate.
CREATE OR REPLACE FUNCTION public.admin_update_delivery_settings(p_enabled boolean,p_latitude double precision,p_longitude double precision,p_free_radius_km double precision,p_max_radius_km double precision,p_paid_fee numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM public.admin_save_delivery_hub((SELECT to_jsonb(s)||jsonb_build_object('enabled',p_enabled,'latitude',p_latitude,'longitude',p_longitude,'free_radius_km',p_free_radius_km,'max_radius_km',p_max_radius_km,'paid_fee',p_paid_fee) FROM private.delivery_settings s),'Legacy admin delivery settings request');
END $$;
CREATE FUNCTION public.service_confirm_delivery_checks(p_revision integer,p_evidence text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_evidence),'') IS NULL THEN RAISE EXCEPTION 'Authenticated and guest checkout evidence required'; END IF;
 UPDATE private.delivery_settings SET activation_ready=true WHERE revision=p_revision AND hub_pin_verified AND fee_structure_confirmed;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verified pin and owner fee approval required'; END IF;
 INSERT INTO private.business_audit(action,reason) VALUES('delivery_checkout_checks_verified',p_evidence);
END $$;
-- Computation acquires policy -> vendor -> owner -> origin locks in stable order.
CREATE FUNCTION private.compute_delivery(p_lat double precision,p_lng double precision,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.delivery_settings%rowtype;v record;d private.vendor_delivery_origins%rowtype;mode text;origin uuid;lat double precision;lng double precision;distance double precision;radius double precision;charge numeric;fee numeric:=0;allocated boolean:=false;details jsonb:='[]';max_distance double precision:=0;
BEGIN
 SELECT * INTO STRICT s FROM private.delivery_settings FOR SHARE;
 IF NOT s.enabled OR NOT s.hub_pin_verified OR NOT s.fee_structure_confirmed OR NOT s.activation_ready THEN RAISE EXCEPTION 'Delivery configuration is not verified ready'; END IF;
 IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Valid destination coordinates required'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i LEFT JOIN public.meals m ON m.id=(i->>'mealId')::uuid WHERE m.id IS NULL) THEN RAISE EXCEPTION 'Valid cart required'; END IF;
 PERFORM x.id FROM public.vendors x WHERE id IN(SELECT m.vendor_id FROM public.meals m JOIN jsonb_array_elements(p_items) i ON m.id=(i->>'mealId')::uuid) ORDER BY x.id FOR SHARE;
 PERFORM p.id FROM public.profiles p WHERE id IN(SELECT x.owner_id FROM public.vendors x JOIN public.meals m ON m.vendor_id=x.id JOIN jsonb_array_elements(p_items) i ON m.id=(i->>'mealId')::uuid) ORDER BY p.id FOR SHARE;
 FOR v IN SELECT DISTINCT x.id,x.name,x.status,x.archived_at,p.suspended,p.deleted_at FROM public.vendors x JOIN public.profiles p ON p.id=x.owner_id JOIN public.meals m ON m.vendor_id=x.id JOIN jsonb_array_elements(p_items) i ON m.id=(i->>'mealId')::uuid ORDER BY x.id LOOP
  IF v.status<>'approved' OR v.archived_at IS NOT NULL OR v.suspended OR v.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Vendor % cannot currently fulfil delivery',v.name; END IF;
  SELECT * INTO d FROM private.vendor_delivery_origins WHERE vendor_id=v.id FOR SHARE;
  mode:='CENTRAL';origin:=s.hub_id;lat:=s.latitude;lng:=s.longitude;radius:=s.max_radius_km;
  IF d.mode='VENDOR' AND d.status='approved' AND d.origin_id IS NOT NULL THEN mode:='VENDOR';origin:=d.origin_id;lat:=d.latitude;lng:=d.longitude;radius:=least(coalesce(d.service_radius_km,s.max_radius_km),s.max_radius_km); END IF;
  distance:=private.distance_km(lat,lng,p_lat,p_lng);
  IF distance>radius+1e-9 THEN RAISE EXCEPTION 'Vendor % is outside its % delivery radius (% km)',v.name,mode,radius; END IF;
  charge:=CASE WHEN distance<=s.free_radius_km+1e-9 THEN 0 ELSE s.paid_fee END;
  fee:=greatest(fee,charge);max_distance:=greatest(max_distance,distance);
  details:=details||jsonb_build_array(jsonb_build_object('vendorId',v.id,'vendorName',v.name,'mode',mode,'originId',origin,'originLatitude',lat,'originLongitude',lng,'destinationLatitude',p_lat,'destinationLongitude',p_lng,'distanceKm',distance,'policyVersion',s.revision,'originVersion',coalesce(d.revision,0),'freeRadiusKm',s.free_radius_km,'maxRadiusKm',radius,'standardFee',s.paid_fee,'calculatedCharge',charge,'allocatedCharge',CASE WHEN charge>0 AND NOT allocated THEN charge ELSE 0 END));
  IF charge>0 THEN allocated:=true; END IF;
 END LOOP;
 IF jsonb_array_length(details)=0 THEN RAISE EXCEPTION 'No eligible vendors in cart'; END IF;
 RETURN jsonb_build_object('vendors',details,'fee',fee,'distanceKm',max_distance);
END $$;
CREATE OR REPLACE FUNCTION public.quote_delivery(p_destination jsonb,p_items jsonb,p_guest_contact text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.delivery_settings%rowtype;lat double precision;lng double precision;accuracy double precision;captured timestamptz;computed jsonb;quote uuid;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT private.active_account() THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT s FROM private.delivery_settings FOR SHARE;
 IF NOT s.enabled THEN RETURN jsonb_build_object('enabled',false); END IF;
 IF auth.uid() IS NULL AND NOT public.valid_sa_mobile(p_guest_contact,'local') THEN RAISE EXCEPTION 'Valid guest mobile required'; END IF;
 lat:=(p_destination->>'latitude')::double precision;lng:=(p_destination->>'longitude')::double precision;accuracy:=(p_destination->>'accuracy')::double precision;captured:=(p_destination->>'capturedAt')::timestamptz;
 IF accuracy IS NULL OR captured IS NULL OR accuracy<0 OR accuracy>s.max_accuracy_m OR accuracy::text IN('NaN','Infinity','-Infinity') OR captured<clock_timestamp()-interval '60 seconds' OR captured>clock_timestamp()+interval '10 seconds' THEN RAISE EXCEPTION 'Fresh accurate coordinates required'; END IF;
 computed:=private.compute_delivery(lat,lng,p_items);
 INSERT INTO private.delivery_quotes(customer_id,guest_proof,items_hash,latitude,longitude,distance_km,fee,revision,origin_details) VALUES(auth.uid(),CASE WHEN auth.uid() IS NULL THEN md5(btrim(p_guest_contact)) END,md5(p_items::text),lat,lng,(computed->>'distanceKm')::double precision,(computed->>'fee')::numeric,s.revision,computed->'vendors') RETURNING id INTO quote;
 RETURN computed||jsonb_build_object('enabled',true,'id',quote,'expiresInSeconds',300);
END $$;
CREATE OR REPLACE FUNCTION public.create_order_with_delivery(p_customer_id uuid,p_guest_name text,p_guest_contact text,p_guest_email text,p_delivery_date date,p_delivery_location text,p_items jsonb,p_quote_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.delivery_settings%rowtype;q private.delivery_quotes%rowtype;r jsonb;o public.orders%rowtype;computed jsonb;
BEGIN
 SELECT * INTO STRICT s FROM private.delivery_settings FOR SHARE;
 IF NOT s.enabled AND p_quote_id IS NOT NULL THEN RAISE EXCEPTION 'Delivery policy changed; review checkout'; END IF;
 IF s.enabled THEN
  SELECT * INTO q FROM private.delivery_quotes WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND OR q.used OR q.expires_at<clock_timestamp() OR q.revision<>s.revision OR q.items_hash<>md5(p_items::text) OR q.customer_id IS DISTINCT FROM auth.uid() OR (auth.uid() IS NULL AND q.guest_proof IS DISTINCT FROM md5(btrim(p_guest_contact))) THEN RAISE EXCEPTION 'Delivery quote changed or expired. Review delivery before ordering.'; END IF;
  computed:=private.compute_delivery(q.latitude,q.longitude,p_items);
  IF q.origin_details IS DISTINCT FROM computed->'vendors' OR q.fee IS DISTINCT FROM (computed->>'fee')::numeric THEN RAISE EXCEPTION 'Delivery origin approval or policy changed; requote before ordering'; END IF;
 END IF;
 r:=private.create_order_core(p_customer_id,p_guest_name,p_guest_contact,p_guest_email,p_delivery_date,p_delivery_location,p_items);
 IF s.enabled THEN
  UPDATE public.orders SET total=total+q.fee,delivery_fee=q.fee,delivery_distance_km=q.distance_km,destination_latitude=q.latitude,destination_longitude=q.longitude WHERE id=(r->>'id')::uuid;
  UPDATE public.order_suborders sub SET delivery_snapshot=d FROM jsonb_array_elements(q.origin_details) d WHERE sub.order_id=(r->>'id')::uuid AND sub.vendor_id=(d->>'vendorId')::uuid;
  UPDATE private.delivery_quotes SET used=true WHERE id=q.id;
 END IF;
 SELECT * INTO o FROM public.orders WHERE id=(r->>'id')::uuid;
 RETURN public.order_to_json(o)||jsonb_build_object('delivery_fee',o.delivery_fee,'delivery_distance_km',o.delivery_distance_km);
END $$;
CREATE FUNCTION private.guard_delivery_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF OLD.delivery_snapshot IS NOT NULL AND NEW.delivery_snapshot IS DISTINCT FROM OLD.delivery_snapshot THEN RAISE EXCEPTION 'Historical delivery snapshot is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_delivery_snapshot BEFORE UPDATE OF delivery_snapshot ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.guard_delivery_snapshot();
REVOKE ALL ON FUNCTION private.origin_event(uuid,text,text),private.invalidate_vendor_delivery_origin(),private.compute_delivery(double precision,double precision,jsonb),private.guard_delivery_snapshot() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure signature,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('request_vendor_delivery_origin','admin_decide_delivery_origin','get_vendor_delivery_origin','admin_delivery_origin_queue','admin_save_delivery_hub','service_confirm_delivery_checks') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I',f.signature,CASE WHEN f.proname='service_confirm_delivery_checks' THEN 'service_role' ELSE 'authenticated' END);
 END LOOP;
END $$;
-- Discovery must not exclude CENTRAL vendors with no business GPS. While enforcement
-- is disabled, do not silently impose an unverified hub's delivery boundary in search.
CREATE OR REPLACE FUNCTION public.get_nearby_vendors(p_latitude double precision,p_longitude double precision,p_limit integer DEFAULT 30)
 RETURNS TABLE(id uuid,distance_km double precision) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.delivery_settings%rowtype;
BEGIN
 IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Valid discovery coordinates required'; END IF;
 SELECT * INTO STRICT s FROM private.delivery_settings;
 IF NOT s.enabled THEN
  RETURN QUERY SELECT v.id,NULL::double precision FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id
  WHERE v.status='approved' AND v.archived_at IS NULL AND NOT p.suspended AND p.deleted_at IS NULL ORDER BY v.id LIMIT greatest(1,least(coalesce(p_limit,30),100));
 ELSE
  RETURN QUERY WITH effective AS(
   SELECT v.id,private.distance_km(CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN d.latitude ELSE s.latitude END,CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN d.longitude ELSE s.longitude END,p_latitude,p_longitude) distance,
    CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN least(coalesce(d.service_radius_km,s.max_radius_km),s.max_radius_km) ELSE s.max_radius_km END radius
   FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id LEFT JOIN private.vendor_delivery_origins d ON d.vendor_id=v.id
   WHERE v.status='approved' AND v.archived_at IS NULL AND NOT p.suspended AND p.deleted_at IS NULL)
  SELECT e.id,e.distance FROM effective e WHERE e.distance<=e.radius+1e-9 ORDER BY e.distance,e.id LIMIT greatest(1,least(coalesce(p_limit,30),100));
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.get_nearby_vendors(double precision,double precision,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_vendors(double precision,double precision,integer) TO anon,authenticated;
COMMIT;
