-- New orders only; never backfill old orders or infer missing GPS.
BEGIN;
CREATE OR REPLACE FUNCTION public.create_order_with_delivery(p_customer_id uuid,p_guest_name text,p_guest_contact text,p_guest_email text,p_delivery_date date,p_delivery_location text,p_items jsonb,p_quote_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.delivery_settings%rowtype;q private.delivery_quotes%rowtype;r jsonb;o public.orders%rowtype;computed jsonb;
BEGIN
 SELECT * INTO STRICT s FROM private.delivery_settings FOR SHARE;
 IF NOT s.enabled AND p_quote_id IS NOT NULL THEN RAISE EXCEPTION 'Delivery policy changed; review checkout'; END IF;
 IF s.enabled THEN
  SELECT * INTO q FROM private.delivery_quotes WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND OR q.used OR q.expires_at<clock_timestamp() OR q.revision<>s.revision OR q.items_hash<>md5(p_items::text) OR q.customer_id IS DISTINCT FROM auth.uid() OR (auth.uid() IS NULL AND q.guest_proof IS DISTINCT FROM md5(btrim(p_guest_contact))) THEN RAISE EXCEPTION 'Delivery quote changed or expired. Review delivery before ordering.'; END IF;
  computed:=private.compute_delivery(q.latitude,q.longitude,p_items);
  IF q.origin_details IS DISTINCT FROM computed->'vendors' OR q.fee IS DISTINCT FROM (computed->>'fee')::numeric THEN RAISE EXCEPTION 'Delivery origin approval or policy changed; requote before ordering'; END IF;
 END IF;
 r:=private.create_order_core(p_customer_id,p_guest_name,p_guest_contact,p_guest_email,p_delivery_date,p_delivery_location,p_items);
 IF s.enabled THEN
  UPDATE public.orders SET total=total+q.fee,delivery_fee=q.fee,delivery_distance_km=q.distance_km,destination_latitude=q.latitude,destination_longitude=q.longitude WHERE id=(r->>'id')::uuid;
  UPDATE public.order_suborders sub SET delivery_snapshot=d||jsonb_build_object('quoteEnforced',true,'hubPinVerified',s.hub_pin_verified) FROM jsonb_array_elements(q.origin_details) d WHERE sub.order_id=(r->>'id')::uuid AND sub.vendor_id=(d->>'vendorId')::uuid;
  UPDATE private.delivery_quotes SET used=true WHERE id=q.id;
 ELSE
  PERFORM d.vendor_id FROM private.vendor_delivery_origins d JOIN public.order_suborders sub ON sub.vendor_id=d.vendor_id WHERE sub.order_id=(r->>'id')::uuid ORDER BY d.vendor_id FOR SHARE OF d;
  UPDATE public.order_suborders target SET delivery_snapshot=snapshot.data FROM(
   SELECT sub.id,jsonb_build_object('vendorId',sub.vendor_id,'quoteEnforced',false,'hubPinVerified',s.hub_pin_verified,
    'mode',CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN 'VENDOR' ELSE 'CENTRAL' END,
    'originId',CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN d.origin_id ELSE s.hub_id END,
    'originLatitude',CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN d.latitude ELSE s.latitude END,
    'originLongitude',CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN d.longitude ELSE s.longitude END,
    'destinationLatitude',NULL,'destinationLongitude',NULL,'distanceKm',NULL,'policyVersion',s.revision,'originVersion',coalesce(d.revision,0),
    'freeRadiusKm',s.free_radius_km,'maxRadiusKm',CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN least(coalesce(d.service_radius_km,s.max_radius_km),s.max_radius_km) ELSE s.max_radius_km END,
    'standardFee',s.paid_fee,'calculatedCharge',0,'allocatedCharge',0) data
   FROM public.order_suborders sub LEFT JOIN private.vendor_delivery_origins d ON d.vendor_id=sub.vendor_id WHERE sub.order_id=(r->>'id')::uuid
  ) snapshot WHERE target.id=snapshot.id;
 END IF;
 SELECT * INTO o FROM public.orders WHERE id=(r->>'id')::uuid;
 RETURN public.order_to_json(o)||jsonb_build_object('delivery_fee',o.delivery_fee,'delivery_distance_km',o.delivery_distance_km);
END $$;
COMMIT;
