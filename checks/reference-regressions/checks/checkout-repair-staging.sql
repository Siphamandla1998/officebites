-- Native staging repair test. All accounts/orders/images/events are synthetic;
-- no gateway HTTP calls, all changes roll back, no existing account is modified.
BEGIN;
DO $qa$
#variable_conflict use_variable
DECLARE customer uuid:=gen_random_uuid(); other_customer uuid:=gen_random_uuid(); administrator uuid:=gen_random_uuid(); owner1 uuid:=gen_random_uuid(); owner2 uuid:=gen_random_uuid();
 v1 uuid;v2 uuid;orphan uuid:=gen_random_uuid();m1 uuid:=gen_random_uuid();m2 uuid:=gen_random_uuid();mo uuid:=gen_random_uuid();
 cart jsonb;o jsonb;guest jsonb;failure text;failed boolean;n integer:=0;counted integer;phase text;checkout_code text;
 original_ids uuid[];before_hash text;after_hash text;paid_hash text;
BEGIN
 BEGIN
 IF (SELECT enabled FROM private.delivery_settings) OR (SELECT acquisition_enabled OR standard_breakdown_enabled OR onboarding_enforced FROM private.commercial_settings) THEN RAISE EXCEPTION 'Unexpected feature activation; do not run fixtures';END IF;
 SELECT array_agg(id),md5(coalesce(jsonb_agg(jsonb_build_array(id,commission_amount,commission_rate_snapshot,paid_at,delivery_snapshot) ORDER BY id)::text,'')) INTO original_ids,before_hash FROM public.order_suborders;
 PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','service_role',true);
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 (customer,'repair-qa-'||customer||'@example.invalid','{"role":"customer","name":"Synthetic repair customer"}'),
 (other_customer,'repair-qa-'||other_customer||'@example.invalid','{"role":"customer","name":"Synthetic unrelated customer"}'),
 (administrator,'repair-qa-'||administrator||'@example.invalid','{"role":"customer","name":"Synthetic repair admin"}'),
 (owner1,'repair-qa-'||owner1||'@example.invalid','{"role":"vendor","name":"Synthetic repair vendor 1","business_name":"Synthetic repair vendor 1","business_category":"Meals"}'),
 (owner2,'repair-qa-'||owner2||'@example.invalid','{"role":"vendor","name":"Synthetic repair vendor 2","business_name":"Synthetic repair vendor 2","business_category":"Meals"}');
 UPDATE public.profiles SET role='admin' WHERE id=administrator;
 SELECT vendor_id INTO STRICT v1 FROM public.profiles WHERE id=owner1;SELECT vendor_id INTO STRICT v2 FROM public.profiles WHERE id=owner2;
 UPDATE public.vendors SET status='approved' WHERE id IN(v1,v2);
 INSERT INTO public.meals(id,vendor_id,name,category,price,available,available_days) VALUES(m1,v1,'Synthetic repair meal 1','Meals',70,true,NULL),(m2,v2,'Synthetic repair meal 2','Meals',40,true,NULL);
 INSERT INTO public.vendors(id,name,category,status) VALUES(orphan,'Synthetic ownerless vendor','Meals','approved');
 INSERT INTO public.meals(id,vendor_id,name,category,price,available,available_days) VALUES(mo,orphan,'Synthetic ownerless meal','Meals',10,true,NULL);
 cart:=jsonb_build_array(jsonb_build_object('mealId',m1,'qty',1),jsonb_build_object('mealId',m2,'qty',1));
 PERFORM set_config('request.jwt.claim.sub',customer::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);EXECUTE 'SET LOCAL ROLE authenticated';
 o:=public.create_order_from_cart(customer,NULL,NULL,NULL,current_date+7,'Synthetic repair workplace',cart);
 IF o->>'status'<>'pending_payment' OR (o->>'total')::numeric<>110 THEN RAISE EXCEPTION 'Member order initial state/total mismatch';END IF;n:=n+1;
 SELECT count(*) INTO counted FROM public.orders ord LEFT JOIN public.profiles p ON p.id=ord.customer_id LEFT JOIN public.order_suborders so ON so.order_id=ord.id LEFT JOIN public.vendors v ON v.id=so.vendor_id LEFT JOIN public.order_items oi ON oi.suborder_id=so.id WHERE ord.id=(o->>'id')::uuid;
 IF counted<>2 THEN RAISE EXCEPTION 'Nested member order history failed';END IF;n:=n+1;
 failed:=false;BEGIN PERFORM public.create_order_from_cart(other_customer,NULL,NULL,NULL,current_date+7,'Synthetic',cart);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%identity%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Forged customer accepted';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub',other_customer::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO counted FROM public.orders WHERE id=(o->>'id')::uuid;IF counted<>0 THEN RAISE EXCEPTION 'Unrelated customer can read order';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub',owner1::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO counted FROM public.order_suborders WHERE order_id=(o->>'id')::uuid;IF counted<>1 THEN RAISE EXCEPTION 'Vendor sees another vendor suborder';END IF;n:=n+1;
 failed:=false;BEGIN PERFORM public.update_suborder_status_and_notify((o->>'id')::uuid,'accepted');EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT ILIKE '%paid%' AND SQLERRM NOT ILIKE '%payment%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Unpaid fulfilment accepted';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','anon',true);EXECUTE 'SET LOCAL ROLE anon';
 SELECT count(*) INTO counted FROM public.vendors WHERE id=orphan;IF counted<>0 THEN RAISE EXCEPTION 'Ownerless vendor exposed in catalogue';END IF;n:=n+1;
 SELECT count(*) INTO counted FROM public.meals WHERE id=mo;IF counted<>0 THEN RAISE EXCEPTION 'Ownerless meals exposed in catalogue';END IF;n:=n+1;
 guest:=public.create_order_from_cart(NULL,'Synthetic guest','0821234567',NULL,current_date+7,'Synthetic repair guest',jsonb_build_array(jsonb_build_object('mealId',m1,'qty',1)));
 IF guest->>'status'<>'pending_payment' THEN RAISE EXCEPTION 'Guest order initial status mismatch';END IF;n:=n+1;
 failed:=false;BEGIN PERFORM public.create_order_from_cart(NULL,'Synthetic guest','0821234567',NULL,current_date+7,'Synthetic',jsonb_build_array(jsonb_build_object('mealId',mo,'qty',1)));EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Active approved vendor required for fulfilment%' THEN RAISE;END IF;GET STACKED DIAGNOSTICS checkout_code=RETURNED_SQLSTATE;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Ownerless vendor checkout accepted';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.role','service_role',true);
 failed:=false;BEGIN UPDATE public.vendors SET logo='blob:https://old-preview.vercel.app/synthetic' WHERE id=v1;EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%temporary image URLs%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Persisted blob accepted';END IF;n:=n+1;
 UPDATE public.meals SET available=false WHERE id=m1;
 failed:=false;BEGIN PERFORM public.create_order_from_cart(NULL,'Synthetic guest','0821234567',NULL,current_date+7,'Synthetic',jsonb_build_array(jsonb_build_object('mealId',m1,'qty',1)));EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%no longer available%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Unavailable meal accepted';END IF;n:=n+1;
 UPDATE public.meals SET available=true WHERE id=m1;UPDATE public.vendors SET status='rejected' WHERE id=v1;
 failed:=false;BEGIN PERFORM public.create_order_from_cart(NULL,'Synthetic guest','0821234567',NULL,current_date+7,'Synthetic',jsonb_build_array(jsonb_build_object('mealId',m1,'qty',1)));EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%no longer available%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Rejected vendor accepted';END IF;n:=n+1;
 UPDATE public.vendors SET status='approved' WHERE id=v1;
 PERFORM public.confirm_payfast_payment((o->>'id')::uuid,'SYNTHETIC-REPAIR-'||(o->>'id'),o->>'ticket_number',110,'COMPLETE','{"amount_fee":"-2.30"}');
 SELECT md5(jsonb_agg(jsonb_build_array(id,commission_amount,commission_rate_snapshot,paid_at,delivery_snapshot) ORDER BY id)::text) INTO paid_hash FROM public.order_suborders WHERE order_id=(o->>'id')::uuid;
 PERFORM set_config('request.jwt.claim.sub',owner1::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);EXECUTE 'SET LOCAL ROLE authenticated';
 failed:=false;BEGIN PERFORM public.update_suborder_status_and_notify((o->>'id')::uuid,'completed');EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT ILIKE '%transition%' AND SQLERRM NOT ILIKE '%step%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Premature completion accepted';END IF;n:=n+1;
 FOREACH phase IN ARRAY ARRAY['accepted','preparing','ready','collected','completed'] LOOP PERFORM public.update_suborder_status_and_notify((o->>'id')::uuid,phase);END LOOP;
 EXECUTE 'RESET ROLE';SELECT status::text INTO phase FROM public.orders WHERE id=(o->>'id')::uuid;IF phase<>'confirmed' THEN RAISE EXCEPTION 'First vendor prematurely completed aggregate order';END IF;n:=n+1;
 PERFORM set_config('request.jwt.claim.sub',owner2::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 FOREACH phase IN ARRAY ARRAY['accepted','preparing','ready','collected','completed'] LOOP PERFORM public.update_suborder_status_and_notify((o->>'id')::uuid,phase);END LOOP;
 EXECUTE 'RESET ROLE';SELECT status::text INTO phase FROM public.orders WHERE id=(o->>'id')::uuid;IF phase<>'completed' THEN RAISE EXCEPTION 'Both fulfilled vendors did not complete order';END IF;n:=n+1;
 PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','service_role',true);
 PERFORM public.confirm_payfast_payment((o->>'id')::uuid,'SYNTHETIC-REPAIR-'||(o->>'id'),o->>'ticket_number',110,'COMPLETE','{"amount_fee":"-2.30"}');
 IF paid_hash IS DISTINCT FROM (SELECT md5(jsonb_agg(jsonb_build_array(id,commission_amount,commission_rate_snapshot,paid_at,delivery_snapshot) ORDER BY id)::text) FROM public.order_suborders WHERE order_id=(o->>'id')::uuid) THEN RAISE EXCEPTION 'Webhook replay changed financial/delivery snapshot';END IF;n:=n+1;
 SELECT md5(coalesce(jsonb_agg(jsonb_build_array(id,commission_amount,commission_rate_snapshot,paid_at,delivery_snapshot) ORDER BY id)::text,'')) INTO after_hash FROM public.order_suborders WHERE id=ANY(original_ids);
 IF before_hash IS DISTINCT FROM after_hash THEN RAISE EXCEPTION 'Historical snapshots changed';END IF;n:=n+1;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS failure=MESSAGE_TEXT;END;
 EXECUTE 'RESET ROLE';PERFORM set_config('officebites.qa_result',jsonb_build_object('passed',failure IS NULL,'assertions',n,'failure',failure,'expectedUnavailableVendorCode',checkout_code,'fixtures','synthetic; all changes roll back')::text,true);
END $qa$;
SELECT current_setting('officebites.qa_result')::jsonb native_repair_result;
ROLLBACK;
