-- Native staging only. All synthetic rows, gateway changes and test catalogue roll back.
BEGIN;
DO $qa$ DECLARE a uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); vid uuid; meal uuid:=gen_random_uuid();
 o jsonb; attempt jsonb; tx jsonb; report jsonb; subscription uuid; result jsonb; n integer:=0; failed boolean; failure text;
BEGIN
 BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true); PERFORM set_config('request.jwt.claim.sub','',true);
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 (a,'ozow-qa-'||a||'@example.invalid','{"role":"customer","name":"Synthetic admin"}'),
 (v,'ozow-qa-'||v||'@example.invalid','{"role":"vendor","name":"Synthetic vendor","business_name":"Synthetic Ozow QA","business_category":"Meals"}');
 UPDATE public.profiles SET role='admin' WHERE id=a;
 SELECT vendor_id INTO STRICT vid FROM public.profiles WHERE id=v;
 UPDATE public.vendors SET status='approved',commission_rate=0.17 WHERE id=vid;
 INSERT INTO public.meals(id,vendor_id,name,category,price,available) VALUES(meal,vid,'Synthetic Ozow meal','Meals',100,true);
 UPDATE private.delivery_settings SET enabled=false;
 o:=public.create_order_from_cart(NULL,'Synthetic guest','0821234567',NULL,current_date+7,'Synthetic',jsonb_build_array(jsonb_build_object('mealId',meal,'qty',1)));
 failed:=false;BEGIN PERFORM public.begin_ozow_attempt((o->>'id')::uuid,NULL,'0821234567','SYN-TEST-001','staging');EXCEPTION WHEN OTHERS THEN failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Disabled gateway accepted';END IF;n:=n+1;
 UPDATE private.gateway_settings SET enabled=true,ready=true WHERE provider='ozow';
 attempt:=public.begin_ozow_attempt((o->>'id')::uuid,NULL,'0821234567','SYN-TEST-001','staging');n:=n+1;
 failed:=false;BEGIN PERFORM public.prepare_payfast_order((o->>'id')::uuid,NULL,'0821234567');EXCEPTION WHEN OTHERS THEN failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Cross-provider retry accepted';END IF;n:=n+1;
 tx:=jsonb_build_object('id',gen_random_uuid(),'status','Successful','siteCode','SYN-TEST-001','merchantReference',attempt->>'reference','amount',jsonb_build_object('currency','ZAR','value',100));
 failed:=false;BEGIN PERFORM public.record_ozow_transaction(jsonb_set(tx,'{amount,value}','101'),'staging','msg_wrong');EXCEPTION WHEN OTHERS THEN failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Wrong amount accepted';END IF;n:=n+1;
 result:=public.record_ozow_transaction(tx,'staging','msg_'||(tx->>'id'));
 IF NOT (result->>'applied')::boolean THEN RAISE EXCEPTION 'Synthetic confirmation not applied';END IF;n:=n+1;
 IF NOT EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=(o->>'id')::uuid AND commission_amount=17 AND payment_status='paid') THEN RAISE EXCEPTION 'Commission snapshot changed';END IF;n:=n+1;
 IF NOT (public.record_ozow_transaction(tx,'staging','duplicate_'||(tx->>'id'))->>'duplicate')::boolean THEN RAISE EXCEPTION 'Duplicate credit';END IF;n:=n+1;
 IF EXISTS(SELECT 1 FROM public.payfast_itn_log WHERE order_id=(o->>'id')::uuid) THEN RAISE EXCEPTION 'Fabricated PayFast receipt';END IF;n:=n+1;
 PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('request.jwt.claim.sub',a::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 report:=public.get_financial_report(NULL,NULL,NULL);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(report->'reconciliation') r WHERE r->>'order_id'=o->>'id' AND (r->>'recordedCompletePayments')::numeric=100 AND (r->>'orderAmountDifference')::numeric=0) THEN RAISE EXCEPTION 'Provider reconciliation failed';END IF;n:=n+1;
 IF report#>>'{totals,processorFees}' IS NOT NULL THEN RAISE EXCEPTION 'Unknown fee guessed';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.role','service_role',true);
 INSERT INTO private.subscription_plans VALUES('synthetic-'||a,200,'ZAR',30,'{"testOnly":true}','Synthetic policy only',true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('request.jwt.claim.sub',v::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 subscription:=public.request_vendor_subscription(vid,'synthetic-'||a);
 failed:=false;BEGIN PERFORM public.record_subscription_payment(subscription,'SYNTHETIC-'||subscription,200,'ZAR');EXCEPTION WHEN insufficient_privilege THEN failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Vendor forged receipt';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.role','service_role',true);
 PERFORM public.record_subscription_payment(subscription,'SYNTHETIC-'||subscription,200,'ZAR');
 PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('request.jwt.claim.sub',v::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 result:=public.get_vendor_subscription(vid)->0;
 IF result->>'state'<>'paid_pending_approval' OR (result->>'eligible')::boolean THEN RAISE EXCEPTION 'Premature benefits';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub',a::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM public.admin_decide_subscription(subscription,true,'Synthetic approval');
 IF NOT (public.get_vendor_subscription(vid)->0->>'eligible')::boolean THEN RAISE EXCEPTION 'Approved synthetic eligibility failed';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';UPDATE public.profiles SET suspended=true WHERE id=v;
 IF (public.get_vendor_subscription(vid)->0->>'eligible')::boolean THEN RAISE EXCEPTION 'Suspension bypass';END IF;n:=n+1;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN('private.ozow_attempts'::regclass,'private.ozow_receipts'::regclass,'private.ozow_deliveries'::regclass,'private.subscription_plans'::regclass,'private.vendor_subscriptions'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'RLS missing';END IF;n:=n+1;
 IF has_table_privilege('authenticated','private.ozow_receipts','INSERT') OR has_function_privilege('anon','public.record_ozow_transaction(jsonb,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Receipt privilege leak';END IF;n:=n+1;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS failure=MESSAGE_TEXT; END;
 EXECUTE 'RESET ROLE';PERFORM set_config('officebites.ozow_qa_result',jsonb_build_object('assertions',n,'passed',failure IS NULL,'failure',failure,'fixtures','synthetic; outer transaction rolls back')::text,true);
END $qa$;
SELECT current_setting('officebites.ozow_qa_result')::jsonb native_ozow_result;
ROLLBACK;
