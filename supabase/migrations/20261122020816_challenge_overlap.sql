-- =========================================================
-- Overlapping challenges
-- =========================================================
-- Before this, sending and accepting checked only the caller's own confirmed matches
-- for overlap. So a player could send several challenges for the same time, and when
-- two of them were accepted, the challenger ended up in two matches at once (accept
-- never checked the challenger).
--
-- New rules (back to back still doesn't overlap):
--   - Sending: you can't send a challenge that overlaps one you already sent and is
--     still pending, or one of your confirmed matches. A pending challenge someone
--     sent YOU doesn't block you: you may be about to decline it, and accepting (below)
--     still stops a double booking.
--   - Accepting: once a match is confirmed, every other pending challenge that overlaps
--     it, for either player and in either direction, is cancelled. They move to RECENT
--     as cancelled (not declined, so no 24 hour cooldown) and never say why, so no one
--     learns the other player's schedule.
--   - Accepting also checks the challenger's confirmed matches, as a backstop for two
--     accepts at the same moment. That raises 'Time no longer available.', which
--     doesn't say why either.
--
-- New messages (22023), mapped in src/services/challenges.ts:
--   'You already sent a challenge for that time.' -> challenge_time_taken
--   'Time no longer available.'                   -> time_unavailable


-- True if p_uid sent a challenge that is still pending, hasn't expired, and overlaps
-- the window.
create function public.has_overlapping_sent_challenge(
  p_uid uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.challenges
     where challenger_id = p_uid
       and status = 'pending'
       and starts_at > now()
       and starts_at < p_starts_at + make_interval(mins => p_duration_minutes)
       and p_starts_at < starts_at + make_interval(mins => duration_minutes)
  );
$$;

revoke execute on function public.has_overlapping_sent_challenge(uuid, timestamptz, integer)
  from public, anon, authenticated;


-- =========================================================
-- create_challenge
-- =========================================================
-- Same as before, plus the sent-challenge overlap check at the end.
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


-- =========================================================
-- accept_challenge
-- =========================================================
-- The opponent accepts; it becomes a confirmed match, and the two players' other
-- pending challenges at that time are cancelled.
create or replace function public.accept_challenge(p_challenge_id bigint)
returns setof public.challenge_row
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_c   public.challenges;
  v_end timestamptz;
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
  -- Backstop: the challenger's other overlapping challenges are cancelled when one is
  -- accepted, so this only happens when two accepts race. Doesn't say why.
  if public.has_overlapping_match(v_c.challenger_id, v_c.starts_at, v_c.duration_minutes, v_c.challenge_id) then
    raise exception 'Time no longer available.' using errcode = '22023';
  end if;

  update public.challenges
     set status = 'confirmed'
   where challenge_id = v_c.challenge_id;

  -- Cancel both players' other pending challenges that overlap this match. A row
  -- another accept has locked right now is skipped (no deadlock); that accept then
  -- hits the backstop above once it gets the players' locks.
  v_end := v_c.starts_at + make_interval(mins => v_c.duration_minutes);
  update public.challenges
     set status = 'cancelled',
         closed_at = now()
   where challenge_id in (
     select challenge_id
       from public.challenges
      where challenge_id <> v_c.challenge_id
        and status = 'pending'
        and starts_at > now()
        and (challenger_id in (v_c.challenger_id, v_c.opponent_id)
          or opponent_id in (v_c.challenger_id, v_c.opponent_id))
        and starts_at < v_end
        and v_c.starts_at < starts_at + make_interval(mins => duration_minutes)
        for update skip locked
   );

  return query select * from public.challenge_rows(v_uid) r where r.challenge_id = v_c.challenge_id;
end;
$$;
