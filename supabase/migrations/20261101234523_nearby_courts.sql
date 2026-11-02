-- =========================================================
-- nearby_courts
-- =========================================================
-- The map's court search: courts within radius meters of (lat, lng), closest first,
-- with each court's active player count and their average elo.
-- security definer because RLS hides other players' check-ins and hides profiles from
-- anon; it returns counts and an average only, never user ids. Note that with one
-- player checked in, avg_elo is that player's elo (without a name).
-- All statuses are returned, so the court sheet can show a closed court as unavailable.
create function public.nearby_courts(lat double precision, lng double precision, radius double precision)
returns table (
  court_id     bigint,
  name         text,
  status       text,
  player_count integer,
  -- NULL when nobody is checked in.
  avg_elo      integer,
  distance_m   double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.court_id,
         c.name,
         c.status,
         active.player_count,
         active.avg_elo,
         extensions.st_distance(c.location, here.point) as distance_m
    -- PostGIS points are (longitude, latitude), the reverse of this function's arguments.
    from (select extensions.st_point(lng, lat)::extensions.geography as point) here
    -- st_dwithin uses courts_location_gist. The 50 km cap only limits how much of the
    -- map one call can scan (the map is public); check-in uses its own 150 m rule.
    join public.courts c
      on extensions.st_dwithin(c.location, here.point, least(radius, 50000))
    -- Active means not checked out and not expired. Uses check_ins_open_court_idx.
    -- An aggregate with no GROUP BY always returns one row, so every court is kept.
   cross join lateral (
     select count(*)::integer          as player_count,
            round(avg(p.elo))::integer as avg_elo
       from public.check_ins ci
       join public.profiles p on p.user_id = ci.user_id
      where ci.court_id = c.court_id
        and ci.checked_out_at is null
        and ci.expires_at > now()
   ) active
   order by distance_m;
$$;

-- The map is public, so signed-out visitors can call it too.
revoke execute on function public.nearby_courts(double precision, double precision, double precision)
  from public;
grant execute on function public.nearby_courts(double precision, double precision, double precision)
  to anon, authenticated;
