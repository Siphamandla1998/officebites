-- The orders SELECT policy invokes this helper. Its EXECUTE grant was missing,
-- producing 42501 even when authenticated has SELECT on all joined tables.
-- Keep RLS enabled; disclose only whether an active vendor owns a suborder.
CREATE OR REPLACE FUNCTION public.vendor_can_see_order(p_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.order_suborders so
 WHERE so.order_id=p_order_id AND so.vendor_id=private.current_vendor_id())
$$;
REVOKE ALL ON FUNCTION public.vendor_can_see_order(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_can_see_order(uuid) TO authenticated;

-- Match catalogue eligibility to the existing fulfilment insert guard. Do not
-- recreate missing Auth identities or mutate historical/vendor/payment rows.
CREATE FUNCTION private.vendor_orderable(p_vendor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id JOIN auth.users u ON u.id=p.id
 WHERE v.id=p_vendor AND v.status='approved' AND v.archived_at IS NULL AND NOT p.suspended AND p.deleted_at IS NULL)
$$;
REVOKE ALL ON FUNCTION private.vendor_orderable(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.vendor_orderable(uuid) TO anon,authenticated;
CREATE POLICY vendors_orderable_public ON public.vendors AS RESTRICTIVE FOR SELECT TO anon
USING(private.vendor_orderable(id));
CREATE POLICY vendors_orderable_members ON public.vendors AS RESTRICTIVE FOR SELECT TO authenticated
USING(private.vendor_orderable(id) OR owner_id=(SELECT auth.uid()) OR (SELECT private.is_admin()));

-- Preserve CENTRAL/approved VENDOR distance logic; additionally require Auth identity.
CREATE OR REPLACE FUNCTION public.get_nearby_vendors(p_latitude double precision,p_longitude double precision,p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid,distance_km double precision) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.delivery_settings%rowtype;
BEGIN
 IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Valid discovery coordinates required';END IF;
 SELECT * INTO STRICT s FROM private.delivery_settings;
 IF NOT s.enabled THEN
 RETURN QUERY SELECT v.id,NULL::double precision FROM public.vendors v WHERE private.vendor_orderable(v.id)
 ORDER BY v.id LIMIT greatest(1,least(coalesce(p_limit,30),100));
 ELSE
 RETURN QUERY WITH effective AS(
 SELECT v.id,private.distance_km(CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN d.latitude ELSE s.latitude END,CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN d.longitude ELSE s.longitude END,p_latitude,p_longitude) distance,
 CASE WHEN d.mode='VENDOR' AND d.status='approved' THEN least(coalesce(d.service_radius_km,s.max_radius_km),s.max_radius_km) ELSE s.max_radius_km END radius
 FROM public.vendors v LEFT JOIN private.vendor_delivery_origins d ON d.vendor_id=v.id WHERE private.vendor_orderable(v.id))
 SELECT e.id,e.distance FROM effective e WHERE e.distance<=e.radius+1e-9 ORDER BY e.distance,e.id LIMIT greatest(1,least(coalesce(p_limit,30),100));
 END IF;
END $$;

-- Reject new temporary URL writes; preserve existing rows without rewriting data.
CREATE FUNCTION private.reject_temporary_images() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='vendors' THEN
  IF (TG_OP='INSERT' OR NEW.logo IS DISTINCT FROM OLD.logo) AND btrim(coalesce(NEW.logo,'')) ~* '^(blob|data|javascript):' THEN RAISE EXCEPTION 'Upload the vendor logo before saving; temporary image URLs cannot be persisted';END IF;
  IF (TG_OP='INSERT' OR NEW.cover_image IS DISTINCT FROM OLD.cover_image) AND btrim(coalesce(NEW.cover_image,'')) ~* '^(blob|data|javascript):' THEN RAISE EXCEPTION 'Upload the cover image before saving; temporary image URLs cannot be persisted';END IF;
 ELSIF TG_TABLE_NAME='meals' THEN
  IF (TG_OP='INSERT' OR NEW.image IS DISTINCT FROM OLD.image) AND btrim(coalesce(NEW.image,'')) ~* '^(blob|data|javascript):' THEN RAISE EXCEPTION 'Upload the meal image before saving; temporary image URLs cannot be persisted';END IF;
 ELSIF TG_TABLE_NAME='profiles' THEN
  IF (TG_OP='INSERT' OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url) AND btrim(coalesce(NEW.avatar_url,'')) ~* '^(blob|data|javascript):' THEN RAISE EXCEPTION 'Upload the profile image before saving; temporary image URLs cannot be persisted';END IF;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.reject_temporary_images() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER reject_temporary_vendor_images BEFORE INSERT OR UPDATE OF logo,cover_image ON public.vendors FOR EACH ROW EXECUTE FUNCTION private.reject_temporary_images();
CREATE TRIGGER reject_temporary_meal_images BEFORE INSERT OR UPDATE OF image ON public.meals FOR EACH ROW EXECUTE FUNCTION private.reject_temporary_images();
CREATE TRIGGER reject_temporary_profile_images BEFORE INSERT OR UPDATE OF avatar_url ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.reject_temporary_images();
