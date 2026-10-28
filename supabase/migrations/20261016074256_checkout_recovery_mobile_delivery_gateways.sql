-- Staging-first. Requires audited October-10 prerequisites; never blanket db push.
-- Existing records retain their contact values and historical payment uncertainty.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN IF to_regprocedure('private.active_account()') IS NULL OR to_regprocedure('public.prepare_payfast_order(uuid,uuid,text)') IS NULL THEN RAISE EXCEPTION 'Audited account/payment prerequisites missing'; END IF; END $$;
CREATE FUNCTION public.valid_sa_mobile(p_value text,p_mode text DEFAULT 'local') RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_value IS NULL OR p_value !~ '^[0-9+ ()-]+$' THEN false
 WHEN p_mode='international' AND btrim(p_value) ~ '^\\+[1-9][0-9]{7,14}$' AND btrim(p_value) !~ '^\\+27' THEN true
 ELSE regexp_replace(CASE WHEN p_mode='international' AND btrim(p_value) LIKE '+27%' THEN '0'||substr(btrim(p_value),4) ELSE btrim(p_value) END,'[ ()-]','','g') ~ '^0(6[0-9]|7[1-9]|8[1-4])[0-9]{7}$' END;
$$;
REVOKE ALL ON FUNCTION public.valid_sa_mobile(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_sa_mobile(text,text) TO anon,authenticated,service_role;
ALTER TABLE public.orders ADD COLUMN checkout_revision integer NOT NULL DEFAULT 0, ADD COLUMN delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK(delivery_fee>=0), ADD COLUMN delivery_distance_km double precision, ADD COLUMN destination_latitude double precision, ADD COLUMN destination_longitude double precision;
CREATE TABLE private.payment_attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.orders(id),provider text NOT NULL CHECK(provider IN('payfast','ozow')),state text NOT NULL DEFAULT 'issued' CHECK(state IN('issued','pending','paid','cancelled_verified','failed_verified')),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX payment_attempts_order ON private.payment_attempts(order_id);
REVOKE ALL ON private.payment_attempts FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.new_checkout_validation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.customer_id IS NULL AND NOT public.valid_sa_mobile(NEW.guest_contact,'local') THEN RAISE EXCEPTION 'A valid 10-digit South African mobile number is required'; END IF;
 NEW.checkout_revision:=1; RETURN NEW; END $$;
CREATE TRIGGER new_checkout_validation BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.new_checkout_validation();
CREATE FUNCTION private.validate_vendor_mobile() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' AND NEW.contact_number IS NOT DISTINCT FROM OLD.contact_number THEN RETURN NEW; END IF;
 IF nullif(btrim(NEW.contact_number),'') IS NOT NULL AND NOT public.valid_sa_mobile(NEW.contact_number,'international') THEN RAISE EXCEPTION 'Enter a valid mobile number (local or explicit international format)'; END IF; RETURN NEW; END $$;
CREATE TRIGGER validate_vendor_mobile BEFORE INSERT OR UPDATE OF contact_number ON public.vendors FOR EACH ROW EXECUTE FUNCTION private.validate_vendor_mobile();
CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE old_step integer; new_step integer;
BEGIN
 IF NEW.status=OLD.status THEN RETURN NEW; END IF;
 IF OLD.status='pending_payment' AND NEW.status='cancelled' THEN RETURN NEW; END IF;
 IF OLD.status='cancelled'::public.order_status THEN RAISE EXCEPTION 'Cannot change status of a cancelled order'; END IF;
 IF OLD.status IN ('pending_payment'::public.order_status,'payment_submitted'::public.order_status) AND NEW.status='confirmed'::public.order_status THEN RETURN NEW; END IF;
 SELECT step INTO old_step FROM public.order_flow WHERE status=OLD.status;
 SELECT step INTO new_step FROM public.order_flow WHERE status=NEW.status;
 IF old_step IS NULL OR new_step IS NULL OR new_step<>old_step+1 THEN RAISE EXCEPTION 'Invalid status transition: % -> %',OLD.status,NEW.status; END IF;
 RETURN NEW;
END $function$
;
CREATE FUNCTION public.cancel_unpaid_order(p_order_id uuid,p_ticket_number text DEFAULT NULL,p_guest_contact text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%rowtype;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT private.active_account() THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable' USING ERRCODE='42501'; END IF;
 IF o.customer_id IS NOT NULL THEN IF auth.uid() IS DISTINCT FROM o.customer_id THEN RAISE EXCEPTION 'Order ownership required' USING ERRCODE='42501'; END IF;
 ELSIF nullif(btrim(p_guest_contact),'') IS NULL OR btrim(p_guest_contact) IS DISTINCT FROM btrim(o.guest_contact) OR upper(btrim(p_ticket_number)) IS DISTINCT FROM o.ticket_number THEN RAISE EXCEPTION 'Guest order proof required' USING ERRCODE='42501'; END IF;
 IF o.status='cancelled' THEN RETURN public.order_to_json(o); END IF;
 PERFORM 1 FROM public.order_suborders WHERE order_id=o.id ORDER BY id FOR UPDATE;
 IF o.status<>'pending_payment' OR EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=o.id AND (payment_status<>'unpaid' OR status<>'pending_payment')) OR EXISTS(SELECT 1 FROM public.payfast_itn_log WHERE order_id=o.id AND payment_status='COMPLETE') THEN RAISE EXCEPTION 'Payment cannot be cancelled; refresh order status'; END IF;
 IF o.checkout_revision=0 OR EXISTS(SELECT 1 FROM private.payment_attempts WHERE order_id=o.id AND state NOT IN('cancelled_verified','failed_verified')) THEN RAISE EXCEPTION 'A payment may be processing. Return to the order and contact support for provider reconciliation; no cancellation was made.'; END IF;
 UPDATE public.order_suborders SET status='cancelled' WHERE order_id=o.id;
 UPDATE public.orders SET status='cancelled' WHERE id=o.id RETURNING * INTO o;
 INSERT INTO private.business_audit(actor_id,action,record_id,reason) VALUES(auth.uid(),'customer_cancel_unpaid_order',o.id,'Explicit customer confirmation before any provider attempt');
 RETURN public.order_to_json(o);
END $$;
REVOKE ALL ON FUNCTION public.cancel_unpaid_order(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_unpaid_order(uuid,text,text) TO anon,authenticated;
CREATE TABLE private.gateway_settings(provider text PRIMARY KEY CHECK(provider IN('payfast','ozow')),enabled boolean NOT NULL DEFAULT false,ready boolean NOT NULL DEFAULT false,maintenance boolean NOT NULL DEFAULT false,notice text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid);
INSERT INTO private.gateway_settings(provider,enabled,ready) VALUES('payfast',false,true),('ozow',false,false);
REVOKE ALL ON private.gateway_settings FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.get_payment_gateways() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_agg(to_jsonb(g)-'updated_by' ORDER BY provider) FROM private.gateway_settings g $$;
REVOKE ALL ON FUNCTION public.get_payment_gateways() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payment_gateways() TO anon,authenticated,service_role;
CREATE FUNCTION public.admin_update_payment_gateway(p_provider text,p_enabled boolean,p_maintenance boolean,p_notice text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 IF length(coalesce(p_notice,''))>500 THEN RAISE EXCEPTION 'Notice must be at most 500 characters'; END IF;
 UPDATE private.gateway_settings SET enabled=p_enabled,maintenance=p_maintenance,notice=coalesce(p_notice,''),updated_at=now(),updated_by=auth.uid() WHERE provider=p_provider AND (NOT p_enabled OR ready);
 IF NOT FOUND THEN RAISE EXCEPTION 'Provider unavailable or not verified ready'; END IF;
 INSERT INTO private.business_audit(actor_id,action,reason,details) VALUES(auth.uid(),'gateway_settings','Administrator configuration',jsonb_build_object('provider',p_provider,'enabled',p_enabled,'maintenance',p_maintenance)); END $$;
REVOKE ALL ON FUNCTION public.admin_update_payment_gateway(text,boolean,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_update_payment_gateway(text,boolean,boolean,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.prepare_payfast_order(p_order_id uuid, p_caller_id uuid, p_guest_contact text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o public.orders%rowtype;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF p_caller_id IS NOT NULL THEN
  PERFORM 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=p_caller_id AND NOT p.suspended AND p.deleted_at IS NULL AND (p.role<>'vendor' OR EXISTS(SELECT 1 FROM public.vendors cv WHERE cv.id=p.vendor_id AND cv.owner_id=p.id AND cv.status<>'suspended' AND cv.archived_at IS NULL)) FOR SHARE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active customer account required' USING ERRCODE='42501'; END IF;
 END IF;
 IF o.customer_id IS NOT NULL THEN
  IF p_caller_id IS DISTINCT FROM o.customer_id THEN RAISE EXCEPTION 'Order ownership required' USING ERRCODE='42501'; END IF;
 ELSIF nullif(btrim(p_guest_contact),'') IS NULL OR btrim(p_guest_contact) IS DISTINCT FROM btrim(o.guest_contact) THEN
  RAISE EXCEPTION 'Guest order verification failed' USING ERRCODE='42501';
 END IF;
 IF o.status<>'pending_payment' THEN RAISE EXCEPTION 'Order is not awaiting payment'; END IF;
 PERFORM 1 FROM public.vendors v JOIN public.order_suborders s ON s.vendor_id=v.id WHERE s.order_id=o.id FOR SHARE OF v;
 PERFORM 1 FROM public.profiles p JOIN public.vendors v ON v.owner_id=p.id JOIN public.order_suborders s ON s.vendor_id=v.id WHERE s.order_id=o.id FOR SHARE OF p;
 IF NOT EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=o.id) OR EXISTS(
  SELECT 1 FROM public.order_suborders s LEFT JOIN public.vendors v ON v.id=s.vendor_id
  LEFT JOIN public.profiles p ON p.id=v.owner_id LEFT JOIN auth.users u ON u.id=p.id
  WHERE s.order_id=o.id AND (v.id IS NULL OR v.status<>'approved' OR v.archived_at IS NOT NULL OR p.id IS NULL OR p.suspended OR p.deleted_at IS NOT NULL OR u.id IS NULL OR s.status<>'pending_payment')) THEN
  RAISE EXCEPTION 'A vendor cannot currently fulfil this order. Contact support before paying.' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM private.gateway_settings WHERE provider='payfast' AND enabled AND ready AND NOT maintenance FOR SHARE) THEN RAISE EXCEPTION 'PayFast is currently unavailable'; END IF;
 INSERT INTO private.payment_attempts(order_id,provider) VALUES(o.id,'payfast');
 UPDATE public.orders SET payment_method='payfast' WHERE id=o.id;
 RETURN to_jsonb(o);
END $function$
;
CREATE TABLE private.delivery_settings(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,latitude double precision NOT NULL DEFAULT -29.721180 CHECK(latitude BETWEEN -90 AND 90),longitude double precision NOT NULL DEFAULT 31.071621 CHECK(longitude BETWEEN -180 AND 180),free_radius_km double precision,max_radius_km double precision,paid_fee numeric(12,2),max_accuracy_m integer NOT NULL DEFAULT 100 CHECK(max_accuracy_m BETWEEN 1 AND 1000),revision integer NOT NULL DEFAULT 1, CHECK(NOT enabled OR (free_radius_km IS NOT NULL AND max_radius_km IS NOT NULL AND paid_fee IS NOT NULL AND free_radius_km>=0 AND max_radius_km>=free_radius_km AND paid_fee>=0)));
INSERT INTO private.delivery_settings(singleton) VALUES(true);
REVOKE ALL ON private.delivery_settings FROM PUBLIC,anon,authenticated;
CREATE TABLE private.delivery_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid,guest_proof text,items_hash text NOT NULL,latitude double precision NOT NULL,longitude double precision NOT NULL,distance_km double precision NOT NULL,fee numeric(12,2) NOT NULL,revision integer NOT NULL,expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',used boolean NOT NULL DEFAULT false);
REVOKE ALL ON private.delivery_quotes FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.get_delivery_settings() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT to_jsonb(s) FROM private.delivery_settings s $$;
REVOKE ALL ON FUNCTION public.get_delivery_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_settings() TO anon,authenticated,service_role;
CREATE FUNCTION public.admin_update_delivery_settings(p_enabled boolean,p_latitude double precision,p_longitude double precision,p_free_radius_km double precision,p_max_radius_km double precision,p_paid_fee numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 OR p_latitude::text IN('NaN','Infinity','-Infinity') OR p_longitude::text IN('NaN','Infinity','-Infinity') OR p_free_radius_km IS NULL OR p_max_radius_km IS NULL OR p_paid_fee IS NULL OR p_free_radius_km<0 OR p_max_radius_km<p_free_radius_km OR p_paid_fee<0 OR p_max_radius_km>1000 OR p_paid_fee>10000 THEN RAISE EXCEPTION 'Valid confirmed origin, radii and fee are required'; END IF;
 UPDATE private.delivery_settings SET enabled=p_enabled,latitude=p_latitude,longitude=p_longitude,free_radius_km=p_free_radius_km,max_radius_km=p_max_radius_km,paid_fee=p_paid_fee,revision=revision+1;
 INSERT INTO private.business_audit(actor_id,action,reason,details) VALUES(auth.uid(),'delivery_settings','Administrator confirmed delivery policy',jsonb_build_object('enabled',p_enabled,'freeRadiusKm',p_free_radius_km,'maxRadiusKm',p_max_radius_km,'paidFee',p_paid_fee)); END $$;
REVOKE ALL ON FUNCTION public.admin_update_delivery_settings(boolean,double precision,double precision,double precision,double precision,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_update_delivery_settings(boolean,double precision,double precision,double precision,double precision,numeric) TO authenticated;
CREATE FUNCTION private.distance_km(a double precision,b double precision,c double precision,d double precision) RETURNS double precision LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT 6371.0088*2*asin(sqrt(least(1::double precision,greatest(0::double precision,power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2))))) $$;
REVOKE ALL ON FUNCTION private.distance_km(double precision,double precision,double precision,double precision) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.quote_delivery(p_destination jsonb,p_items jsonb,p_guest_contact text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.delivery_settings%rowtype;lat double precision;lng double precision;accuracy double precision;captured timestamptz;distance double precision;fee numeric;quote uuid;v record;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT private.active_account() THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT s FROM private.delivery_settings FOR SHARE;
 IF NOT s.enabled THEN RETURN jsonb_build_object('enabled',false); END IF;
 IF auth.uid() IS NULL AND NOT public.valid_sa_mobile(p_guest_contact,'local') THEN RAISE EXCEPTION 'Valid guest mobile required'; END IF;
 lat:=(p_destination->>'latitude')::double precision;lng:=(p_destination->>'longitude')::double precision;accuracy:=(p_destination->>'accuracy')::double precision;captured:=(p_destination->>'capturedAt')::timestamptz;
 IF lat IS NULL OR lng IS NULL OR accuracy IS NULL OR captured IS NULL OR lat NOT BETWEEN -90 AND 90 OR lng NOT BETWEEN -180 AND 180 OR accuracy<0 OR accuracy>s.max_accuracy_m OR accuracy::text IN('NaN','Infinity','-Infinity') OR captured<clock_timestamp()-interval '60 seconds' OR captured>clock_timestamp()+interval '10 seconds' THEN RAISE EXCEPTION 'Fresh accurate coordinates required. Retry location or contact support; free text is not a delivery quote.'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Cart required'; END IF;
 distance:=private.distance_km(s.latitude,s.longitude,lat,lng);
 IF distance>s.max_radius_km+1e-9 THEN RAISE EXCEPTION 'Destination outside supported delivery area'; END IF;
 FOR v IN SELECT DISTINCT x.latitude,x.longitude,x.delivery_radius,x.status FROM public.vendors x JOIN public.meals m ON m.vendor_id=x.id JOIN jsonb_array_elements(p_items) i ON m.id=(i->>'mealId')::uuid LOOP
 IF v.status<>'approved' OR v.latitude IS NULL OR v.longitude IS NULL OR v.latitude NOT BETWEEN -90 AND 90 OR v.longitude NOT BETWEEN -180 AND 180 OR v.delivery_radius IS NULL OR v.delivery_radius<=0 OR private.distance_km(v.latitude,v.longitude,lat,lng)>v.delivery_radius+1e-9 THEN RAISE EXCEPTION 'A vendor cannot deliver to this destination'; END IF; END LOOP;
 fee:=CASE WHEN distance<=s.free_radius_km+1e-9 THEN 0 ELSE s.paid_fee END;
 INSERT INTO private.delivery_quotes(customer_id,guest_proof,items_hash,latitude,longitude,distance_km,fee,revision) VALUES(auth.uid(),CASE WHEN auth.uid() IS NULL THEN md5(btrim(p_guest_contact)) END,md5(p_items::text),lat,lng,distance,fee,s.revision) RETURNING id INTO quote;
 RETURN jsonb_build_object('enabled',true,'id',quote,'distanceKm',distance,'fee',fee,'expiresInSeconds',300);
END $$;
REVOKE ALL ON FUNCTION public.quote_delivery(jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_delivery(jsonb,jsonb,text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION private.create_order_core(p_customer_id uuid, p_guest_name text, p_guest_contact text, p_guest_email text, p_delivery_date date, p_delivery_location text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_customer_id uuid := auth.uid();
  v_order_id uuid := gen_random_uuid();
  v_ticket text;
  v_total numeric(10,2);
  v_requested_count integer;
  v_priced_count integer;
  v_vendor_id uuid;
  v_suborder_id uuid;
BEGIN IF auth.uid() IS NOT NULL AND NOT private.active_account() THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
  if p_customer_id is not null and p_customer_id is distinct from auth.uid() then
    raise exception 'Customer identity does not match the current session';
  end if;

  if v_customer_id is not null and exists(select 1 from public.profiles where id=v_customer_id and suspended) then
    raise exception 'This account is suspended';
  end if;

  if v_customer_id is not null then
    p_guest_name := null;
    p_guest_contact := null;
    p_guest_email := null;
  else
    if nullif(trim(p_guest_name), '') is null then
      raise exception 'Guest name is required';
    end if;
    if nullif(trim(p_guest_contact), '') is null then
      raise exception 'Guest mobile number is required';
    end if;
  end if;

  if p_delivery_date is null then
    raise exception 'Delivery date is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;

  if nullif(trim(p_delivery_location), '') is null then raise exception 'Delivery location is required'; end if;
  if clock_timestamp() >= (((p_delivery_date - 1)::timestamp + interval '19 hours') at time zone 'Africa/Johannesburg') then
    raise exception 'Ordering has closed for this delivery date';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) x
    where jsonb_typeof(x) <> 'object' or coalesce(x->>'mealId','') = ''
      or coalesce(x->>'qty','') !~ '^[1-9][0-9]*$') then
    raise exception 'Every cart item requires a meal ID and positive whole-number quantity';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where (x->>'qty')::numeric > 2147483647) then
    raise exception 'Cart quantity is too large';
  end if;
  if (select count(*) <> count(distinct x->>'mealId') from jsonb_array_elements(p_items) x) then
    raise exception 'Combine duplicate meals into one cart item';
  end if;
  perform m.id from jsonb_array_elements(p_items) x
    join public.meals m on m.id=(x->>'mealId')::uuid
    join public.vendors v on v.id=m.vendor_id for share of m,v;

  select count(distinct (x->>'mealId')::uuid)
    into v_requested_count
  from jsonb_array_elements(p_items) x
  where nullif(x->>'mealId', '') is not null;

  if v_requested_count = 0 then
    raise exception 'Your cart contains no valid meals';
  end if;

  select count(distinct m.id)
    into v_priced_count
  from jsonb_array_elements(p_items) x
  join meals m on m.id = (x->>'mealId')::uuid
  join vendors v on v.id = m.vendor_id
  where m.available = true
    and v.status = 'approved'
    and (x->>'qty')::integer > 0
    and (m.available_days is null or cardinality(m.available_days)=0
      or extract(dow from p_delivery_date)::integer=any(m.available_days));

  if v_priced_count <> v_requested_count then
    raise exception 'One or more meals in your cart are no longer available';
  end if;

  select round(sum(m.price * (x->>'qty')::integer), 2)
    into v_total
  from jsonb_array_elements(p_items) x
  join meals m on m.id = (x->>'mealId')::uuid
  join vendors v on v.id = m.vendor_id
  where m.available = true and v.status = 'approved';

  v_ticket := 'OB-' || upper(substr(md5(v_order_id::text || clock_timestamp()::text), 1, 6));

  insert into orders (
    id, ticket_number, customer_id, guest_name, guest_contact, guest_email,
    delivery_date, delivery_location, status, total
  )
  values (
    v_order_id,
    v_ticket,
    v_customer_id,
    case when v_customer_id is null then trim(p_guest_name) else null end,
    case when v_customer_id is null then trim(p_guest_contact) else null end,
    case when v_customer_id is null then nullif(trim(p_guest_email), '') else null end,
    p_delivery_date,
    nullif(trim(p_delivery_location), ''),
    'pending_payment',
    v_total
  );

  for v_vendor_id in
    select m.vendor_id
    from jsonb_array_elements(p_items) x
    join meals m on m.id = (x->>'mealId')::uuid
    join vendors v on v.id = m.vendor_id
    where m.available = true and v.status = 'approved'
    group by m.vendor_id
  loop
    insert into order_suborders (order_id, vendor_id, status, payment_status, subtotal)
    select
      v_order_id,
      v_vendor_id,
      'pending_payment',
      'unpaid',
      round(sum(m.price * (x->>'qty')::integer), 2)
    from jsonb_array_elements(p_items) x
    join meals m on m.id = (x->>'mealId')::uuid
    where m.vendor_id = v_vendor_id
    returning id into v_suborder_id;

    insert into order_items (suborder_id, meal_id, meal_name, qty, price)
    select
      v_suborder_id,
      m.id,
      m.name,
      (x->>'qty')::integer,
      m.price
    from jsonb_array_elements(p_items) x
    join meals m on m.id = (x->>'mealId')::uuid
    where m.vendor_id = v_vendor_id;
  end loop;

  return order_to_json((select o from orders o where o.id = v_order_id));
end;
$function$
;
REVOKE ALL ON FUNCTION private.create_order_core(uuid,text,text,text,date,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.create_order_with_delivery(p_customer_id uuid,p_guest_name text,p_guest_contact text,p_guest_email text,p_delivery_date date,p_delivery_location text,p_items jsonb,p_quote_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.delivery_settings%rowtype;q private.delivery_quotes%rowtype;r jsonb;o public.orders%rowtype;
BEGIN
 SELECT * INTO STRICT s FROM private.delivery_settings FOR SHARE;
 IF s.enabled THEN
 SELECT * INTO q FROM private.delivery_quotes WHERE id=p_quote_id FOR UPDATE;
 IF NOT FOUND OR q.used OR q.expires_at<clock_timestamp() OR q.revision<>s.revision OR q.items_hash<>md5(p_items::text) OR q.customer_id IS DISTINCT FROM auth.uid() OR (auth.uid() IS NULL AND q.guest_proof IS DISTINCT FROM md5(btrim(p_guest_contact))) THEN RAISE EXCEPTION 'Delivery quote changed or expired. Review delivery before ordering.'; END IF;
 -- Requote at order time, including current vendor radius/coordinates and policy. No client fee/distance is trusted.
 PERFORM public.quote_delivery(jsonb_build_object('latitude',q.latitude,'longitude',q.longitude,'accuracy',0,'capturedAt',clock_timestamp()),p_items,p_guest_contact);
 END IF;
 r:=private.create_order_core(p_customer_id,p_guest_name,p_guest_contact,p_guest_email,p_delivery_date,p_delivery_location,p_items);
 IF s.enabled THEN UPDATE public.orders SET total=total+q.fee,delivery_fee=q.fee,delivery_distance_km=q.distance_km,destination_latitude=q.latitude,destination_longitude=q.longitude WHERE id=(r->>'id')::uuid;
 UPDATE private.delivery_quotes SET used=true WHERE id=q.id; END IF;
 SELECT * INTO o FROM public.orders WHERE id=(r->>'id')::uuid;
 RETURN public.order_to_json(o)||jsonb_build_object('delivery_fee',o.delivery_fee,'delivery_distance_km',o.delivery_distance_km);
END $$;
CREATE OR REPLACE FUNCTION public.create_order_from_cart(p_customer_id uuid,p_guest_name text,p_guest_contact text,p_guest_email text,p_delivery_date date,p_delivery_location text,p_items jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT public.create_order_with_delivery(p_customer_id,p_guest_name,p_guest_contact,p_guest_email,p_delivery_date,p_delivery_location,p_items,NULL) $$;
REVOKE ALL ON FUNCTION public.create_order_with_delivery(uuid,text,text,text,date,text,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_delivery(uuid,text,text,text,date,text,jsonb,uuid) TO anon,authenticated;
-- No Ozow confirmation or paid-subscription entitlement is enabled by this migration.
ALTER TABLE private.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.gateway_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.delivery_quotes ENABLE ROW LEVEL SECURITY;

-- Include delivery charges separately without rewriting historical sales or commissions.
CREATE OR REPLACE FUNCTION public.order_to_json(o orders)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select jsonb_build_object(
 'id',o.id,'ticket_number',o.ticket_number,'customer_id',o.customer_id,
 'guest_name',o.guest_name,'guest_contact',o.guest_contact,'guest_email',o.guest_email,
 'delivery_date',o.delivery_date,'delivery_location',o.delivery_location,'status',o.status,
 'total',o.total,'delivery_fee',o.delivery_fee,'delivery_distance_km',o.delivery_distance_km,'payment_method',o.payment_method,'created_at',o.created_at,
 'profiles',case when o.customer_id is not null then (select jsonb_build_object('name',p.name) from profiles p where p.id=o.customer_id) else null end,
 'order_suborders',coalesce((select jsonb_agg(jsonb_build_object(
   'id',so.id,'vendor_id',so.vendor_id,'vendors',jsonb_build_object('name',v.name),
   'status',so.status,'payment_status',so.payment_status,'subtotal',so.subtotal,
   'collection_time',so.collection_time,'notes',so.notes,
   'order_items',coalesce((select jsonb_agg(jsonb_build_object('meal_id',oi.meal_id,'meal_name',oi.meal_name,'qty',oi.qty,'price',oi.price) order by oi.id) from order_items oi where oi.suborder_id=so.id),'[]'::jsonb)
 ) order by so.id) from order_suborders so join vendors v on v.id=so.vendor_id where so.order_id=o.id),'[]'::jsonb)
 ) $function$
;
CREATE OR REPLACE FUNCTION public.get_financial_report(p_vendor_id uuid DEFAULT NULL::uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r jsonb;
BEGIN IF auth.uid() IS NOT NULL AND NOT private.active_account() THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
 IF NOT private.is_admin() AND (p_vendor_id IS NULL OR p_vendor_id IS DISTINCT FROM private.current_vendor_id()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>p_to THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 WITH all_sales AS(SELECT s.*,round(order_fee*gross/nullif(sum(gross) OVER(PARTITION BY order_id),0),2) provisional_fee,
  row_number() OVER(PARTITION BY order_id ORDER BY suborder_id) rn FROM private.financial_sales s),
 allocated AS(SELECT s.*,CASE WHEN rn=1 THEN order_fee-sum(provisional_fee) OVER(PARTITION BY order_id)+provisional_fee ELSE provisional_fee END processor_fee FROM all_sales s),
 sales AS(SELECT * FROM allocated WHERE(p_vendor_id IS NULL OR vendor_id=p_vendor_id) AND(p_from IS NULL OR financial_date>=p_from) AND(p_to IS NULL OR financial_date<=p_to)),
 categories AS(SELECT coalesce(oi.category_snapshot,'Unknown (historical)') category,sum(oi.qty) units,sum(oi.qty*oi.price) revenue FROM sales s JOIN public.order_items oi ON oi.suborder_id=s.suborder_id GROUP BY 1),
 meals AS(SELECT coalesce(oi.meal_id::text,'deleted:'||oi.meal_name) meal_key,oi.meal_name name,sum(oi.qty) units,sum(oi.qty*oi.price) revenue FROM sales s JOIN public.order_items oi ON oi.suborder_id=s.suborder_id GROUP BY 1,2),
 weeks AS(SELECT date_trunc('week',financial_date::timestamp)::date week,sum(gross) gmv,CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE sum(commission) END "grossCommission" FROM sales GROUP BY 1),
 vendors AS(SELECT vendor_id "vendorId",vendor_name name,count(*) orders,sum(gross) gmv,CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE sum(commission) END "grossCommission" FROM sales GROUP BY 1,2)
 SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY financial_date,suborder_id) FROM sales s),'[]'),
 'totals',(SELECT jsonb_build_object('gmv',coalesce(sum(gross),0),'paidOrders',count(DISTINCT order_id),'suborders',count(*),'unresolvedCommission',count(*) FILTER(WHERE commission IS NULL),
  'grossCommission',CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE coalesce(sum(commission),0) END,
  'vendorEarnings',CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE coalesce(sum(vendor_earnings),0) END,
  'processorFees',coalesce(sum(processor_fee),0),'netMarketplaceRevenue',CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE CASE (SELECT fee_policy FROM private.finance_settings) WHEN 'platform_absorbs' THEN coalesce(sum(commission),0)-coalesce(sum(processor_fee),0) WHEN 'vendor_proportional' THEN coalesce(sum(commission),0) ELSE NULL END END,
  'averageOrderValue',coalesce(sum(gross)/nullif(count(DISTINCT order_id),0),0)) FROM sales),
 'categories',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY units DESC) FROM categories c),'[]'),
 'meals',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY units DESC) FROM meals m),'[]'),
 'weekly',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY week) FROM weeks w),'[]'),
 'topVendors',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY gmv DESC) FROM vendors v),'[]'),
 'reconciliation',CASE WHEN private.is_admin() THEN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM(
  SELECT s.order_id,o.ticket_number,o.total "recordedOrderTotal",o.delivery_fee "deliveryFee",sum(s.gross) "eligibleBusinessGross",
   (SELECT coalesce(sum(subtotal),0) FROM public.order_suborders WHERE order_id=s.order_id) "allSuborderGross",
   (SELECT coalesce(sum(amount_gross),0) FROM public.payfast_itn_log WHERE order_id=s.order_id AND payment_status='COMPLETE') "recordedCompletePayments",
   (SELECT count(*) FROM public.payfast_itn_log WHERE order_id=s.order_id AND payment_status='COMPLETE') "completePaymentCount",
   o.total-o.delivery_fee-(SELECT coalesce(sum(subtotal),0) FROM public.order_suborders WHERE order_id=s.order_id) "orderAmountDifference"
   FROM sales s JOIN public.orders o ON o.id=s.order_id GROUP BY s.order_id,o.id) x),'[]'::jsonb) ELSE '[]'::jsonb END,
 'from',p_from,'to',p_to,'timezone','Africa/Johannesburg','feePolicy',(SELECT fee_policy FROM private.finance_settings),
 'customers',(SELECT count(*) FROM public.profiles WHERE role='customer' AND NOT suspended),'activeVendors',(SELECT count(*) FROM public.vendors WHERE status='approved'),
 'pendingVendors',(SELECT count(*) FROM public.vendors WHERE status='pending'),
 'ordersToday',(SELECT count(*) FROM public.orders WHERE NOT is_test AND(created_at AT TIME ZONE 'Africa/Johannesburg')::date=(now() AT TIME ZONE 'Africa/Johannesburg')::date)) INTO r;
 RETURN r;
END $function$
;

COMMIT;
