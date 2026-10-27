-- Live OfficeBites: preserves the existing frontend RPC contracts.
REVOKE UPDATE ON public.order_suborders FROM authenticated;
REVOKE UPDATE (id, order_id, vendor_id, status, payment_status, subtotal, collection_time, notes) ON public.order_suborders FROM authenticated;
GRANT UPDATE (notes) ON public.order_suborders TO authenticated;

REVOKE UPDATE ON public.messages FROM authenticated;
REVOKE UPDATE (id, conversation_id, sender_id, text, read, created_at) ON public.messages FROM authenticated;
GRANT UPDATE (read) ON public.messages TO authenticated;

REVOKE UPDATE ON public.notifications FROM authenticated;
REVOKE UPDATE (id, user_id, type, title, body, read, dismissed, created_at, action_url, metadata) ON public.notifications FROM authenticated;
GRANT UPDATE (read, dismissed) ON public.notifications TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_suborder_status_and_notify(p_order_id uuid, p_next_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_vendor_id uuid := private.current_vendor_id();
  v_sub public.order_suborders%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_next public.order_status;
  v_parent public.order_status;
  v_vendor_name text;
  v_old_step integer;
  v_new_step integer;
BEGIN
  IF auth.uid() IS NULL OR v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized: current user is not a vendor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendors v JOIN public.profiles p ON p.id=auth.uid()
      WHERE v.id=v_vendor_id AND v.owner_id=auth.uid() AND v.status='approved'
      AND p.role='vendor' AND NOT p.suspended) THEN
    RAISE EXCEPTION 'An approved, active vendor account is required';
  END IF;
  -- All payment/status operations lock the parent first to serialize updates.
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  SELECT * INTO v_sub FROM public.order_suborders
    WHERE order_id=p_order_id AND vendor_id=v_vendor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Suborder not found for this vendor'; END IF;
  IF v_sub.payment_status <> 'paid' OR v_order.status NOT IN ('confirmed','accepted','preparing','ready','collected','completed') THEN
    RAISE EXCEPTION 'Payment must be verified before advancing an order';
  END IF;
  IF p_next_status IS NULL OR p_next_status NOT IN ('accepted','preparing','ready','collected','completed') THEN
    RAISE EXCEPTION 'Vendors may only advance fulfilment; payment confirmation is server-controlled';
  END IF;
  v_next := p_next_status::public.order_status;
  SELECT step INTO v_old_step FROM public.order_flow WHERE status=v_sub.status;
  SELECT step INTO v_new_step FROM public.order_flow WHERE status=v_next;
  IF v_old_step IS NULL OR v_new_step IS NULL OR v_new_step<>v_old_step+1 THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %',v_sub.status,v_next;
  END IF;
  UPDATE public.order_suborders SET status=v_next WHERE id=v_sub.id;
  -- The parent represents the least advanced vendor, even when vendors progress separately.
  SELECT so.status INTO v_parent FROM public.order_suborders so
    JOIN public.order_flow f ON f.status=so.status
    WHERE so.order_id=p_order_id ORDER BY f.step LIMIT 1;
  IF v_parent IS NOT NULL AND v_parent IS DISTINCT FROM v_order.status THEN
    UPDATE public.orders SET status=v_parent WHERE id=p_order_id;
  END IF;
  SELECT name INTO v_vendor_name FROM public.vendors WHERE id=v_vendor_id;
  IF v_order.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,type,title,body,action_url)
    VALUES(v_order.customer_id,'order_status',
      CASE p_next_status WHEN 'accepted' THEN 'Order accepted' WHEN 'preparing' THEN 'Order is being prepared'
        WHEN 'ready' THEN 'Order ready for collection' WHEN 'collected' THEN 'Order collected' ELSE 'Order completed' END,
      format('%s: %s (%s)',v_vendor_name,initcap(replace(p_next_status,'_',' ')),v_order.ticket_number),
      '/orders/'||p_order_id::text);
  END IF;
  RETURN jsonb_build_object('success',true,'status',v_next);
END $$;
REVOKE ALL ON FUNCTION public.update_suborder_status_and_notify(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_suborder_status_and_notify(uuid,text) TO authenticated;

-- Do not allow sending new messages into a closed order conversation.
DROP POLICY messages_participants_insert ON public.messages;
CREATE POLICY messages_participants_insert ON public.messages FOR INSERT TO authenticated
WITH CHECK (sender_id=(SELECT auth.uid()) AND read=false AND length(trim(text))>0
  AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=messages.conversation_id
    AND c.closed_at IS NULL
    AND (c.customer_id=(SELECT auth.uid()) OR c.vendor_id=(SELECT private.current_vendor_id()))));


CREATE OR REPLACE FUNCTION public.guard_vendor_privileged_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
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

CREATE OR REPLACE FUNCTION public.create_order_from_cart(p_customer_id uuid, p_guest_name text, p_guest_contact text, p_guest_email text, p_delivery_date date, p_delivery_location text, p_items jsonb)
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
begin
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
$function$;

CREATE OR REPLACE FUNCTION public.erase_old_conversations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not private.is_admin() then
    raise exception 'Not authorised to erase old conversations';
  end if;

  delete from conversations c
  where c.id in (
    select c2.id
    from conversations c2
    left join messages m on m.conversation_id = c2.id
    group by c2.id, c2.updated_at
    having coalesce(max(m.created_at), c2.updated_at) < now() - interval '5 days'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_vendor_dashboard_stats(p_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_vendor_id uuid;
  v_today_start timestamptz;
  v_week_start timestamptz;
  v_month_start timestamptz;

  v_todays_orders integer := 0;
  v_pending_orders integer := 0;
  v_confirmed_orders integer := 0;
  v_preparing_orders integer := 0;
  v_ready_orders integer := 0;
  v_delivered_orders integer := 0;
  v_total_orders integer := 0;

  v_todays_revenue numeric := 0;
  v_weekly_revenue numeric := 0;
  v_monthly_revenue numeric := 0;
  v_average_order_value numeric := 0;

  v_revenue_chart jsonb := '[]'::jsonb;
begin
  -- -------------------------------------------------------
  -- Security: only the currently authenticated vendor may
  -- request statistics for their own vendor account.
  -- Admins may also request vendor statistics.
  -- -------------------------------------------------------

  v_current_vendor_id := private.current_vendor_id();

  if not private.is_admin() then
    if v_current_vendor_id is null
       or p_vendor_id is null
       or v_current_vendor_id <> p_vendor_id then
      raise exception 'Not authorised to view vendor statistics';
    end if;
  end if;

  if p_vendor_id is null then
    raise exception 'Vendor ID is required';
  end if;

  v_today_start := date_trunc('day', now());
  v_week_start := date_trunc('week', now());
  v_month_start := date_trunc('month', now());

  -- -------------------------------------------------------
  -- Order counts for this vendor.
  -- These counts include the vendor's own suborders.
  -- -------------------------------------------------------

  select
    count(*) filter (
      where o.created_at >= v_today_start
    ),
    count(*) filter (
      where so.status = 'pending_payment'
    ),
    count(*) filter (
      where so.status = 'confirmed'
    ),
    count(*) filter (
      where so.status = 'preparing'
    ),
    count(*) filter (
      where so.status = 'ready'
    ),
    count(*) filter (
      where so.status in ('collected', 'completed')
    ),
    count(*)
  into
    v_todays_orders,
    v_pending_orders,
    v_confirmed_orders,
    v_preparing_orders,
    v_ready_orders,
    v_delivered_orders,
    v_total_orders
  from order_suborders so
  join orders o on o.id = so.order_id
  where so.vendor_id = p_vendor_id;

  -- -------------------------------------------------------
  -- Revenue
  --
  -- Only completed + paid vendor suborders count as revenue.
  -- -------------------------------------------------------

  select
    coalesce(sum(
      case
        when o.created_at >= v_today_start
        then so.subtotal
        else 0
      end
    ), 0),

    coalesce(sum(
      case
        when o.created_at >= v_week_start
        then so.subtotal
        else 0
      end
    ), 0),

    coalesce(sum(
      case
        when o.created_at >= v_month_start
        then so.subtotal
        else 0
      end
    ), 0),

    coalesce(avg(so.subtotal), 0)
  into
    v_todays_revenue,
    v_weekly_revenue,
    v_monthly_revenue,
    v_average_order_value
  from order_suborders so
  join orders o on o.id = so.order_id
  where so.vendor_id = p_vendor_id
    and so.status = 'completed'
    and so.payment_status = 'paid';

  -- -------------------------------------------------------
  -- Seven-day revenue chart.
  -- Uses orders.created_at because order_suborders does not
  -- have its own created_at column.
  -- -------------------------------------------------------

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'day', revenue_day,
        'revenue', revenue
      )
      order by revenue_day
    ),
    '[]'::jsonb
  )
  into v_revenue_chart
  from (
    select
      date_trunc('day', o.created_at)::date as revenue_day,
      coalesce(sum(so.subtotal), 0) as revenue
    from order_suborders so
    join orders o on o.id = so.order_id
    where so.vendor_id = p_vendor_id
      and so.status = 'completed'
      and so.payment_status = 'paid'
      and o.created_at >= v_today_start - interval '6 days'
    group by date_trunc('day', o.created_at)::date
  ) daily;

  return jsonb_build_object(
    'todaysOrders', v_todays_orders,
    'pendingOrders', v_pending_orders,
    'confirmedOrders', v_confirmed_orders,
    'preparingOrders', v_preparing_orders,
    'readyOrders', v_ready_orders,
    'deliveredOrders', v_delivered_orders,
    'totalOrders', v_total_orders,

    'todaysRevenue', round(v_todays_revenue, 2),
    'weeklyRevenue', round(v_weekly_revenue, 2),
    'monthlyRevenue', round(v_monthly_revenue, 2),
    'averageOrderValue', round(v_average_order_value, 2),

    'revenueChart', v_revenue_chart
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_verify_payment(p_order_id uuid, p_approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order orders;
  v_new_status text;
  v_vendor_id uuid;
  v_vendor_name text;
  v_customer_name text;
  v_items text;
  v_subtotal numeric;
  v_customer_id uuid;
  v_ticket text;
  v_delivery_date date;
  v_delivery_location text;
  v_notify_errors jsonb := '[]'::jsonb;
begin
  if not private.is_admin() then
    raise exception 'Not authorized: admin access required';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;

  if v_order.status not in ('payment_submitted', 'pending_payment') then
    raise exception 'Order is not awaiting payment review (current status: %)', v_order.status;
  end if;

  v_new_status := case when p_approve then 'confirmed' else 'cancelled' end;
  v_customer_id := v_order.customer_id;
  v_ticket := v_order.ticket_number;
  v_delivery_date := v_order.delivery_date;
  v_delivery_location := v_order.delivery_location;

  select coalesce(p.name, v_order.guest_name, 'Guest')
    into v_customer_name
  from (select 1) x
  left join profiles p on p.id = v_order.customer_id;

  update orders set status = v_new_status::order_status where id = p_order_id;

  update order_suborders
    set status = v_new_status::order_status,
        payment_status = case when p_approve then 'paid'::payment_status else 'unpaid'::payment_status end
    where order_id = p_order_id;

  if v_customer_id is not null then
    insert into notifications (user_id, type, title, body)
    values (
      v_customer_id,
      case when p_approve then 'payment_verified' else 'payment_rejected' end,
      case when p_approve then 'Payment verified' else 'Payment rejected' end,
      case when p_approve
        then format('Your payment for %s has been verified — your order is confirmed.', v_ticket)
        else format('We could not verify the payment for %s. Please upload valid proof or contact support.', v_ticket)
      end
    );
  end if;

  if p_approve then
    for v_vendor_id, v_vendor_name, v_subtotal in
      select so.vendor_id, v.name, so.subtotal
      from order_suborders so
      join vendors v on v.id = so.vendor_id
      where so.order_id = p_order_id
    loop
      select coalesce(string_agg(format('%s × %s', oi.qty, oi.meal_name), ', ' order by oi.id), 'No items recorded')
        into v_items
      from order_items oi
      join order_suborders so on so.id = oi.suborder_id
      where so.order_id = p_order_id and so.vendor_id = v_vendor_id;

      for v_customer_id in
        select p.id
        from profiles p
        where p.vendor_id = v_vendor_id and p.role = 'vendor'
      loop
        insert into notifications (user_id, type, title, body)
        values (
          v_customer_id,
          'new_order',
          format('New order %s', v_ticket),
          format(
            'Customer: %s | Items: %s | Vendor subtotal: R%s | Delivery: %s%s',
            v_customer_name,
            v_items,
            to_char(coalesce(v_subtotal, 0), 'FM999999990.00'),
            coalesce(to_char(v_delivery_date, 'DD Mon YYYY'), 'Not specified'),
            case when nullif(trim(v_delivery_location), '') is not null
              then format(' | Location: %s', v_delivery_location)
              else '' end
          )
        );
      end loop;
    end loop;
  end if;

  return jsonb_build_object(
    'success', true,
    'status', v_new_status,
    'notify_errors', v_notify_errors
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.confirm_payfast_payment(
  p_order_id uuid, p_pf_payment_id text, p_m_payment_id text,
  p_amount_gross numeric, p_payment_status text, p_raw_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_log public.payfast_itn_log%ROWTYPE;
  v_sub record;
  v_fee numeric := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.payment_method<>'payfast' THEN RAISE EXCEPTION 'This is not a PayFast order'; END IF;
  IF nullif(trim(p_pf_payment_id),'') IS NULL OR p_m_payment_id IS DISTINCT FROM v_order.ticket_number THEN
    RAISE EXCEPTION 'Invalid PayFast payment reference';
  END IF;
  IF p_payment_status IS NULL THEN RAISE EXCEPTION 'Payment status is required'; END IF;
  IF p_amount_gross IS NULL OR p_amount_gross<>v_order.total THEN RAISE EXCEPTION 'PayFast amount does not match the order total'; END IF;
  SELECT * INTO v_log FROM public.payfast_itn_log WHERE pf_payment_id=p_pf_payment_id FOR UPDATE;
  IF FOUND THEN
    IF v_log.order_id IS DISTINCT FROM p_order_id THEN RAISE EXCEPTION 'Payment ID belongs to another order'; END IF;
    IF v_log.payment_status='COMPLETE' THEN RETURN jsonb_build_object('duplicate',true,'applied',false); END IF;
  END IF;
  IF coalesce(p_raw_payload->>'amount_fee','') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
    v_fee:=abs((p_raw_payload->>'amount_fee')::numeric);
  END IF;
  INSERT INTO public.payfast_itn_log(pf_payment_id,order_id,m_payment_id,amount_gross,payment_status,raw_payload,processor_fee)
    VALUES(p_pf_payment_id,p_order_id,p_m_payment_id,p_amount_gross,p_payment_status,coalesce(p_raw_payload,'{}'::jsonb),v_fee)
    ON CONFLICT(pf_payment_id) DO UPDATE SET payment_status=excluded.payment_status,
      raw_payload=excluded.raw_payload,amount_gross=excluded.amount_gross,
      processor_fee=excluded.processor_fee,processed_at=now()
      WHERE public.payfast_itn_log.order_id=excluded.order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment ID belongs to another order'; END IF;
  IF p_payment_status<>'COMPLETE' THEN
    RETURN jsonb_build_object('duplicate',false,'applied',false,'reason','not_complete');
  END IF;
  IF v_order.status NOT IN ('pending_payment','payment_submitted') THEN
    RETURN jsonb_build_object('duplicate',false,'applied',false,'reason','not_eligible','current_status',v_order.status);
  END IF;
  UPDATE public.orders SET status='confirmed' WHERE id=p_order_id;
  UPDATE public.order_suborders SET status='confirmed',payment_status='paid' WHERE order_id=p_order_id;
  IF v_order.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,type,title,body,action_url)
      VALUES(v_order.customer_id,'payment_confirmed','Payment confirmed',
        format('Your payment for %s has been verified.',v_order.ticket_number),'/orders/'||p_order_id::text);
  END IF;
  FOR v_sub IN SELECT so.subtotal,v.owner_id,v.name FROM public.order_suborders so
    JOIN public.vendors v ON v.id=so.vendor_id WHERE so.order_id=p_order_id
  LOOP
    IF v_sub.owner_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,type,title,body,action_url)
        VALUES(v_sub.owner_id,'new_order','New paid order '||v_order.ticket_number,
          format('%s: R%s for %s',v_sub.name,v_sub.subtotal,to_char(v_order.delivery_date,'DD Mon YYYY')),'/vendor/orders');
    END IF;
  END LOOP;
  RETURN jsonb_build_object('duplicate',false,'applied',true,
    'order',(SELECT public.order_to_json(o) FROM public.orders o WHERE o.id=p_order_id));
END $$;
REVOKE ALL ON FUNCTION public.confirm_payfast_payment(uuid,text,text,numeric,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payfast_payment(uuid,text,text,numeric,text,jsonb) TO service_role;
