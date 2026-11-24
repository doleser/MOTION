-- =========================================================
-- Dispute warnings and 7-day ranked ban
-- =========================================================
-- Use Case 4 (exception at step 6): a disputed result voids the game and counts
-- as a warning for both players. On a player's 5th dispute in the last month,
-- ranked_banned_until is set 7 days out so they cannot create new ranked
-- challenges while the ban is active. Casual challenges and reporting or
-- confirming already-accepted ranked matches stay allowed.
--
-- Voided games with disputed_at are the warning record; there is no separate
-- warnings table.
--
-- New message (22023) from create_challenge:
--   'Ranked play is temporarily restricted.'

alter table public.games
  add column disputed_at timestamptz,
  add constraint games_disputed_at_check
    check (disputed_at is null or status = 'voided'),
  add constraint games_disputed_after_created_check
    check (disputed_at is null or disputed_at >= created_at);

-- Omitted from the client UPDATE column grant, same as elo: only server
-- functions write ranked_banned_until.
alter table public.profiles
  add column ranked_banned_until timestamptz;


-- =========================================================
-- dispute_result
-- =========================================================
-- The player who did not report the result rejects it. The game stays voided
-- with disputed_at set and no Elo change. Any player in the game who now has
-- 5 or more disputes in the last month gets a 7-day ranked ban (or keeps an
-- existing longer ban).
create or replace function public.dispute_result(p_game_id bigint)
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
          and game_players.user_id = v_uid
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
     set status = 'voided',
         disputed_at = now()
   where games.game_id = p_game_id
  returning * into v_game;

  -- Lock in user_id order (same order as confirm_result and lock_players) so
  -- concurrent disputes count consistently and cannot deadlock.
  perform 1
    from public.profiles
   where profiles.user_id in (
           select gp.user_id
             from public.game_players gp
            where gp.game_id = p_game_id
         )
   order by profiles.user_id
   for update;

  update public.profiles p
     set ranked_banned_until = greatest(
           coalesce(p.ranked_banned_until, now()),
           now() + interval '7 days'
         )
   where p.user_id in (
           select gp.user_id
             from public.game_players gp
            where gp.game_id = p_game_id
         )
     and (
           select count(*)
             from public.game_players gp
             join public.games g on g.game_id = gp.game_id
            where gp.user_id = p.user_id
              and g.status = 'voided'
              and g.disputed_at > now() - interval '1 month'
         ) >= 5;

  return v_game;
end;
$$;


-- =========================================================
-- create_challenge
-- =========================================================
-- Same checks as before, plus rejecting a ranked challenge while the caller's
-- ranked_banned_until is in the future. Casual challenges stay allowed.
create or replace function public.create_challenge(
  p_opponent_id      uuid,
  p_ranked           boolean,
  p_court_id         bigint,
  p_starts_at        timestamptz,
  p_duration_minutes integer
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  bigint;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if p_opponent_id is null or p_ranked is null or p_court_id is null
     or p_starts_at is null or p_duration_minutes is null
  then
    raise exception 'Challenge details are required.' using errcode = '22023';
  end if;

  if p_duration_minutes not in (15, 30, 45, 60) then
    raise exception 'Pick a match length of 15, 30, 45, or 60 minutes.' using errcode = '22023';
  end if;
  if p_starts_at <= now() then
    raise exception 'That time has passed.' using errcode = '22023';
  end if;
  if p_starts_at > now() + interval '14 days' then
    raise exception 'Pick a time within the next 14 days.' using errcode = '22023';
  end if;

  perform public.require_challengeable_player(v_uid, p_opponent_id);

  if not exists (
       select 1 from public.courts
        where court_id = p_court_id
          and status = 'active'
     )
  then
    raise exception 'Court not found.' using errcode = '22023';
  end if;

  -- From here on, a second send between the same two players waits for this one. It
  -- also makes two sends by the same player run one at a time, so the overlap checks
  -- below can't both pass.
  perform public.lock_players(v_uid, p_opponent_id);

  if p_ranked and exists (
       select 1 from public.profiles
        where user_id = v_uid
          and ranked_banned_until > now()
     )
  then
    raise exception 'Ranked play is temporarily restricted.' using errcode = '22023';
  end if;

  case public.challenge_status_for(v_uid, p_opponent_id)
    when 'not_accepting' then
      raise exception 'Not accepting challenges.' using errcode = '22023';
    when 'pending' then
      raise exception 'Challenge already pending.' using errcode = '22023';
    when 'declined_recently' then
      raise exception 'Declined in the last 24 hours.' using errcode = '22023';
    else
      null;
  end case;

  if public.has_overlapping_match(v_uid, p_starts_at, p_duration_minutes) then
    raise exception 'You already have a match at that time.' using errcode = '22023';
  end if;
  if public.has_overlapping_sent_challenge(v_uid, p_starts_at, p_duration_minutes) then
    raise exception 'You already sent a challenge for that time.' using errcode = '22023';
  end if;

  insert into public.challenges
    (challenger_id, opponent_id, court_id, ranked, starts_at, duration_minutes)
  values
    (v_uid, p_opponent_id, p_court_id, p_ranked, p_starts_at, p_duration_minutes)
  returning challenge_id into v_id;

  return v_id;
end;
$$;
