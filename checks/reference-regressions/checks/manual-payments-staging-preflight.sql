-- READ ONLY. Execute only against the independently verified project
-- eyhmarmekioovcjibcbr (officebites-staging). This file makes no settings changes.
WITH required(signature) AS (VALUES
 ('private.active_account()'),('private.is_admin()'),('private.current_vendor_id()'),
 ('private.create_order_core(uuid,text,text,text,date,text,jsonb)'),
 ('public.create_order_with_delivery(uuid,text,text,text,date,text,jsonb,uuid)'),
 ('public.create_order_from_cart(uuid,text,text,text,date,text,jsonb)'),
 ('public.cancel_unpaid_order(uuid,text,text)'),
 ('public.order_to_json(public.orders)'),
 ('public.confirm_payfast_payment(uuid,text,text,numeric,text,jsonb)'),
 ('public.begin_ozow_attempt(uuid,uuid,text,text,text)'),
 ('public.update_suborder_status_and_notify(uuid,text)')),
 checks AS (
 SELECT 'function:'||signature check_name,to_regprocedure(signature) IS NOT NULL passed FROM required
 UNION ALL SELECT 'gateway constraint',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='private.gateway_settings'::regclass AND conname='gateway_settings_provider_check')
 UNION ALL SELECT 'order method constraint',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_payment_method_check')
 UNION ALL SELECT 'financial source view',to_regclass('private.financial_sales') IS NOT NULL
 UNION ALL SELECT 'unapplied manual migration',to_regclass('private.manual_order_payments') IS NULL
 UNION ALL SELECT 'cancellation insertion point',strpos(pg_get_functiondef('public.cancel_unpaid_order(uuid,text,text)'::regprocedure),'IF o.status=''cancelled'' THEN RETURN public.order_to_json(o); END IF;')>0
 UNION ALL SELECT 'transition trigger scoped only to suborders',NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE p.proname='enforce_order_status_transition' AND NOT t.tgisinternal AND t.tgrelid<>'public.order_suborders'::regclass)
 UNION ALL SELECT 'Ozow remains off',EXISTS(SELECT 1 FROM private.gateway_settings WHERE provider='ozow' AND NOT enabled AND NOT ready)
 UNION ALL SELECT 'delivery enforcement remains off',EXISTS(SELECT 1 FROM private.delivery_settings WHERE NOT enabled)
 UNION ALL SELECT 'legacy proof upload remains revoked',NOT has_function_privilege('anon','public.submit_payment_proof(uuid,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.submit_payment_proof(uuid,text)','EXECUTE')
 UNION ALL SELECT 'commission snapshot columns',count(*)=3 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_suborders' AND column_name IN('commission_amount','commission_rate_snapshot','paid_at')
 UNION ALL SELECT 'order classification and delivery columns',count(*)=3 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name IN('is_test','checkout_revision','delivery_fee')
)
SELECT check_name,passed FROM checks ORDER BY check_name;
