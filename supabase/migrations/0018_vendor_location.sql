-- ============================================================================
-- OfficeBites — vendor geographic discovery
--
-- Adds coordinates to vendors and provides a public read-only RPC for
-- discovering approved vendors near a customer.
--
-- Coordinates are nullable so existing vendors continue working until their
-- locations are configured.
-- ============================================================================

alter table public.vendors
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.vendors
  drop constraint if exists vendors_latitude_check;

alter table public.vendors
  add constraint vendors_latitude_check
  check (
    latitude is null
    or latitude between -90 and 90
  );

alter table public.vendors
  drop constraint if exists vendors_longitude_check;

alter table public.vendors
  add constraint vendors_longitude_check
  check (
    longitude is null
    or longitude between -180 and 180
  );


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

  select
    v.id,

    (
      6371 * 2 * asin(
        sqrt(
          power(
            sin(
              radians(v.latitude - p_latitude) / 2
            ),
            2
          )
          +
          cos(radians(p_latitude))
          *
          cos(radians(v.latitude))
          *
          power(
            sin(
              radians(v.longitude - p_longitude) / 2
            ),
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

    -- A vendor is only discoverable when the customer is inside that
    -- vendor's configured delivery radius.
    and (
      v.delivery_radius is null
      or (
        6371 * 2 * asin(
          sqrt(
            power(
              sin(
                radians(v.latitude - p_latitude) / 2
              ),
              2
            )
            +
            cos(radians(p_latitude))
            *
            cos(radians(v.latitude))
            *
            power(
              sin(
                radians(v.longitude - p_longitude) / 2
              ),
              2
            )
          )
        )
      ) <= v.delivery_radius
    )

  order by distance_km asc

  limit greatest(
    1,
    least(coalesce(p_limit, 30), 100)
  );

$function$;


grant execute on function public.get_nearby_vendors(
  double precision,
  double precision,
  integer
)
to anon, authenticated;