-- =========================================================
-- challenges, and report_result
-- =========================================================
-- A 1v1 challenge from one player to another: a court, a start time, a length, and
-- whether it is ranked. The opponent accepts or declines; either player can cancel a
-- confirmed match before it ends. After the match starts, either player reports who won
-- (report_result), which creates the games row that Jace's confirm_result and
-- dispute_result act on.
--
-- These functions are the backend for src/services/challenges.ts. They follow the same
-- rules as challengeStatus.ts and challengeTime.ts:
--   - Stored statuses are pending, confirmed, declined, cancelled. Two more come from the
--     clock and are never stored: a pending challenge is 'expired' from its start time,
--     and a confirmed match is 'ended' from its end time (start + length).
--   - Lengths are 15, 30, 45, or 60 minutes. A start must be in the future and at most
--     14 days ahead.
--   - A player can't be challenged while they have challenges turned off, while a
--     challenge between the two is pending (either direction), or for 24 hours after
--     they declined the caller's challenge.
--   - Sending and accepting check only the caller's own confirmed matches for overlap.
--     Back to back doesn't overlap.
--
-- Blocks: a block in either direction makes the other player 'Player not found.', the
-- same as an unknown player, so the block is never revealed.
--
-- Errors follow errors.ts: not signed in is 42501 'Not signed in.'; everything else is
-- 22023 with one of these fixed messages (the service maps them to ServiceErrorCode):
--   'Player not found.'                      -> player_not_found
--   'Court not found.'                       -> court_not_found
--   'Pick a match length of 15, 30, 45, or 60 minutes.' -> invalid_match_length
--   'That time has passed.'                  -> challenge_time_passed
--   'Pick a time within the next 14 days.'   -> challenge_too_far_ahead
--   'Not accepting challenges.'              -> not_accepting_challenges
--   'Challenge already pending.'             -> challenge_pending
--   'Declined in the last 24 hours.'         -> challenge_cooldown
--   'You already have a match at that time.' -> challenger_busy
--   'Challenge not found.'                   -> challenge_not_found
--   'Challenge expired.'                     -> challenge_expired
--   'Challenge already answered.'            -> challenge_already_answered
--   'Match ended.'                           -> match_ended
--   report_result only (no codes in errors.ts yet):
--   'Match has not started.', 'Too late to post a result.', 'Result already posted.',
--   'Winner must be one of the players.'
-- A message not in this list (missing arguments, "You can't challenge yourself.") is a
-- bug on the client's side, so the service shows the generic message.


-- =========================================================
-- challenges
-- =========================================================
create table public.challenges (
  challenge_id     bigint generated always as identity primary key,
  -- Deleting an account deletes its challenges. A game that came from one keeps its row
  -- (games.challenge_id is set to null).
  challenger_id    uuid not null references public.profiles (user_id) on delete cascade,
  opponent_id      uuid not null references public.profiles (user_id) on delete cascade,
  -- Same rule as check_ins and games: a court with history is closed, not deleted.
  court_id         bigint not null references public.courts (court_id) on delete restrict,
  ranked           boolean not null,
  starts_at        timestamptz not null,
  duration_minutes smallint not null
                   constraint challenges_duration_check check (duration_minutes in (15, 30, 45, 60)),
  status           text not null default 'pending'
                   constraint challenges_status_check
                   check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  created_at       timestamptz not null default now(),
  -- When it was declined or cancelled. Starts the 24 hour cooldown after a decline, and
  -- dates the inbox's RECENT section.
  closed_at        timestamptz,
  constraint challenges_not_self check (challenger_id <> opponent_id),
  constraint challenges_closed_at_check
    check ((status in ('declined', 'cancelled')) = (closed_at is not null))
);

-- A player's challenges in both directions (list_my_challenges, overlap checks).
create index challenges_challenger_idx on public.challenges (challenger_id, starts_at);
create index challenges_opponent_idx   on public.challenges (opponent_id, starts_at);

-- Rows are written only by the security definer functions below.
revoke all on public.challenges from anon;
revoke insert, update, delete on public.challenges from authenticated;

alter table public.challenges enable row level security;

create policy "Players see their own challenges"
  on public.challenges for select
  to authenticated
  using ((select auth.uid()) in (challenger_id, opponent_id));


-- =========================================================
-- games.challenge_id
-- =========================================================
-- The TODO in the games migration: a game from a challenge points back to it, and a
-- challenge has at most one game.
alter table public.games
  add column challenge_id bigint
    references public.challenges (challenge_id) on delete set null,
  add constraint games_challenge_unique unique (challenge_id);


-- =========================================================
-- challenge_row
-- =========================================================
-- One challenge from the caller's side: what list_my_challenges, get_challenge, and the
-- accept / decline / cancel functions return. Matches the Challenge type in
-- challenges.ts, plus the result so the match screen knows whether to show Post Result
-- or Confirm.
create type public.challenge_row as (
  challenge_id       bigint,
  -- 'incoming' or 'outgoing'
  direction          text,
  -- The stored status. The app works out 'expired' and 'ended' from the times.
  status             text,
  opponent_id        uuid,
  opponent_real_name text,
  opponent_username  text,
  opponent_elo       integer,
  ranked             boolean,
  court_id           bigint,
  court_name         text,
  starts_at          timestamptz,
  duration_minutes   integer,
  closed_at          timestamptz,
  -- The reported result, or nulls if none yet.
  game_id            bigint,
  game_status        text,
  winner_id          uuid,
  reported_by        uuid
);


-- =========================================================
-- Internal helpers (not callable by clients)
-- =========================================================

-- Every challenge of p_uid, as challenge_rows. The public functions filter it.
create function public.challenge_rows(p_uid uuid)
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
         g.reported_by
    from public.challenges c
    join public.profiles o
      on o.user_id = case when c.challenger_id = p_uid then c.opponent_id
                          else c.challenger_id end
    join public.courts ct on ct.court_id = c.court_id
    left join public.games g on g.challenge_id = c.challenge_id
   where p_uid in (c.challenger_id, c.opponent_id);
$$;

-- True if a block exists between the two players, in either direction.
create function public.blocked_pair(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = p_a and blocked_id = p_b)
        or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- Raises 'Player not found.' unless p_opponent_id is a finished profile that p_uid may
-- see (not p_uid, no block either way).
create function public.require_challengeable_player(p_uid uuid, p_opponent_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_opponent_id = p_uid then
    raise exception 'You can''t challenge yourself.' using errcode = '22023';
  end if;

  if not exists (
       select 1 from public.profiles
        where user_id = p_opponent_id
          and onboarded_at is not null
     )
     or public.blocked_pair(p_uid, p_opponent_id)
  then
    raise exception 'Player not found.' using errcode = '22023';
  end if;
end;
$$;

-- Whether p_uid can challenge p_opponent_id: challenge_status's answer. Assumes
-- require_challengeable_player already passed.
create function public.challenge_status_for(p_uid uuid, p_opponent_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not (select open_to_challenges from public.profiles where user_id = p_opponent_id)
      then 'not_accepting'
    when exists (
      select 1 from public.challenges
       where status = 'pending'
         and starts_at > now()
         and ((challenger_id = p_uid and opponent_id = p_opponent_id)
           or (challenger_id = p_opponent_id and opponent_id = p_uid))
    ) then 'pending'
    when exists (
      select 1 from public.challenges
       where challenger_id = p_uid
         and opponent_id = p_opponent_id
         and status = 'declined'
         and closed_at > now() - interval '24 hours'
    ) then 'declined_recently'
    else 'can_challenge'
  end;
$$;

-- True if p_uid has a confirmed match that hasn't ended and overlaps the window.
-- p_ignore_id leaves out the challenge being accepted.
create function public.has_overlapping_match(
  p_uid uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_ignore_id bigint default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.challenges
     where p_uid in (challenger_id, opponent_id)
       and status = 'confirmed'
       and challenge_id is distinct from p_ignore_id
       and starts_at + make_interval(mins => duration_minutes) > now()
       and starts_at < p_starts_at + make_interval(mins => p_duration_minutes)
       and p_starts_at < starts_at + make_interval(mins => duration_minutes)
  );
$$;

-- Locks both players' profiles in user_id order, so two sends or accepts involving the
-- same player run one at a time (same order as confirm_result, so no deadlock).
create function public.lock_players(p_a uuid, p_b uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1
     from public.profiles
    where user_id in (p_a, p_b)
    order by user_id
      for update;
end;
$$;

-- The caller's challenge, locked, or 'Challenge not found.' if it doesn't exist, isn't
-- theirs, or the other player is blocked either way.
create function public.lock_my_challenge(p_uid uuid, p_challenge_id bigint)
returns public.challenges
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_challenge public.challenges;
begin
  if p_challenge_id is null then
    raise exception 'Challenge is required.' using errcode = '22023';
  end if;

  select * into v_challenge
    from public.challenges
   where challenge_id = p_challenge_id
     for update;

  if not found
     or p_uid not in (v_challenge.challenger_id, v_challenge.opponent_id)
     or public.blocked_pair(v_challenge.challenger_id, v_challenge.opponent_id)
  then
    raise exception 'Challenge not found.' using errcode = '22023';
  end if;

  return v_challenge;
end;
$$;

-- Raises unless the challenge is still pending: 'Challenge expired.' once its start
-- time has come, 'Challenge already answered.' otherwise (requirePending in the app).
create function public.require_pending(p_challenge public.challenges)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_challenge.status = 'pending' and now() >= p_challenge.starts_at then
    raise exception 'Challenge expired.' using errcode = '22023';
  end if;
  if p_challenge.status <> 'pending' then
    raise exception 'Challenge already answered.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.challenge_rows(uuid) from public, anon, authenticated;
revoke execute on function public.blocked_pair(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.require_challengeable_player(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.challenge_status_for(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.has_overlapping_match(uuid, timestamptz, integer, bigint) from public, anon, authenticated;
revoke execute on function public.lock_players(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.lock_my_challenge(uuid, bigint) from public, anon, authenticated;
revoke execute on function public.require_pending(public.challenges) from public, anon, authenticated;


-- =========================================================
-- challenge_status
-- =========================================================
-- 'can_challenge', 'not_accepting', 'pending', or 'declined_recently'. The profile
-- screen uses it to show or disable the Challenge button.
create function public.challenge_status(p_opponent_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if p_opponent_id is null then
    raise exception 'Opponent is required.' using errcode = '22023';
  end if;

  perform public.require_challengeable_player(v_uid, p_opponent_id);
  return public.challenge_status_for(v_uid, p_opponent_id);
end;
$$;


-- =========================================================
-- create_challenge
-- =========================================================
-- Sends a challenge and returns its id. Checks run in the order createChallenge's stub
-- runs them, so the same mistake gives the same message.
create function public.create_challenge(
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

  -- From here on, a second send between the same two players waits for this one.
  perform public.lock_players(v_uid, p_opponent_id);

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

  insert into public.challenges
    (challenger_id, opponent_id, court_id, ranked, starts_at, duration_minutes)
  values
    (v_uid, p_opponent_id, p_court_id, p_ranked, p_starts_at, p_duration_minutes)
  returning challenge_id into v_id;

  return v_id;
end;
$$;


-- =========================================================
-- list_my_challenges, get_challenge, pending_challenge_count
-- =========================================================
-- The caller's challenges in both directions. Leaves out anything that finished more
-- than 2 days ago; the inbox hides finished ones after 24 hours anyway (RECENT_HOURS).
-- Soonest start first; the app sorts into sections.
create function public.list_my_challenges()
returns setof public.challenge_row
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  return query
  select *
    from public.challenge_rows(v_uid) r
   where coalesce(r.closed_at,
                  case when r.status = 'pending' then r.starts_at
                       else r.starts_at + make_interval(mins => r.duration_minutes) end)
         > now() - interval '2 days'
   order by r.starts_at, r.challenge_id;
end;
$$;

-- One of the caller's challenges, at any age.
create function public.get_challenge(p_challenge_id bigint)
returns setof public.challenge_row
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  return query
  select * from public.challenge_rows(v_uid) r
   where r.challenge_id = p_challenge_id;

  if not found then
    raise exception 'Challenge not found.' using errcode = '22023';
  end if;
end;
$$;

-- The badge on the Search inbox: incoming challenges still waiting for an answer.
create function public.pending_challenge_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  return (
    select count(*)::integer
      from public.challenges
     where opponent_id = v_uid
       and status = 'pending'
       and starts_at > now()
  );
end;
$$;


-- =========================================================
-- accept_challenge, decline_challenge, cancel_challenge
-- =========================================================
-- Each returns the challenge as it is afterwards.

-- The opponent accepts; it becomes a confirmed match.
create function public.accept_challenge(p_challenge_id bigint)
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
  if v_c.opponent_id <> v_uid then
    raise exception 'Challenge not found.' using errcode = '22023';
  end if;
  perform public.require_pending(v_c);

  perform public.lock_players(v_c.challenger_id, v_c.opponent_id);
  if public.has_overlapping_match(v_uid, v_c.starts_at, v_c.duration_minutes, v_c.challenge_id) then
    raise exception 'You already have a match at that time.' using errcode = '22023';
  end if;

  update public.challenges
     set status = 'confirmed'
   where challenge_id = v_c.challenge_id;

  return query select * from public.challenge_rows(v_uid) r where r.challenge_id = v_c.challenge_id;
end;
$$;

-- The opponent declines. Starts the 24 hour cooldown for the challenger.
create function public.decline_challenge(p_challenge_id bigint)
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
  if v_c.opponent_id <> v_uid then
    raise exception 'Challenge not found.' using errcode = '22023';
  end if;
  perform public.require_pending(v_c);

  update public.challenges
     set status = 'declined',
         closed_at = now()
   where challenge_id = v_c.challenge_id;

  return query select * from public.challenge_rows(v_uid) r where r.challenge_id = v_c.challenge_id;
end;
$$;

-- The challenger cancels a pending challenge, or either player cancels a confirmed
-- match that hasn't ended. A match with a posted result counts as ended.
create function public.cancel_challenge(p_challenge_id bigint)
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
-- match_readiness
-- =========================================================
-- Whether each of the two players is checked in at the match's court right now. Only
-- these two players, so it doesn't expose the court's player list.
create function public.match_readiness(p_challenge_id bigint)
returns table (you_checked_in boolean, opponent_checked_in boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_c   public.challenges;
  v_opp uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select * into v_c from public.challenges where challenge_id = p_challenge_id;
  if not found
     or v_uid not in (v_c.challenger_id, v_c.opponent_id)
     or public.blocked_pair(v_c.challenger_id, v_c.opponent_id)
  then
    raise exception 'Challenge not found.' using errcode = '22023';
  end if;

  v_opp := case when v_c.challenger_id = v_uid then v_c.opponent_id else v_c.challenger_id end;

  -- An active check-in: not checked out and not expired (same as nearby_courts).
  return query
  select exists (select 1 from public.check_ins
                  where user_id = v_uid and court_id = v_c.court_id
                    and checked_out_at is null and expires_at > now()),
         exists (select 1 from public.check_ins
                  where user_id = v_opp and court_id = v_c.court_id
                    and checked_out_at is null and expires_at > now());
end;
$$;


-- =========================================================
-- report_result
-- =========================================================
-- Either player in a confirmed match posts who won, from the match's start until 24
-- hours after its end. Creates the games row (challenger on side 1, opponent on side 2)
-- and returns its id.
--   - Ranked: the game is 'pending' until the other player calls confirm_result or
--     dispute_result (Jace's functions). Elo moves only on confirm.
--   - Casual: no confirmation (Use Case 4, step 4 alternative), so the game is confirmed
--     right away. It never changes Elo and doesn't count toward a player's record.
-- One result per challenge: if both players report, the second gets 'Result already
-- posted.' and the app shows the first report to confirm or dispute.
create function public.report_result(p_challenge_id bigint, p_winner_id uuid)
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
  if now() < v_c.starts_at then
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
revoke execute on function public.challenge_status(uuid) from public, anon;
revoke execute on function public.create_challenge(uuid, boolean, bigint, timestamptz, integer) from public, anon;
revoke execute on function public.list_my_challenges() from public, anon;
revoke execute on function public.get_challenge(bigint) from public, anon;
revoke execute on function public.pending_challenge_count() from public, anon;
revoke execute on function public.accept_challenge(bigint) from public, anon;
revoke execute on function public.decline_challenge(bigint) from public, anon;
revoke execute on function public.cancel_challenge(bigint) from public, anon;
revoke execute on function public.match_readiness(bigint) from public, anon;
revoke execute on function public.report_result(bigint, uuid) from public, anon;

grant execute on function public.challenge_status(uuid) to authenticated;
grant execute on function public.create_challenge(uuid, boolean, bigint, timestamptz, integer) to authenticated;
grant execute on function public.list_my_challenges() to authenticated;
grant execute on function public.get_challenge(bigint) to authenticated;
grant execute on function public.pending_challenge_count() to authenticated;
grant execute on function public.accept_challenge(bigint) to authenticated;
grant execute on function public.decline_challenge(bigint) to authenticated;
grant execute on function public.cancel_challenge(bigint) to authenticated;
grant execute on function public.match_readiness(bigint) to authenticated;
grant execute on function public.report_result(bigint, uuid) to authenticated;
