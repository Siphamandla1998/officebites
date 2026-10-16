-- Native staging only. Synthetic accounts/documents; all changes roll back.
BEGIN;
DO $qa$
#variable_conflict use_variable
DECLARE admin_id uuid:=gen_random_uuid(); customer_id uuid:=gen_random_uuid(); vendor_user uuid:=gen_random_uuid(); bad_user uuid:=gen_random_uuid();
 doc uuid; docs jsonb:='{}'; kind text; vendor_id uuid; account jsonb; offer jsonb; portal jsonb; accepted uuid; failed boolean; n integer:=0; failure text;
 buyer uuid:=gen_random_uuid(); meal uuid:=gen_random_uuid(); o jsonb; entry uuid; status text; i integer; total numeric;
BEGIN
 BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);PERFORM set_config('request.jwt.claim.sub','',true);
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(admin_id,'legal-qa-'||admin_id||'@example.invalid','{"role":"customer","name":"SYNTHETIC LEGAL ADMIN"}'),(customer_id,'legal-qa-'||customer_id||'@example.invalid','{"role":"customer","name":"SYNTHETIC LEGAL CUSTOMER"}');
 UPDATE public.profiles SET role='admin' WHERE id=admin_id;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);EXECUTE 'SET LOCAL ROLE authenticated';
 portal:=public.get_legal_portal();IF (portal->>'acquisitionEnabled')::boolean OR (portal->>'standardBreakdownEnabled')::boolean THEN RAISE EXCEPTION 'Commercial charging unexpectedly active';END IF;n:=n+1;
 PERFORM public.admin_commercial_action('business','{"businessAddress":"SYNTHETIC ROLLBACK ONLY","legalNoticeAddress":"SYNTHETIC ROLLBACK ONLY","vatTreatment":"SYNTHETIC TEST NOT A TAX ELECTION","informationOfficer":"Synthetic officer","informationOfficerContact":"synthetic@example.invalid"}');
 FOREACH kind IN ARRAY ARRAY['terms','privacy','refund-policy','vendor-agreement','vendor-fees'] LOOP
 doc:=(public.admin_commercial_action('document',jsonb_build_object('kind',kind,'version','synthetic-'||gen_random_uuid(),'title','SYNTHETIC TEST DOCUMENT','content','SYNTHETIC TEST ONLY - not approved legal content. This transaction and all fixtures roll back.','effective_at',now()-interval '1 day'))->>'id')::uuid;
 PERFORM public.admin_commercial_action('approve_document',jsonb_build_object('id',doc,'approvalReference','SYNTHETIC TEST APPROVAL WITHIN ROLLBACK'));
 docs:=docs||jsonb_build_object(kind,doc);
 END LOOP;n:=n+1;
 PERFORM public.admin_commercial_action('onboarding',jsonb_build_object('enabled',true,'documents',docs));
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','service_role',true);
 failed:=false;BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(bad_user,'legal-qa-'||bad_user||'@example.invalid','{"role":"vendor","name":"SYNTHETIC FORGED VENDOR","business_name":"SYNTHETIC","business_category":"Meals"}');
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%documents%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Signup bypassed mandatory consent'; END IF;n:=n+1;
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(vendor_user,'legal-qa-'||vendor_user||'@example.invalid',jsonb_build_object('role','vendor','name','SYNTHETIC CONSENT VENDOR','business_name','SYNTHETIC CONSENT VENDOR','business_category','Meals','vendor_consent',jsonb_build_object('documents',docs,'acknowledgements','[true,true,true,true,true,true,true,true]'::jsonb)));
 SELECT p.vendor_id INTO STRICT vendor_id FROM public.profiles p WHERE p.id=vendor_user;
 SELECT id INTO accepted FROM private.vendor_legal_acceptances WHERE actor_id=vendor_user AND vendor_legal_acceptances.vendor_id=vendor_id;
 IF accepted IS NULL THEN RAISE EXCEPTION 'Signup acceptance not recorded';END IF;n:=n+1;
 UPDATE public.vendors SET status='approved' WHERE id=vendor_id;
 failed:=false;BEGIN UPDATE private.vendor_legal_acceptances SET fee_version='forged' WHERE id=accepted;EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Immutable%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Acceptance evidence mutable';END IF;n:=n+1;
 PERFORM set_config('request.jwt.claim.sub',customer_id::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);EXECUTE 'SET LOCAL ROLE authenticated';
 failed:=false;BEGIN PERFORM public.admin_commercial_action('business','{}');EXCEPTION WHEN insufficient_privilege THEN failed:=true;WHEN OTHERS THEN IF SQLERRM NOT LIKE '%administrator%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Customer admin escalation';END IF;n:=n+1;
 failed:=false;BEGIN PERFORM public.become_vendor('SYNTHETIC UPGRADE','Meals',NULL);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%documents%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Upgrade bypassed consent';END IF;n:=n+1;
 PERFORM public.prepare_vendor_consent(docs,'[true,true,true,true,true,true,true,true]');
 PERFORM public.become_vendor('SYNTHETIC UPGRADE','Meals',NULL);n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 account:=public.admin_commercial_action('account',jsonb_build_object('name','SYNTHETIC WORKPLACE','internal_identifier','synthetic-'||gen_random_uuid(),'status','active'));
 offer:=public.admin_commercial_action('offer',jsonb_build_object('account_id',account->>'id','vendor_id',vendor_id,'document_id',docs->>'vendor-agreement','starts_at',now(),'ends_at',now()+interval '12 weeks'));n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub',vendor_user::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM public.respond_corporate_agreement((offer->>'id')::uuid,true);n:=n+1;
 portal:=public.get_commercial_workspace();IF jsonb_array_length(portal->'accounts')<>0 OR jsonb_array_length(portal->'memberships')<>0 THEN RAISE EXCEPTION 'Vendor exposed admin-only CRM';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 failed:=false;BEGIN PERFORM public.admin_commercial_action('activate',jsonb_build_object('id',offer->>'id'));EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%disabled%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Incomplete settlement activated';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','anon',true);EXECUTE 'SET LOCAL ROLE anon';
 portal:=public.get_legal_portal();IF portal->'documents'->'terms'->>'id' IS DISTINCT FROM docs->>'terms' THEN RAISE EXCEPTION 'Public approved version missing';END IF;n:=n+1;
 failed:=false;BEGIN PERFORM public.get_commercial_workspace();EXCEPTION WHEN insufficient_privilege THEN failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Anonymous commercial access';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','service_role',true);
 -- Test-only bypass of hard activation interlocks. DDL and all fixtures roll back.
 ALTER TABLE private.commercial_settings DROP CONSTRAINT commercial_settings_acquisition_enabled_check;
 ALTER TABLE private.commercial_settings DROP CONSTRAINT commercial_settings_standard_breakdown_enabled_check;
 UPDATE private.commercial_settings SET acquisition_enabled=true,standard_breakdown_enabled=true,onboarding_enforced=false;
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(buyer,'legal-qa-'||buyer||'@example.invalid','{"role":"customer","name":"SYNTHETIC CORPORATE BUYER"}');
 INSERT INTO public.meals(id,vendor_id,name,category,price,available,available_days) VALUES(meal,vendor_id,'SYNTHETIC CORPORATE MEAL','Meals',70,true,NULL);
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM public.admin_commercial_action('membership',jsonb_build_object('account_id',account->>'id','customer_id',buyer,'evidence','SYNTHETIC independently verified membership'));
 EXECUTE 'RESET ROLE';
 UPDATE private.corporate_agreements SET status='active' WHERE id=(offer->>'id')::uuid;
 FOR i IN 1..120 LOOP
 PERFORM set_config('request.jwt.claim.sub',buyer::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);EXECUTE 'SET LOCAL ROLE authenticated';
 o:=public.create_order_from_cart(buyer,NULL,NULL,NULL,current_date+7,'SYNTHETIC WORKPLACE',jsonb_build_array(jsonb_build_object('mealId',meal,'qty',1)));
 EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','service_role',true);
 -- Simulates separate RPC transactions: now() is fixed at BEGIN in this rollback fixture.
 UPDATE public.orders SET created_at=clock_timestamp() WHERE id=(o->>'id')::uuid;
 PERFORM public.confirm_payfast_payment((o->>'id')::uuid,'SYNTHETIC-CORP-'||(o->>'id'),o->>'ticket_number',70,'COMPLETE','{"amount_fee":"-1"}');
 FOREACH status IN ARRAY ARRAY['accepted','preparing','ready','collected','completed'] LOOP
 UPDATE public.order_suborders SET status=status::public.order_status WHERE order_id=(o->>'id')::uuid;
 END LOOP;
 PERFORM private.record_acquisition((o->>'id')::uuid,vendor_id);
 END LOOP;
 SELECT sum(amount) INTO total FROM private.acquisition_ledger WHERE agreement_id=(offer->>'id')::uuid;
 IF total<>581 OR (SELECT count(*) FROM private.acquisition_ledger WHERE agreement_id=(offer->>'id')::uuid)<>120 THEN RAISE EXCEPTION 'Native acquisition totals/idempotency mismatch: %',total;END IF;n:=n+1;
 IF (SELECT sum(platform_amount) FROM private.standard_fee_ledger f JOIN public.order_suborders s ON s.id=f.suborder_id WHERE s.vendor_id=vendor_id)<>1260 THEN RAISE EXCEPTION 'Native 15 percent total mismatch';END IF;n:=n+1;
 IF (SELECT sum(internal_processing_amount) FROM private.standard_fee_ledger f JOIN public.order_suborders s ON s.id=f.suborder_id WHERE s.vendor_id=vendor_id)<>168 THEN RAISE EXCEPTION 'Native 2 percent total mismatch';END IF;n:=n+1;
 SELECT id INTO entry FROM private.acquisition_ledger WHERE agreement_id=(offer->>'id')::uuid AND position=120;
 PERFORM private.record_acquisition_refund(entry,'payfast','SYNTHETIC-REFUND-A',20);
 PERFORM private.record_acquisition_refund(entry,'payfast','SYNTHETIC-REFUND-A',20);
 PERFORM private.record_acquisition_refund(entry,'payfast','SYNTHETIC-REFUND-B',50);
 IF (SELECT sum(acquisition_credit) FROM private.commercial_refund_adjustments WHERE entry_id=entry)<>7 THEN RAISE EXCEPTION 'Native refund credits mismatch';END IF;n:=n+1;
 IF EXISTS(SELECT 1 FROM private.acquisition_ledger WHERE agreement_id=(offer->>'id')::uuid AND ((position=49 AND rate<>.05) OR (position IN(50,99) AND rate<>.075) OR (position=100 AND rate<>.10))) THEN RAISE EXCEPTION 'Native progressive boundary mismatch';END IF;n:=n+1;
 PERFORM set_config('request.jwt.claim.sub',vendor_user::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);EXECUTE 'SET LOCAL ROLE authenticated';
 portal:=public.get_commercial_report(NULL,NULL);
 IF (portal->'totals'->>'chargedOrders')::int<>120 OR (portal->'totals'->>'qualifyingOrders')::int<>119 OR (portal->'totals'->>'netAcquisitionFees')::numeric<>574 THEN RAISE EXCEPTION 'Native commercial report reconciliation mismatch';END IF;n:=n+1;
 IF (portal->'rows'->0) ? 'customer_id' THEN RAISE EXCEPTION 'Vendor report exposes customer identifiers';END IF;n:=n+1;
 EXECUTE 'RESET ROLE';failed:=false;BEGIN UPDATE private.corporate_agreements SET terms='{}' WHERE id=(offer->>'id')::uuid;EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%immutable%' THEN RAISE;END IF;failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Accepted commercial terms changed';END IF;n:=n+1;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS failure=MESSAGE_TEXT;
 END;
 EXECUTE 'RESET ROLE';PERFORM set_config('officebites.qa_result',jsonb_build_object('assertions',n,'passed',failure IS NULL,'failure',failure,'fixtures','synthetic; all rolled back')::text,true);
END $qa$;
SELECT current_setting('officebites.qa_result')::jsonb native_staging_result;
ROLLBACK;
