-- Captured schema-only staging prerequisite absent from the older PGlite baseline.
-- Test fixture only; do not apply this file to a hosted database.
CREATE OR REPLACE FUNCTION private.require_fulfilment_on_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='orders' THEN
  IF NEW.customer_id IS NOT NULL THEN
   PERFORM 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=NEW.customer_id AND NOT p.suspended AND p.deleted_at IS NULL FOR SHARE OF p;
   IF NOT FOUND THEN RAISE EXCEPTION 'Active customer account required'; END IF;
  END IF;
 ELSE
  PERFORM 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id JOIN auth.users u ON u.id=p.id
  WHERE v.id=NEW.vendor_id AND v.status='approved' AND v.archived_at IS NULL AND NOT p.suspended AND p.deleted_at IS NULL FOR SHARE OF v,p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active approved vendor required for fulfilment'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER require_fulfilment BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.require_fulfilment_on_insert();
CREATE TRIGGER require_fulfilment BEFORE INSERT ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.require_fulfilment_on_insert();
REVOKE ALL ON FUNCTION private.require_fulfilment_on_insert() FROM PUBLIC,anon,authenticated;
