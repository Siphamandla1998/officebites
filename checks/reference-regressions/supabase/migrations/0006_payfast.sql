-- ============================================================================
-- OfficeBites — PayFast integration (Phase 6)
-- Run this in the Supabase SQL editor, or via `supabase db push`, AFTER
-- reviewing every object below. Additive only — no existing table, column,
-- or policy is touched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- orders.payment_method — distinguishes the two payment rails. Existing rows
-- default to 'manual_eft' (nothing changes for orders already in flight).
-- ---------------------------------------------------------------------------
alter table orders
  add column if not exists payment_method text not null default 'manual_eft'
  check (payment_method in ('manual_eft', 'payfast'));

-- ---------------------------------------------------------------------------
-- payfast_itn_log — one row per PayFast notification actually processed.
-- The UNIQUE constraint on pf_payment_id (PayFast's own transaction id, not
-- our merchant reference) is the real idempotency guard: a resent
-- notification fails this insert and is treated as a no-op duplicate, atomically,
-- at the database level — not by a status check in application code that a
-- race condition could slip past.
--
-- No RLS policies are defined for this table on purpose. With RLS enabled
-- and zero policies, the default is deny-all for anon/authenticated — the
-- browser can never read or write this table under any circumstance. Only
-- the payfast-notify Edge Function touches it, using the Supabase service
-- role key, which bypasses RLS entirely regardless of policies.
-- ---------------------------------------------------------------------------
create table if not exists payfast_itn_log (
  id uuid primary key default gen_random_uuid(),
  pf_payment_id text not null unique,
  order_id uuid not null references orders(id),
  m_payment_id text not null,
  amount_gross numeric(10,2) not null,
  payment_status text not null,
  raw_payload jsonb not null,
  processed_at timestamptz not null default now()
);

alter table payfast_itn_log enable row level security;
-- (intentionally no policies — see comment above)

-- ---------------------------------------------------------------------------
-- confirm_payfast_payment — the ONLY path by which a PayFast payment can
-- move an order to 'confirmed'. Called exclusively by payfast-notify (via
-- the service role), never reachable from the browser: it is not granted to
-- anon or authenticated, so only service_role (which bypasses grants
-- entirely) or the postgres role can call it.
--
-- Does four things in one transaction, so a crash mid-way can't leave
-- inconsistent state:
--   1. Inserts into payfast_itn_log first — a duplicate notification fails
--      right here (unique_violation) and the function returns immediately
--      without touching the order at all.
--   2. Locks the order row (SELECT ... FOR UPDATE) so two near-simultaneous
--      calls for the same order can't both proceed past the eligibility
--      check — belt-and-braces alongside the log's unique constraint.
--   3. Re-checks eligibility against the CURRENT order state (not whatever
--      the caller believes it to be) — refuses to move an order backwards
--      or reprocess one that's already confirmed/cancelled.
--   4. Compares the PayFast amount against orders.total — the authoritative
--      figure already stored in the database — not anything the notification
--      itself claims beyond that comparison.
-- ---------------------------------------------------------------------------
create or replace function confirm_payfast_payment(
  p_order_id uuid,
  p_pf_payment_id text,
  p_m_payment_id text,
  p_amount_gross numeric,
  p_payment_status text,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
begin
  begin
    insert into payfast_itn_log (pf_payment_id, order_id, m_payment_id, amount_gross, payment_status, raw_payload)
    values (p_pf_payment_id, p_order_id, p_m_payment_id, p_amount_gross, p_payment_status, p_raw_payload);
  exception when unique_violation then
    return jsonb_build_object('duplicate', true, 'applied', false);
  end;

  select * into v_order from orders where id = p_order_id for update;

  if v_order.id is null then
    raise exception 'Order % not found', p_order_id;
  end if;

  if v_order.payment_method <> 'payfast' then
    raise exception 'Order % is not a PayFast order (payment_method = %)', p_order_id, v_order.payment_method;
  end if;

  if p_payment_status <> 'COMPLETE' then
    -- Logged above for the audit trail either way, but a non-COMPLETE
    -- status (e.g. FAILED, CANCELLED) never touches order state.
    return jsonb_build_object('duplicate', false, 'applied', false, 'reason', 'not_complete');
  end if;

  if v_order.status not in ('pending_payment', 'payment_submitted') then
    -- Already confirmed or cancelled — never move it backwards, never
    -- reprocess. (This is a second, order-state-level idempotency guard on
    -- top of the pf_payment_id one above.)
    return jsonb_build_object(
      'duplicate', false, 'applied', false,
      'reason', 'not_eligible', 'current_status', v_order.status
    );
  end if;

  if p_amount_gross <> v_order.total then
    raise exception 'Amount mismatch on order %: PayFast sent %, order total is %',
      p_order_id, p_amount_gross, v_order.total;
  end if;

  update orders set status = 'confirmed' where id = p_order_id;
  update order_suborders set status = 'confirmed', payment_status = 'paid' where order_id = p_order_id;

  return jsonb_build_object(
    'duplicate', false, 'applied', true,
    'order', (select order_to_json(o) from orders o where o.id = p_order_id)
  );
end;
$$;

-- No grant statement here on purpose — anon/authenticated get no access.
