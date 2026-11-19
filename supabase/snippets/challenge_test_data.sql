-- Sample challenges between two TEST accounts, so the Search inbox, Challenge Details,
-- and Match Check-In screens have something to show. Replaces the fake challenges that
-- used to live in src/services/challenges.ts.
--
-- How to use:
--   1. Sign up two accounts in the app (finish sign-up on both).
--   2. Put their usernames in v_me and v_them below. "me" is the account you'll look at.
--   3. Run this in the SQL editor: local Studio (http://localhost:54323) or the hosted
--      dashboard. It runs as postgres, so it skips the challenge functions' checks.
--   4. Pull to refresh the inbox.
--
-- Safe to run again: it first deletes every challenge between the two accounts.
-- Only use it on test accounts. It deletes real challenges between them too.
--
-- What you get, from me's side:
--   NEEDS YOUR ANSWER  incoming, in 2 days, 60 min, casual (Accept works)
--                      incoming, expires in about 10 minutes, ranked
--   UPCOMING           confirmed, starts in about 20 minutes (check-in is open)
--   WAITING            outgoing, tomorrow, 45 min
--   RECENT             outgoing, declined 2 hours ago. Starts the 24 hour cooldown, so
--                      me can't challenge them again until it passes.
--                      outgoing, cancelled 5 hours ago
-- Because some are pending, them's profile shows "pending" instead of Challenge.

do $$
declare
  v_me      constant text := 'change_me';     -- the account you'll look at
  v_them    constant text := 'change_them';   -- the other test account
  v_me_id   uuid;
  v_them_id uuid;
  v_court   bigint;
begin
  select user_id into v_me_id from public.profiles where username = v_me;
  select user_id into v_them_id from public.profiles where username = v_them;
  if v_me_id is null or v_them_id is null then
    raise exception 'No profile with username % or %. Edit v_me and v_them.', v_me, v_them;
  end if;
  if v_me_id = v_them_id then
    raise exception 'v_me and v_them must be different accounts.';
  end if;

  select court_id into v_court
    from public.courts
   where status = 'active'
   order by court_id
   limit 1;
  if v_court is null then
    raise exception 'No active court. Run supabase db reset to load the seed courts.';
  end if;

  delete from public.challenges
   where (challenger_id = v_me_id and opponent_id = v_them_id)
      or (challenger_id = v_them_id and opponent_id = v_me_id);

  insert into public.challenges
    (challenger_id, opponent_id, court_id, ranked, starts_at, duration_minutes, status, closed_at)
  values
    -- NEEDS YOUR ANSWER
    (v_them_id, v_me_id, v_court, false, date_trunc('hour', now()) + interval '2 days', 60, 'pending', null),
    (v_them_id, v_me_id, v_court, true,  now() + interval '10 minutes', 15, 'pending', null),
    -- UPCOMING
    (v_me_id, v_them_id, v_court, true,  now() + interval '20 minutes', 60, 'confirmed', null),
    -- WAITING
    (v_me_id, v_them_id, v_court, false, date_trunc('hour', now()) + interval '1 day', 45, 'pending', null),
    -- RECENT
    (v_me_id, v_them_id, v_court, true,  date_trunc('hour', now()) + interval '1 day 2 hours', 60,
     'declined', now() - interval '2 hours'),
    (v_me_id, v_them_id, v_court, false, date_trunc('hour', now()) + interval '1 day 4 hours', 30,
     'cancelled', now() - interval '5 hours');

  raise notice 'Added 6 challenges between % and %.', v_me, v_them;
end;
$$;
