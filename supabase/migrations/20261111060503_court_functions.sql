-- MOTION court endpoints (Supabase RPC). Run as a migration.
-- Anyone, signed in or not, can call these (the map is public).

-- Row-level security and policies on courts are not changed here. These
-- functions are security definer, so they work whatever the policies are.

-- ---------------------------------------------------------------
-- nearby_courts: the frontend needs latitude/longitude and avg_elo, which an
-- older version of this function may not return. Postgres cannot change a
-- function's return type in place, so drop any existing versions first.
-- REVIEW WITH OWEN before applying if nearby_courts is already in use.
-- ---------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.proname = 'nearby_courts'
       and p.pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig;
  end loop;
end;
$$;

-- ---------------------------------------------------------------
-- nearby_courts(lat, lng, radius_m, limit) -> courts near a point
-- Uses the GiST index on courts.location via ST_DWithin.
-- Closed courts are included (status = 'closed') so the UI can show
-- "Not Available" instead of a check-in button.
-- avg_elo is NULL with fewer than 2 players so it cannot reveal one
-- person's rating to someone who isn't checked in.
-- ---------------------------------------------------------------
create function public.nearby_courts(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 5000,
  p_limit integer default 10
) returns table (
  court_id bigint,
  name text,
  latitude double precision,
  longitude double precision,
  status text,
  player_count integer,
  avg_elo integer,
  distance_m double precision
)
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_point geography;
begin
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Location is invalid.' using errcode = '22023';
  end if;

  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;

  return query
  select c.court_id,
         c.name,
         st_y(c.location::geometry),
         st_x(c.location::geometry),
         c.status,
         coalesce(a.n, 0)::int,
         case when coalesce(a.n, 0) >= 2 then round(a.avg_elo)::int end,
         st_distance(c.location, v_point)
    from courts c
    left join lateral (
      select count(*) as n, avg(p.elo) as avg_elo
        from check_ins ci
        join profiles p on p.user_id = ci.user_id
       where ci.court_id = c.court_id
         and ci.checked_out_at is null
         and ci.expires_at > now()
    ) a on true
   where st_dwithin(c.location, v_point, least(greatest(p_radius_m, 1), 50000))
   order by st_distance(c.location, v_point)
   limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ---------------------------------------------------------------
-- get_court(court_id) -> one court with live info
-- ---------------------------------------------------------------
create or replace function public.get_court(p_court_id bigint)
returns table (
  court_id bigint,
  name text,
  latitude double precision,
  longitude double precision,
  status text,
  player_count integer,
  avg_elo integer,
  lit boolean,
  indoor boolean,
  hoop_count integer,
  net boolean,
  double_rim boolean,
  surface text
)
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
begin
  return query
  select c.court_id,
         c.name,
         st_y(c.location::geometry),
         st_x(c.location::geometry),
         c.status,
         coalesce(a.n, 0)::int,
         case when coalesce(a.n, 0) >= 2 then round(a.avg_elo)::int end,
         c.lit, c.indoor, c.hoop_count, c.net, c.double_rim, c.surface
    from courts c
    left join lateral (
      select count(*) as n, avg(p.elo) as avg_elo
        from check_ins ci
        join profiles p on p.user_id = ci.user_id
       where ci.court_id = c.court_id
         and ci.checked_out_at is null
         and ci.expires_at > now()
    ) a on true
   where c.court_id = p_court_id;

  if not found then
    raise exception 'Court not found.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.nearby_courts(double precision, double precision, integer, integer) from public;
revoke all on function public.get_court(bigint) from public;
grant execute on function public.nearby_courts(double precision, double precision, integer, integer) to anon, authenticated;
grant execute on function public.get_court(bigint) to anon, authenticated;
