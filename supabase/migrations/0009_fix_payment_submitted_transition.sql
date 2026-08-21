-- =========================================================
-- 0009: Fix payment submitted -> confirmed transition
-- =========================================================
--
-- Payment submission happens before the normal vendor
-- fulfilment workflow.
--
-- Valid payment transitions:
--   pending_payment -> payment_submitted
--   payment_submitted -> confirmed
--
-- Normal vendor fulfilment flow remains strict:
--   confirmed -> accepted
--   accepted -> preparing
--   preparing -> ready
--   ready -> collected
--   collected -> completed
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

  -- Payment submission is valid before vendor fulfilment.
  if old.status = 'pending_payment'
     and new.status = 'payment_submitted' then
    return new;
  end if;

  -- Verified payment moves the order into the vendor
  -- fulfilment workflow.
  if old.status = 'payment_submitted'
     and new.status = 'confirmed' then
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