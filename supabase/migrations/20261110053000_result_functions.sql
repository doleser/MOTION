-- =========================================================
-- elo_delta, preview_elo, confirm_result, dispute_result
-- =========================================================
-- Rating is the only writer of profiles.elo and elo_history. A confirmed ranked
-- 1v1 moves both players by the same whole number. Reporting a result waits on
-- the challenges table, so these functions start from a game row that already
-- exists. Clients cannot write the tables; the functions are security definer.

-- =========================================================
-- elo_delta
-- =========================================================
-- Points the winner gains. The loser loses the same amount.
-- E = 1 / (1 + 10^((loser - winner) / 400)), then round(32 * (1 - E)).
-- round(numeric) breaks a tie away from zero. round(float8) does not, so the
-- whole expression stays numeric. Not granted to clients: preview and confirm
-- call it, and a client must not apply the number itself.
create function public.elo_delta(p_winner_elo integer, p_loser_elo integer)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select round(
    32 * (
      1 - 1 / (
        1 + power(10::numeric, (p_loser_elo - p_winner_elo)::numeric / 400)
      )
    )
  )::integer;
$$;

revoke execute on function public.elo_delta(integer, integer) from public, anon, authenticated;


-- =========================================================
-- preview_elo
-- =========================================================
-- The stakes line: what the caller gains by winning, and loses by losing.
-- Ratings are read now. confirm_result reads them again, so a confirm can
-- differ from a preview taken earlier.
create function public.preview_elo(p_opponent_id uuid)
returns table (win integer, lose integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_me  integer;
  v_opp integer;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_opponent_id is null then
    raise exception 'Opponent is required.' using errcode = '22023';
  end if;

  if p_opponent_id = v_uid then
    raise exception 'You can''t play yourself.' using errcode = '22023';
  end if;

  select elo into v_me
    from public.profiles
   where user_id = v_uid;
  if not found then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select elo into v_opp
    from public.profiles
   where user_id = p_opponent_id;
  if not found then
    raise exception 'Opponent not found.' using errcode = '22023';
  end if;

  return query
  select public.elo_delta(v_me, v_opp),
         -public.elo_delta(v_opp, v_me);
end;
$$;

revoke execute on function public.preview_elo(uuid) from public, anon;
grant execute on function public.preview_elo(uuid) to authenticated;


-- =========================================================
-- confirm_result
-- =========================================================
-- The player who did not report the result confirms it. A ranked game writes
-- both profiles.elo and both elo_history rows, then marks the game confirmed.
-- A casual game is confirmed with no rating change. The returned before/after
-- are the caller's.
create function public.confirm_result(p_game_id bigint)
returns table (game_id bigint, elo_before integer, elo_after integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := (select auth.uid());
  v_game        public.games;
  v_side_1      integer;
  v_side_2      integer;
  v_winner_id   uuid;
  v_loser_id    uuid;
  v_winner_elo  integer;
  v_loser_elo   integer;
  v_delta       integer;
  v_caller_elo  integer;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_game_id is null then
    raise exception 'Game is required.' using errcode = '22023';
  end if;

  select * into v_game
    from public.games
   where games.game_id = p_game_id
   for update;

  if not found
     or not exists (
       select 1 from public.game_players
        where game_players.game_id = p_game_id
          and user_id = v_uid
     )
  then
    raise exception 'Game not found.' using errcode = '22023';
  end if;

  if v_game.reported_by = v_uid then
    raise exception 'The other player confirms this result.' using errcode = '22023';
  end if;

  if v_game.status <> 'pending' then
    raise exception 'Result is not waiting for confirmation.' using errcode = '22023';
  end if;

  select (count(*) filter (where side = 1))::integer,
         (count(*) filter (where side = 2))::integer
    into v_side_1, v_side_2
    from public.game_players
   where game_players.game_id = p_game_id;

  if v_side_1 <> 1 or v_side_2 <> 1 then
    raise exception 'A result needs one player on each side.';
  end if;

  if not v_game.ranked then
    update public.games
       set status = 'confirmed',
           confirmed_at = now()
     where games.game_id = p_game_id;

    select elo into v_caller_elo
      from public.profiles
     where user_id = v_uid;

    return query select p_game_id, v_caller_elo, v_caller_elo;
    return;
  end if;

  select user_id into v_winner_id
    from public.game_players
   where game_players.game_id = p_game_id
     and side = v_game.winning_side;

  select user_id into v_loser_id
    from public.game_players
   where game_players.game_id = p_game_id
     and side <> v_game.winning_side;

  -- Lock in user_id order so two confirms cannot deadlock on the same pair.
  perform 1
    from public.profiles
   where user_id in (v_winner_id, v_loser_id)
   order by user_id
   for update;

  select elo into v_winner_elo
    from public.profiles
   where user_id = v_winner_id;

  select elo into v_loser_elo
    from public.profiles
   where user_id = v_loser_id;

  v_delta := public.elo_delta(v_winner_elo, v_loser_elo);

  update public.profiles
     set elo = elo + v_delta
   where user_id = v_winner_id;

  update public.profiles
     set elo = elo - v_delta
   where user_id = v_loser_id;

  insert into public.elo_history (user_id, game_id, elo_before, elo_after)
  values (v_winner_id, p_game_id, v_winner_elo, v_winner_elo + v_delta),
         (v_loser_id, p_game_id, v_loser_elo, v_loser_elo - v_delta);

  update public.games
     set status = 'confirmed',
         confirmed_at = now()
   where games.game_id = p_game_id;

  if v_uid = v_winner_id then
    return query select p_game_id, v_winner_elo, v_winner_elo + v_delta;
  else
    return query select p_game_id, v_loser_elo, v_loser_elo - v_delta;
  end if;
end;
$$;

revoke execute on function public.confirm_result(bigint) from public, anon;
grant execute on function public.confirm_result(bigint) to authenticated;


-- =========================================================
-- dispute_result
-- =========================================================
-- The player who did not report the result rejects it. The game stays in the
-- table as voided, and neither rating changes.
-- TODO: write a warnings row for both players once that table exists.
create function public.dispute_result(p_game_id bigint)
returns public.games
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_game public.games;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_game_id is null then
    raise exception 'Game is required.' using errcode = '22023';
  end if;

  select * into v_game
    from public.games
   where games.game_id = p_game_id
   for update;

  if not found
     or not exists (
       select 1 from public.game_players
        where game_players.game_id = p_game_id
          and user_id = v_uid
     )
  then
    raise exception 'Game not found.' using errcode = '22023';
  end if;

  if v_game.reported_by = v_uid then
    raise exception 'The other player confirms this result.' using errcode = '22023';
  end if;

  if v_game.status <> 'pending' then
    raise exception 'Result is not waiting for confirmation.' using errcode = '22023';
  end if;

  update public.games
     set status = 'voided'
   where games.game_id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

revoke execute on function public.dispute_result(bigint) from public, anon;
grant execute on function public.dispute_result(bigint) to authenticated;
