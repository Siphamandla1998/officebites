-- =========================================================
-- 0008: Fix payment status transitions
-- =========================================================
--
-- Payment states happen before the vendor fulfilment flow.
-- They are valid order statuses but intentionally aren't part
-- of the confirmed -> completed vendor progression.
--
-- Valid payment transitions:
--   pending_payment -> payment_submitted
--
-- After payment submission, the existing vendor flow applies:
--   payment_submitted -> confirmed
--   confirmed -> accepted
--   accepted -> preparing
--   preparing -> ready
--   ready -> collected
--   collected -> completed
--
-- Cancellation remains allowed according to the existing
-- application/database rules.
-- =========================================================

create or replace function enforce_order_status_transition()
returns trigger as $$
declare
  old_step int;
  new_step int;
begin
  if new.status = old.status then
    return new;
  end if;

  -- Payment submission is a valid transition before the
  -- vendor fulfilment pipeline begins.
  if old.status = 'pending_payment'
     and new.status = 'payment_submitted' then
    return new;
  end if;

  select step into old_step
  from order_flow
  where status = old.status;

  select step into new_step
  from order_flow
  where status = new.status;

  if old.status = 'cancelled' then
    raise exception 'Cannot change status of a cancelled order';
  end if;

  if old_step is null
     or new_step is null
     or new_step <> old_step + 1 then
    raise exception 'Invalid status transition: % -> %',
      old.status,
      new.status;
  end if;

  return new;
end;
$$ language plpgsql;