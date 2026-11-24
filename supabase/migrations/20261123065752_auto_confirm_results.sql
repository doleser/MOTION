-- =========================================================
-- auto_confirm_results
-- =========================================================
-- A ranked result stays pending until the other player confirms or disputes.
-- If it is still pending 24 hours after it was reported (games.created_at),
-- this sweep confirms it and applies Elo. The sweep runs every five minutes,
-- so a result can confirm a few minutes after the window. Casual games are
-- confirmed when they are reported and do not wait here.
-- Clients cannot call the sweep or the shared confirm helper.

create extension if not exists pg_cron with schema pg_catalog;


-- =========================================================
-- finalize_confirmed_game
-- =========================================================
-- The Elo write shared by confirm_result and auto_confirm_results.
-- A ranked game with one player on each side moves both ratings.
-- A casual game, or a game missing a side because an account was deleted,
-- is confirmed with no rating change so the sweep cannot get stuck.
create function public.finalize_confirmed_game(p_game_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_game       public.games;
  v_side_1     integer;
  v_side_2     integer;
  v_winner_id  uuid;
  v_loser_id   uuid;
  v_winner_elo integer;
  v_loser_elo  integer;
  v_delta      integer;
begin
  select * into v_game
    from public.games
   where games.game_id = p_game_id
   for update;

  if not found or v_game.status <> 'pending' then
    return;
  end if;

  select (count(*) filter (where side = 1))::integer,
         (count(*) filter (where side = 2))::integer
    into v_side_1, v_side_2
    from public.game_players
   where game_players.game_id = p_game_id;

  if v_side_1 <> 1 or v_side_2 <> 1 or not v_game.ranked then
    update public.games
       set status = 'confirmed',
           confirmed_at = now()
     where games.game_id = p_game_id;
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
end;
$$;

revoke all on function public.finalize_confirmed_game(bigint) from public, anon, authenticated;


-- =========================================================
-- confirm_result
-- =========================================================
-- Same checks as before. The rating write lives in finalize_confirmed_game
-- so the sweep cannot drift from a player's confirm.
create or replace function public.confirm_result(p_game_id bigint)
returns table (game_id bigint, elo_before integer, elo_after integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_game       public.games;
  v_side_1     integer;
  v_side_2     integer;
  v_caller_elo integer;
  v_before     integer;
  v_after      integer;
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

  perform public.finalize_confirmed_game(p_game_id);

  if not v_game.ranked then
    select elo into v_caller_elo
      from public.profiles
     where user_id = v_uid;

    return query select p_game_id, v_caller_elo, v_caller_elo;
    return;
  end if;

  -- Qualify: elo_before and elo_after are also this function's return columns.
  select elo_history.elo_before, elo_history.elo_after
    into v_before, v_after
    from public.elo_history
   where elo_history.user_id = v_uid
     and elo_history.game_id = p_game_id;

  return query select p_game_id, v_before, v_after;
end;
$$;

revoke execute on function public.confirm_result(bigint) from public, anon;
grant execute on function public.confirm_result(bigint) to authenticated;


-- =========================================================
-- auto_confirm_results
-- =========================================================
-- Confirms every pending game whose report is at least 24 hours old.
-- Returns how many games were confirmed. Skip locked so a second sweep
-- does not wait on a game the first sweep is already confirming.
create function public.auto_confirm_results()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_game_id bigint;
  v_count   integer := 0;
begin
  for v_game_id in
    select games.game_id
      from public.games
     where games.status = 'pending'
       and games.created_at <= now() - interval '24 hours'
     order by games.game_id
     for update skip locked
  loop
    perform public.finalize_confirmed_game(v_game_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.auto_confirm_results() from public, anon, authenticated;

select cron.schedule(
  'auto-confirm-results',
  '*/5 * * * *',
  'select public.auto_confirm_results()'
);
