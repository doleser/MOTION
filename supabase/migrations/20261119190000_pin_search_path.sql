-- =========================================================
-- Pin search_path to '' on the remaining security definer functions
-- =========================================================
-- A security definer function runs with its owner's rights, so it must not look up
-- names in a schema that a caller could add objects to. Every other function in
-- this project uses `set search_path = ''` and writes schema names in full. These
-- 12 (from the blocks, check_in_functions, court_functions, and
-- court_count_broadcast migrations) used `public`, `public, extensions`, or
-- `public, realtime`.
--
-- Each one is re-created with the same arguments, return type, and logic. Only the
-- search_path and the schema prefixes change (public., extensions., realtime.).
-- `create or replace` keeps the existing grants and revokes, and the trigger keeps
-- pointing at check_ins_broadcast.
-- pg_catalog (now(), count, round, least, ...) is always searched, even with ''.
-- search_path.test.sql checks that no security definer function in public
-- goes back to a non-empty path.


-- =========================================================
-- blocks
-- =========================================================
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from public.profiles where user_id = p_user_id) then
    raise exception 'Player not found.' using errcode = '22023';
  end if;
  if p_user_id = v_uid then
    raise exception 'You cannot block yourself.' using errcode = '22023';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_user_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  delete from public.blocks
   where blocker_id = v_uid
     and blocked_id = p_user_id;
end;
$$;

create or replace function public.get_my_blocks()
returns table (
  user_id uuid,
  username text,
  blocked_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select b.blocked_id, p.username, b.created_at
    from public.blocks b
    join public.profiles p on p.user_id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc;
$$;

create or replace function public.is_blocked_between(p_other uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = auth.uid() and blocked_id = p_other)
        or (blocker_id = p_other and blocked_id = auth.uid())
  );
$$;


-- =========================================================
-- check-in extras
-- =========================================================
create or replace function public.confirm_still_here(
  p_check_in_id bigint,
  p_answer boolean
) returns public.check_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.check_ins;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_answer then
    update public.check_ins
       set expires_at = now() + interval '3 hours'
     where check_in_id = p_check_in_id
       and user_id = v_uid
       and checked_out_at is null
       and expires_at > now()
     returning * into v_row;
  else
    update public.check_ins
       set checked_out_at = least(now(), expires_at)
     where check_in_id = p_check_in_id
       and user_id = v_uid
       and checked_out_at is null
     returning * into v_row;
  end if;

  if not found then
    raise exception 'Not checked in.' using errcode = '22023';
  end if;
  return v_row;
end;
$$;

create or replace function public.get_my_check_in()
returns setof public.check_ins
language sql
security definer
stable
set search_path = ''
as $$
  select * from public.check_ins
   where user_id = auth.uid()
     and checked_out_at is null
     and expires_at > now();
$$;

create or replace function public.get_court_players(p_court_id bigint)
returns table (
  user_id uuid,
  username text,
  elo integer,
  checked_in_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select p.user_id, p.username, p.elo, ci.checked_in_at
    from public.check_ins ci
    join public.profiles p on p.user_id = ci.user_id
   where ci.court_id = p_court_id
     and ci.checked_out_at is null
     and ci.expires_at > now()
     -- caller must be checked in at this same court
     and exists (
       select 1 from public.check_ins me
        where me.user_id = auth.uid()
          and me.court_id = p_court_id
          and me.checked_out_at is null
          and me.expires_at > now()
     )
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = ci.user_id)
           or (b.blocker_id = ci.user_id and b.blocked_id = auth.uid())
     )
   order by ci.checked_in_at;
$$;

create or replace function public.expire_check_ins()
returns integer
language sql
security definer
set search_path = ''
as $$
  with closed as (
    update public.check_ins
       set checked_out_at = expires_at
     where checked_out_at is null and expires_at <= now()
     returning 1
  )
  select count(*)::int from closed;
$$;


-- =========================================================
-- courts
-- =========================================================
create or replace function public.nearby_courts(
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
set search_path = ''
as $$
declare
  v_point extensions.geography;
begin
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Location is invalid.' using errcode = '22023';
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  return query
  select c.court_id,
         c.name,
         extensions.st_y(c.location::extensions.geometry),
         extensions.st_x(c.location::extensions.geometry),
         c.status,
         coalesce(a.n, 0)::int,
         case when coalesce(a.n, 0) >= 2 then round(a.avg_elo)::int end,
         extensions.st_distance(c.location, v_point)
    from public.courts c
    left join lateral (
      select count(*) as n, avg(p.elo) as avg_elo
        from public.check_ins ci
        join public.profiles p on p.user_id = ci.user_id
       where ci.court_id = c.court_id
         and ci.checked_out_at is null
         and ci.expires_at > now()
    ) a on true
   where extensions.st_dwithin(c.location, v_point, least(greatest(p_radius_m, 1), 50000))
   order by extensions.st_distance(c.location, v_point)
   limit least(greatest(p_limit, 1), 200);
end;
$$;

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
set search_path = ''
as $$
begin
  return query
  select c.court_id,
         c.name,
         extensions.st_y(c.location::extensions.geometry),
         extensions.st_x(c.location::extensions.geometry),
         c.status,
         coalesce(a.n, 0)::int,
         case when coalesce(a.n, 0) >= 2 then round(a.avg_elo)::int end,
         c.lit, c.indoor, c.hoop_count, c.net, c.double_rim, c.surface
    from public.courts c
    left join lateral (
      select count(*) as n, avg(p.elo) as avg_elo
        from public.check_ins ci
        join public.profiles p on p.user_id = ci.user_id
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


-- =========================================================
-- live court counts
-- =========================================================
create or replace function public.broadcast_court_count(p_court_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*)::int into v_count
    from public.check_ins
   where court_id = p_court_id
     and checked_out_at is null
     and expires_at > now();

  perform realtime.send(
    jsonb_build_object('courtId', p_court_id, 'playerCount', v_count),
    'count',
    'court:' || p_court_id,
    true  -- private topic: only readers allowed by the realtime.messages policy can listen
  );
end;
$$;

create or replace function public.check_ins_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'DELETE' then
    perform public.broadcast_court_count(new.court_id);
  end if;
  -- A row that left a court (check-out, or a move) changes the old court too.
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.court_id is distinct from new.court_id) then
    perform public.broadcast_court_count(old.court_id);
  end if;
  return null;
end;
$$;
