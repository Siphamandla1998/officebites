-- LOCAL PROTOTYPE ONLY. Not a migration or a hosted installation script.
-- No public RPCs/grants; checkout integration and staging attestation are required
-- before generating a reviewed forward migration. Existing R15 policy untouched.
BEGIN;
DO $$ BEGIN
 IF current_setting('officebites.local_fixture',true) IS DISTINCT FROM 'isolated-pglite-only' THEN
  RAISE EXCEPTION 'Local fixture only; not an approved hosted migration'; END IF;
END $$;
CREATE TABLE private.pilot_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 hub text NOT NULL DEFAULT 'Eduvos, Umhlanga',
 collection_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK(collection_fee=0),
 delivery_fee numeric(12,2) NOT NULL DEFAULT 10 CHECK(delivery_fee>=0),
 delivery_settlement_approved boolean NOT NULL DEFAULT false,
 delivery_recipient text,
 CHECK(NOT delivery_settlement_approved OR (delivery_recipient IS NOT NULL AND length(btrim(delivery_recipient))>0))
);
INSERT INTO private.pilot_policy DEFAULT VALUES;
CREATE TABLE private.pilot_destinations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mode text NOT NULL CHECK(mode IN('collection','delivery')),
 label text NOT NULL CHECK(length(btrim(label))>0),
 approved boolean NOT NULL DEFAULT false,
 area text NOT NULL CHECK(area IN('Eduvos pickup','Umhlanga','Gateway')),
 CHECK((mode='collection' AND area='Eduvos pickup') OR
       (mode='delivery' AND area IN('Umhlanga','Gateway')))
);
CREATE TABLE private.pilot_windows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 mode text NOT NULL CHECK(mode IN('collection','delivery')),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 cutoff_at timestamptz NOT NULL,
 preparation_minutes integer NOT NULL CHECK(preparation_minutes BETWEEN 1 AND 10080),
 capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 10000),
 available boolean NOT NULL DEFAULT false,
 CHECK(ends_at>starts_at AND cutoff_at<starts_at)
);
CREATE TABLE private.pilot_bookings (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id),
 request_id uuid NOT NULL UNIQUE,
 window_id uuid NOT NULL REFERENCES private.pilot_windows(id),
 destination_id uuid NOT NULL REFERENCES private.pilot_destinations(id),
 snapshot jsonb NOT NULL,
 hold_until timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'held' CHECK(state IN('held','confirmed','released'))
);
CREATE INDEX pilot_booking_capacity ON private.pilot_bookings(window_id,state,hold_until);
ALTER TABLE private.pilot_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.pilot_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.pilot_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.pilot_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.pilot_policy,private.pilot_destinations,private.pilot_windows,
 private.pilot_bookings FROM PUBLIC,anon,authenticated,service_role;

-- Internal only. A future authenticated wrapper must check active admin,
-- independent approval, expected revision, reason and idempotency for config writes.
-- No activation or configuration writer is exposed by this candidate.
CREATE FUNCTION private.pilot_quote(p_vendor uuid,p_window uuid,p_destination uuid,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p private.pilot_policy%rowtype; w private.pilot_windows%rowtype;
 d private.pilot_destinations%rowtype; fee numeric;
BEGIN
 SELECT * INTO STRICT p FROM private.pilot_policy WHERE singleton=true FOR SHARE;
 IF NOT p.enabled OR p.revision IS DISTINCT FROM p_revision THEN
  RAISE EXCEPTION 'Pilot unavailable or policy changed'; END IF;
 SELECT * INTO STRICT w FROM private.pilot_windows WHERE id=p_window FOR UPDATE;
 SELECT * INTO STRICT d FROM private.pilot_destinations WHERE id=p_destination FOR SHARE;
 IF NOT w.available OR w.vendor_id<>p_vendor OR NOT d.approved OR d.mode<>w.mode THEN
  RAISE EXCEPTION 'Window or destination unavailable'; END IF;
 IF clock_timestamp()>=least(w.cutoff_at,w.starts_at-make_interval(mins=>w.preparation_minutes))
    OR clock_timestamp()>=w.starts_at THEN RAISE EXCEPTION 'Booking cutoff passed'; END IF;
 -- Keep the current previous-day 19:00 SAST rule until separately approved.
 IF clock_timestamp()>=(((w.starts_at AT TIME ZONE 'Africa/Johannesburg')::date-1)::timestamp
    +interval '19 hours') AT TIME ZONE 'Africa/Johannesburg' THEN
  RAISE EXCEPTION 'Ordering cutoff passed'; END IF;
 IF d.mode='delivery' AND (NOT p.delivery_settlement_approved OR p.delivery_recipient IS NULL) THEN
  RAISE EXCEPTION 'Delivery settlement approval required'; END IF;
 IF (SELECT count(*) FROM private.pilot_bookings WHERE window_id=w.id
     AND (state='confirmed' OR (state='held' AND hold_until>clock_timestamp())))>=w.capacity THEN
  RAISE EXCEPTION 'Window full'; END IF;
 fee:=CASE WHEN d.mode='collection' THEN p.collection_fee ELSE p.delivery_fee END;
 RETURN jsonb_build_object('policyRevision',p.revision,'hub',p.hub,'originMode','CENTRAL',
  'vendorId',w.vendor_id,'windowId',w.id,'mode',d.mode,'startsAt',w.starts_at,'endsAt',w.ends_at,
  'cutoffAt',w.cutoff_at,'preparationMinutes',w.preparation_minutes,'destinationId',d.id,
  'destinationLabel',d.label,'area',d.area,'fee',fee,'currency','ZAR',
  'deliveryRecipient',CASE WHEN d.mode='delivery' THEN p.delivery_recipient ELSE NULL END);
END $$;

-- Call only from the future atomic order creator, before returning instructions.
-- It MUST price the order/manual payment with the quoted fee in that transaction.
-- This function verifies that invariant; it never patches an immutable payment.
CREATE FUNCTION private.pilot_reserve(p_order uuid,p_window uuid,p_destination uuid,
 p_revision bigint,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE o public.orders%rowtype; m private.manual_order_payments%rowtype;
 b private.pilot_bookings%rowtype; s jsonb; food numeric; deadline timestamptz;
BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'Request key required'; END IF;
 -- Common lock order with payment verification: order, then manual payment.
 SELECT * INTO STRICT o FROM public.orders WHERE id=p_order FOR UPDATE;
 SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO b FROM private.pilot_bookings WHERE order_id=p_order;
 IF FOUND THEN
  IF b.request_id<>p_request OR b.window_id<>p_window OR b.destination_id<>p_destination
     OR (b.snapshot->>'policyRevision')::bigint IS DISTINCT FROM p_revision THEN
   RAISE EXCEPTION 'Booking request changed'; END IF;
  RETURN b.snapshot;
 END IF;
 IF o.status::text<>'pending_payment' OR m.state<>'awaiting_payment' OR m.deadline<=clock_timestamp() THEN
  RAISE EXCEPTION 'Unpaid active order required'; END IF;
 IF m.method NOT IN('manual_eft','manual_payshap') OR
    NOT coalesce((public.get_vendor_manual_methods(m.vendor_id)->>m.method)::boolean,false) THEN
  RAISE EXCEPTION 'Approved vendor payment method required'; END IF;
 s:=private.pilot_quote(m.vendor_id,p_window,p_destination,p_revision);
 IF (SELECT count(*) FROM public.order_suborders WHERE order_id=p_order)<>1 OR
    EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=p_order AND vendor_id<>m.vendor_id) THEN
  RAISE EXCEPTION 'One matching vendor required'; END IF;
 SELECT sum(subtotal) INTO food FROM public.order_suborders WHERE order_id=p_order;
 IF food IS NULL OR m.amount IS DISTINCT FROM food+(s->>'fee')::numeric
    OR o.total IS DISTINCT FROM m.amount THEN RAISE EXCEPTION 'Order fee snapshot mismatch'; END IF;
 IF o.delivery_date IS DISTINCT FROM ((s->>'startsAt')::timestamptz AT TIME ZONE 'Africa/Johannesburg')::date THEN
  RAISE EXCEPTION 'Order date and window differ'; END IF;
 deadline:=least(m.deadline,(s->>'cutoffAt')::timestamptz,
  (s->>'startsAt')::timestamptz-make_interval(mins=>(s->>'preparationMinutes')::integer));
 INSERT INTO private.pilot_bookings(order_id,request_id,window_id,destination_id,snapshot,hold_until)
 VALUES(p_order,p_request,p_window,p_destination,s,deadline);
 RETURN s;
END $$;

CREATE FUNCTION private.pilot_snapshot_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Booking history is immutable'; END IF;
 IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR
    (OLD.state='released' AND NEW.state<>'released') OR
    (OLD.state='confirmed' AND NEW.state='held') THEN
  RAISE EXCEPTION 'Booking snapshot is immutable; controlled rescheduling required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pilot_snapshot_guard BEFORE UPDATE OR DELETE ON private.pilot_bookings
 FOR EACH ROW EXECUTE FUNCTION private.pilot_snapshot_guard();

-- Runs in the payment transaction: a late receipt cannot overbook a released hold.
CREATE FUNCTION private.pilot_payment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b private.pilot_bookings%rowtype;
BEGIN
 IF NEW.state='paid' AND OLD.state IS DISTINCT FROM 'paid' THEN
  SELECT * INTO b FROM private.pilot_bookings WHERE order_id=NEW.order_id FOR UPDATE;
  IF FOUND THEN
   IF b.state<>'held' OR b.hold_until<=clock_timestamp() THEN
    RAISE EXCEPTION 'Booking expired; reconcile receipt and reschedule or refund independently'; END IF;
   UPDATE private.pilot_bookings SET state='confirmed' WHERE order_id=NEW.order_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pilot_payment_guard BEFORE UPDATE OF state ON private.manual_order_payments
 FOR EACH ROW EXECUTE FUNCTION private.pilot_payment_guard();
CREATE FUNCTION private.pilot_cancel_release() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status::text='cancelled' THEN
  UPDATE private.pilot_bookings SET state='released' WHERE order_id=NEW.id AND state<>'released';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pilot_cancel_release AFTER UPDATE OF status ON public.orders
 FOR EACH ROW EXECUTE FUNCTION private.pilot_cancel_release();
-- Expired holds stop counting immediately even if cleanup is delayed. No scheduler
-- is installed. Payment reports and disputes never extend the reservation TTL.
REVOKE ALL ON FUNCTION private.pilot_quote(uuid,uuid,uuid,bigint),
 private.pilot_reserve(uuid,uuid,uuid,bigint,uuid),private.pilot_snapshot_guard(),
 private.pilot_payment_guard(),private.pilot_cancel_release() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
