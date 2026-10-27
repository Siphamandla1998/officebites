-- =========================================================
-- 0007: Vendor dashboard statistics
-- =========================================================
--
-- Provides vendors with aggregated statistics for their own
-- suborders without granting them direct access to arbitrary
-- customer/order rows.
--
-- Revenue is only recognised when:
--   order_suborders.status = 'completed'
--   order_suborders.payment_status = 'paid'
--
-- Revenue amount is order_suborders.subtotal.
-- Date calculations use orders.created_at.
-- =========================================================

create or replace function get_vendor_dashboard_stats(
  p_vendor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
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

  v_current_vendor_id := current_vendor_id();

  if not is_admin() then
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
$$;

-- Only authenticated users need to call this.
revoke all on function get_vendor_dashboard_stats(uuid)
from public;

grant execute on function get_vendor_dashboard_stats(uuid)
to authenticated;