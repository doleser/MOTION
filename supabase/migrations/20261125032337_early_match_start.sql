-- =========================================================
-- Early match start
-- =========================================================
-- Before this, a 1v1 match "started" when the clock reached starts_at: that's when
-- report_result began accepting a result. Now a match starts only when a player taps
-- Start Match (start_match), and that can be before starts_at once both players are
-- checked in at the court.
--
-- Rules:
--   - Either player can start the match; it starts for both. Allowed only when:
--       - the challenge is confirmed and the caller is one of its players (a blocked
--         pair is 'Challenge not found.', like the other functions)
--       - it hasn't started yet
--       - check-in is open: from 30 minutes before starts_at until the scheduled end
--         (starts_at + duration_minutes), the same window as isCheckInOpen in
--         challengeStatus.ts
--       - both players have an active check-in at the match's court (same test as
--         match_readiness: not checked out, not expired)
--       - neither player has another started match whose scheduled window hasn't
--         ended
--   - An early start doesn't move the end. The match still ends at starts_at +
--     duration_minutes, so the overlap checks, the "too late to post a result"
--     deadline, and auto-confirm are unchanged.
--   - report_result needs the match to have been started (started_at set) instead
--     of now() >= starts_at. A match nobody started ends at its scheduled end with
--     no result.
--   - cancel_challenge refuses a started match. A confirmed match that was never
--     started can still be cancelled until its scheduled end, as before.
--
-- New messages (22023), mapped in src/services/challenges.ts:
--   'Match already started.'           -> match_already_started
--   'Check-in is not open.'            -> check_in_not_open
--   'Both players must be checked in.' -> players_not_checked_in
--   'You have another match right now.' -> other_match_in_progress
-- When it's the other player who has a started match, start_match raises the
-- existing 'Time no longer available.' instead, which doesn't reveal their schedule.


-- =========================================================
-- challenges.started_at, and challenge_row
-- =========================================================
-- When a player tapped Start Match. Null until then.
alter table public.challenges
  add column started_at timestamptz;

-- The app needs it to know whether the match started. Added last, so challenge_rows
-- below returns it as the last column. Every function that returns challenge_row
-- does "select * from challenge_rows(...)", so they all pick it up.
alter type public.challenge_row
  add attribute started_at timestamptz;


-- =========================================================
-- challenge_rows
-- =========================================================
-- Same as before, plus started_at.
create or replace function public.challenge_rows(p_uid uuid)
returns setof public.challenge_row
language sql
stable
security definer
set search_path = ''
as $$
  select c.challenge_id,
         case when c.challenger_id = p_uid then 'outgoing' else 'incoming' end,
         c.status,
         o.user_id,
         o.real_name,
         o.username,
         o.elo,
         c.ranked,
         c.court_id,
         ct.name,
         c.starts_at,
         c.duration_minutes::integer,
         c.closed_at,
         g.game_id,
         g.status,
         (select gp.user_id
            from public.game_players gp
           where gp.game_id = g.game_id
             and gp.side = g.winning_side),
         g.reported_by,
         c.started_at
    from public.challenges c
    join public.profiles o
      on o.user_id = case when c.challenger_id = p_uid then c.opponent_id
                          else c.challenger_id end
    join public.courts ct on ct.court_id = c.court_id
    left join public.games g on g.challenge_id = c.challenge_id
   where p_uid in (c.challenger_id, c.opponent_id);
$$;

revoke execute on function public.challenge_rows(uuid) from public, anon, authenticated;


-- =========================================================
-- start_match
-- =========================================================
-- Either player starts a confirmed match, and returns it as it is afterwards.
-- Locks the challenge, then both players' profiles (the same order as
-- accept_challenge, so no deadlock):
--   - two taps on the same match: the second waits for the first, then sees
--     started_at and gets 'Match already started.'
--   - one player starting two matches at once: the second waits on that player's
--     profile, then sees the first one started.
create function public.start_match(p_challenge_id bigint)
returns setof public.challenge_row
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_c   public.challenges;
  v_opp uuid;
  v_end timestamptz;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  v_c := public.lock_my_challenge(v_uid, p_challenge_id);

  -- Pending, declined, and cancelled challenges aren't matches.
  if v_c.status <> 'confirmed' then
    raise exception 'Challenge not found.' using errcode = '22023';
  end if;
  if v_c.started_at is not null then
    raise exception 'Match already started.' using errcode = '22023';
  end if;

  v_end := v_c.starts_at + make_interval(mins => v_c.duration_minutes::integer);
  if now() >= v_end then
    raise exception 'Match ended.' using errcode = '22023';
  end if;
  if now() < v_c.starts_at - interval '30 minutes' then
    raise exception 'Check-in is not open.' using errcode = '22023';
  end if;

  perform public.lock_players(v_c.challenger_id, v_c.opponent_id);

  -- Both at the match's court with an active check-in (same test as match_readiness).
  if (select count(distinct user_id)
        from public.check_ins
       where user_id in (v_c.challenger_id, v_c.opponent_id)
         and court_id = v_c.court_id
         and checked_out_at is null
         and expires_at > now()) < 2
  then
    raise exception 'Both players must be checked in.' using errcode = '22023';
  end if;

  -- Another started match that hasn't reached its scheduled end. The caller's first,
  -- so they get the message that's about them.
  v_opp := case when v_c.challenger_id = v_uid then v_c.opponent_id else v_c.challenger_id end;
  if exists (
       select 1 from public.challenges
        where v_uid in (challenger_id, opponent_id)
          and challenge_id <> v_c.challenge_id
          and status = 'confirmed'
          and started_at is not null
          and now() < starts_at + make_interval(mins => duration_minutes)
     )
  then
    raise exception 'You have another match right now.' using errcode = '22023';
  end if;
  if exists (
       select 1 from public.challenges
        where v_opp in (challenger_id, opponent_id)
          and challenge_id <> v_c.challenge_id
          and status = 'confirmed'
          and started_at is not null
          and now() < starts_at + make_interval(mins => duration_minutes)
     )
  then
    raise exception 'Time no longer available.' using errcode = '22023';
  end if;

  update public.challenges
     set started_at = now()
   where challenge_id = v_c.challenge_id;

  return query select * from public.challenge_rows(v_uid) r where r.challenge_id = v_c.challenge_id;
end;
$$;


-- =========================================================
-- cancel_challenge
-- =========================================================
-- Same as before, except a started match can't be cancelled. A confirmed match that
-- was never started can still be cancelled until its scheduled end.
create or replace function public.cancel_challenge(p_challenge_id bigint)
returns setof public.challenge_row
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_c   public.challenges;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  v_c := public.lock_my_challenge(v_uid, p_challenge_id);

  if v_c.status = 'confirmed' then
    if now() >= v_c.starts_at + make_interval(mins => v_c.duration_minutes::integer)
       or exists (select 1 from public.games where challenge_id = v_c.challenge_id)
    then
      raise exception 'Match ended.' using errcode = '22023';
    end if;
    if v_c.started_at is not null then
      raise exception 'Match already started.' using errcode = '22023';
    end if;
  else
    -- The other player declines a pending challenge instead.
    if v_c.challenger_id <> v_uid then
      raise exception 'Challenge not found.' using errcode = '22023';
    end if;
    perform public.require_pending(v_c);
  end if;

  update public.challenges
     set status = 'cancelled',
         closed_at = now()
   where challenge_id = v_c.challenge_id;

  return query select * from public.challenge_rows(v_uid) r where r.challenge_id = v_c.challenge_id;
end;
$$;


-- =========================================================
-- report_result
-- =========================================================
-- Same as before, except the match must have been started (started_at set) instead
-- of the clock reaching starts_at. The deadline is still 24 hours after the
-- scheduled end.
create or replace function public.report_result(p_challenge_id bigint, p_winner_id uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_c       public.challenges;
  v_game_id bigint;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if p_winner_id is null then
    raise exception 'Winner is required.' using errcode = '22023';
  end if;

  v_c := public.lock_my_challenge(v_uid, p_challenge_id);

  -- Only a confirmed match was played. Pending, declined, and cancelled weren't.
  if v_c.status <> 'confirmed' then
    raise exception 'Challenge not found.' using errcode = '22023';
  end if;
  if v_c.started_at is null then
    raise exception 'Match has not started.' using errcode = '22023';
  end if;
  if now() > v_c.starts_at + make_interval(mins => v_c.duration_minutes::integer) + interval '24 hours' then
    raise exception 'Too late to post a result.' using errcode = '22023';
  end if;
  if exists (select 1 from public.games where challenge_id = v_c.challenge_id) then
    raise exception 'Result already posted.' using errcode = '22023';
  end if;
  if p_winner_id not in (v_c.challenger_id, v_c.opponent_id) then
    raise exception 'Winner must be one of the players.' using errcode = '22023';
  end if;

  insert into public.games
    (court_id, ranked, status, winning_side, reported_by, confirmed_at, challenge_id)
  values
    (v_c.court_id,
     v_c.ranked,
     case when v_c.ranked then 'pending' else 'confirmed' end,
     case when p_winner_id = v_c.challenger_id then 1 else 2 end,
     v_uid,
     case when v_c.ranked then null else now() end,
     v_c.challenge_id)
  returning game_id into v_game_id;

  insert into public.game_players (game_id, user_id, side) values
    (v_game_id, v_c.challenger_id, 1),
    (v_game_id, v_c.opponent_id, 2);

  return v_game_id;
end;
$$;


-- =========================================================
-- Grants
-- =========================================================
-- A new function is executable by PUBLIC, and Supabase also grants anon directly.
-- create or replace keeps the old grants; they're repeated here so this file says
-- who can call what.
revoke execute on function public.start_match(bigint) from public, anon;
revoke execute on function public.cancel_challenge(bigint) from public, anon;
revoke execute on function public.report_result(bigint, uuid) from public, anon;

grant execute on function public.start_match(bigint) to authenticated;
grant execute on function public.cancel_challenge(bigint) to authenticated;
grant execute on function public.report_result(bigint, uuid) to authenticated;
