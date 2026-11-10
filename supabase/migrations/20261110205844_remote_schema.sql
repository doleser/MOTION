SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_checked_in_at (
  p_court_id bigint
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1 from public.check_ins
     where user_id = (select auth.uid())
       and court_id = p_court_id
       and checked_out_at is null
       and expires_at > now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_username_available (
  name text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(name)
  );
$function$;

CREATE OR REPLACE FUNCTION public.nearby_courts (
  lat    double precision,
  lng    double precision,
  radius double precision
)
  RETURNS TABLE (
    court_id     bigint,
    name         text,
    status       text,
    latitude     double precision,
    longitude    double precision,
    player_count integer,
    avg_elo      integer,
    distance_m   double precision
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select c.court_id,
         c.name,
         c.status,
         -- st_x/st_y need a geometry; the cast keeps the same degrees. y is latitude.
         extensions.st_y(c.location::extensions.geometry) as latitude,
         extensions.st_x(c.location::extensions.geometry) as longitude,
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
$function$;

CREATE OR REPLACE FUNCTION public.played_in (
  p_game_id bigint
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1 from public.game_players
     where game_id = p_game_id
       and user_id = (select auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION public.player_record (
  p_user_id uuid
)
  RETURNS TABLE (
    wins   integer,
    losses integer,
    streak integer,
    recent text[]
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  -- rn = 1 is the newest game. Uses game_players_user_id_idx.
  with results as (
    select g.winning_side = gp.side as won,
           row_number() over (order by g.confirmed_at desc, g.game_id desc) as rn
      from public.game_players gp
      join public.games g on g.game_id = gp.game_id
     where gp.user_id = p_user_id
       and g.status = 'confirmed'
       and g.ranked
  ),
  newest as (
    select won from results where rn = 1
  )
  select
    (select count(*) from results where won)::integer,
    (select count(*) from results where not won)::integer,
    -- The streak is the run of games before the first result unlike the newest one,
    -- or every game if they all match.
    coalesce(
      (select case when n.won then 1 else -1 end
              * coalesce((select min(r.rn) - 1 from results r where r.won <> n.won),
                         (select count(*) from results))
         from newest n),
      0)::integer,
    coalesce(
      (select array_agg(case when won then 'W' else 'L' end order by rn desc)
         from results
        where rn <= 5),
      '{}');
$function$;

