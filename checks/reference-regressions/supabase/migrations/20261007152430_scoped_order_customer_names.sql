-- Name-only projection; profile SELECT policies remain unchanged.
CREATE OR REPLACE FUNCTION private.order_customer_names(p_order_ids uuid[])
RETURNS TABLE(order_id uuid, customer_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=caller AND NOT p.suspended) THEN
    RAISE EXCEPTION 'An active signed-in account is required' USING ERRCODE='42501';
  END IF;
  IF cardinality(p_order_ids)>200 THEN RAISE EXCEPTION 'Request at most 200 orders'; END IF;
  RETURN QUERY SELECT o.id, COALESCE(NULLIF(btrim(p.name),''),NULLIF(btrim(o.guest_name),''),'Guest')
  FROM public.orders o LEFT JOIN public.profiles p ON p.id=o.customer_id
  WHERE o.id=ANY(p_order_ids) AND (
    o.customer_id=caller OR private.is_admin() OR EXISTS(
      SELECT 1 FROM public.order_suborders s JOIN public.vendors v ON v.id=s.vendor_id
      JOIN public.profiles owner_profile ON owner_profile.id=v.owner_id
      WHERE s.order_id=o.id AND v.owner_id=caller AND v.status='approved'
        AND owner_profile.role='vendor' AND NOT owner_profile.suspended
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION private.order_customer_names(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.order_customer_names(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_order_customer_names(p_order_ids uuid[])
RETURNS TABLE(order_id uuid, customer_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT * FROM private.order_customer_names(p_order_ids); $$;
REVOKE ALL ON FUNCTION public.get_order_customer_names(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_customer_names(uuid[]) TO authenticated;
