-- ============================================================================
-- OfficeBites — safer location discovery
--
-- Only vendors with valid coordinates AND a configured positive delivery
-- radius participate in location-based discovery.
-- ============================================================================

create or replace function public.get_nearby_vendors(
  p_latitude double precision,
  p_longitude double precision,
  p_limit integer default 30
)
returns table (
  id uuid,
  distance_km double precision
)
language sql
stable
security definer
set search_path = ''
as $function$

  with vendor_distances as (
    select
      v.id,
      v.delivery_radius,

      (
        6371 * 2 * asin(
          sqrt(
            power(
              sin(radians(v.latitude - p_latitude) / 2),
              2
            )
            +
            cos(radians(p_latitude))
            *
            cos(radians(v.latitude))
            *
            power(
              sin(radians(v.longitude - p_longitude) / 2),
              2
            )
          )
        )
      )::double precision as distance_km

    from public.vendors v

    where
      v.status = 'approved'
      and v.latitude is not null
      and v.longitude is not null
      and v.delivery_radius is not null
      and v.delivery_radius > 0
  )

  select
    id,
    distance_km

  from vendor_distances

  where distance_km <= delivery_radius

  order by distance_km asc

  limit greatest(
    1,
    least(coalesce(p_limit, 30), 100)
  );

$function$;