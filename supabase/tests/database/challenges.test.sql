-- pgTAP tests for challenges: sending (every rule createChallenge's stub checks),
-- answering, cancelling, the inbox list, match readiness, report_result (the games row
-- it creates), and that clients can only go through the functions.
-- Rows the functions don't write are set up as postgres.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(50);

-- Alice is the caller in most tests. Dev has challenges turned off. Erin blocked Alice.
-- Finn never finished sign-up. Gwen and Hank have no history with Alice.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'cara@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'dev@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'erin@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'finn@test.local'),
  ('77777777-7777-7777-7777-777777777777', 'gwen@test.local'),
  ('88888888-8888-8888-8888-888888888888', 'hank@test.local');

update public.profiles as p
   set username = v.username,
       real_name = v.real_name,
       open_to_challenges = v.open,
       onboarded_at = case when v.finished then now() end
  from (values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'alice', 'Alice Ames', true, true),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'bobby', 'Bob Burns', true, true),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'cara', 'Cara Cole', true, true),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'dev', 'Dev Diaz', false, true),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'erin', 'Erin Eng', true, true),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'finn', 'Finn Fox', true, false),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'gwen', 'Gwen Gray', true, true),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'hank', 'Hank Hill', true, true)
  ) as v (user_id, username, real_name, open, finished)
 where p.user_id = v.user_id;

insert into public.blocks (blocker_id, blocked_id) values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111');

update public.courts set status = 'closed' where name = 'Ravenna Park';

-- now() is fixed for the whole transaction, so these times line up with the calls below.
--   901 Bob -> Alice, pending, tomorrow (Alice accepts it)
--   902 Alice -> Cara, declined an hour ago (cooldown)
--   903 Cara -> Alice, pending, start passed an hour ago (expired)
--   904 Alice -> Bob, confirmed, ranked, started 30 min ago (in progress)
--   905 Alice -> Cara, confirmed, casual, ended 2 hours ago
--   906 Alice -> Bob, confirmed, ended 3 days ago (too old to report or list)
--   907 Alice -> Bob, confirmed, in 2 days (blocks overlapping sends)
--   908 Gwen -> Alice, pending, starting exactly now (expired: the boundary)
insert into public.challenges
  (challenge_id, challenger_id, opponent_id, court_id, ranked, starts_at, duration_minutes,
   status, closed_at)
overriding system value
select v.id, v.challenger, v.opponent,
       (select court_id from public.courts where name = 'Denny Courts'),
       v.ranked, now() + v.starts_in, v.minutes, v.status, now() + v.closed_in
  from (values
    (901, '22222222-2222-2222-2222-222222222222'::uuid, '11111111-1111-1111-1111-111111111111'::uuid,
          true,  interval '1 day',     60, 'pending',   null::interval),
    (902, '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333333'::uuid,
          true,  interval '1 day',     60, 'declined',  interval '-1 hour'),
    (903, '33333333-3333-3333-3333-333333333333'::uuid, '11111111-1111-1111-1111-111111111111'::uuid,
          false, interval '-1 hour',   30, 'pending',   null),
    (904, '11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid,
          true,  interval '-30 minutes', 60, 'confirmed', null),
    (905, '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333333'::uuid,
          false, interval '-3 hours',  60, 'confirmed', null),
    (906, '11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid,
          true,  interval '-3 days',   60, 'confirmed', null),
    (907, '11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid,
          true,  interval '2 days',    60, 'confirmed', null),
    (908, '77777777-7777-7777-7777-777777777777'::uuid, '11111111-1111-1111-1111-111111111111'::uuid,
          false, interval '0',         30, 'pending',   null)
  ) as v (id, challenger, opponent, ranked, starts_in, minutes, status, closed_in);

-- report_result needs a started match: 904, 905, and 906 were started on time.
update public.challenges set started_at = starts_at where challenge_id in (904, 905, 906);

-- Bob is checked in at Denny; Alice isn't.
insert into public.check_ins (user_id, court_id) values
  ('22222222-2222-2222-2222-222222222222',
   (select court_id from public.courts where name = 'Denny Courts'));

select has_column('public', 'games', 'challenge_id', 'games has challenge_id');

-- ---------------------------------------------------------
-- challenge_status (as Alice)
-- ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is(public.challenge_status('22222222-2222-2222-2222-222222222222'), 'pending',
  'Bob: a challenge between us is waiting for an answer');
select is(public.challenge_status('33333333-3333-3333-3333-333333333333'), 'declined_recently',
  'Cara: declined my challenge an hour ago (her expired challenge to me does not count as pending)');
select is(public.challenge_status('44444444-4444-4444-4444-444444444444'), 'not_accepting',
  'Dev: challenges turned off');
select is(public.challenge_status('77777777-7777-7777-7777-777777777777'), 'can_challenge',
  'Gwen: no history, so can challenge');
select throws_ok(
  $$ select public.challenge_status('55555555-5555-5555-5555-555555555555') $$,
  '22023', 'Player not found.', 'Erin blocked me: she looks like an unknown player');
select throws_ok(
  $$ select public.challenge_status('66666666-6666-6666-6666-666666666666') $$,
  '22023', 'Player not found.', 'Finn never finished sign-up');

-- ---------------------------------------------------------
-- create_challenge (as Alice)
-- ---------------------------------------------------------
select throws_ok(
  $$ select public.create_challenge('77777777-7777-7777-7777-777777777777', true,
       (select court_id from public.courts where name = 'Denny Courts'), now() + interval '1 day', 20) $$,
  '22023', 'Pick a match length of 15, 30, 45, or 60 minutes.', 'a 20 minute match is rejected');
select throws_ok(
  $$ select public.create_challenge('77777777-7777-7777-7777-777777777777', true,
       (select court_id from public.courts where name = 'Denny Courts'), now() - interval '1 minute', 60) $$,
  '22023', 'That time has passed.', 'a start in the past is rejected');
select throws_ok(
  $$ select public.create_challenge('77777777-7777-7777-7777-777777777777', true,
       (select court_id from public.courts where name = 'Denny Courts'), now() + interval '15 days', 60) $$,
  '22023', 'Pick a time within the next 14 days.', 'a start more than 14 days ahead is rejected');
select throws_ok(
  $$ select public.create_challenge('77777777-7777-7777-7777-777777777777', true,
       (select court_id from public.courts where name = 'Ravenna Park'), now() + interval '1 day', 60) $$,
  '22023', 'Court not found.', 'a closed court is rejected');
select throws_ok(
  $$ select public.create_challenge('11111111-1111-1111-1111-111111111111', true,
       (select court_id from public.courts where name = 'Denny Courts'), now() + interval '1 day', 60) $$,
  '22023', 'You can''t challenge yourself.', 'challenging yourself is rejected');
select throws_ok(
  $$ select public.create_challenge('55555555-5555-5555-5555-555555555555', true,
       (select court_id from public.courts where name = 'Denny Courts'), now() + interval '1 day', 60) $$,
  '22023', 'Player not found.', 'a blocked player is rejected without revealing the block');
select throws_ok(
  $$ select public.create_challenge('44444444-4444-4444-4444-444444444444', true,
       (select court_id from public.courts where name = 'Denny Courts'), now() + interval '1 day', 60) $$,
  '22023', 'Not accepting challenges.', 'Dev has challenges turned off');
select throws_ok(
  $$ select public.create_challenge('22222222-2222-2222-2222-222222222222', true,
       (select court_id from public.courts where name = 'Denny Courts'), now() + interval '3 days', 60) $$,
  '22023', 'Challenge already pending.', 'Bob already has a pending challenge with me');
select throws_ok(
  $$ select public.create_challenge('33333333-3333-3333-3333-333333333333', true,
       (select court_id from public.courts where name = 'Denny Courts'), now() + interval '3 days', 60) $$,
  '22023', 'Declined in the last 24 hours.', 'Cara declined me an hour ago');
select throws_ok(
  $$ select public.create_challenge('77777777-7777-7777-7777-777777777777', true,
       (select court_id from public.courts where name = 'Denny Courts'),
       now() + interval '2 days 30 minutes', 60) $$,
  '22023', 'You already have a match at that time.', 'overlapping my confirmed match (907) is rejected');
select ok(
  public.create_challenge('77777777-7777-7777-7777-777777777777', false,
    (select court_id from public.courts where name = 'Denny Courts'),
    now() + interval '2 days 1 hour', 45) is not null,
  'back to back with my confirmed match is fine: the challenge to Gwen is created');
select ok(
  public.create_challenge('88888888-8888-8888-8888-888888888888', false,
    (select court_id from public.courts where name = 'Denny Courts'),
    now() + interval '2 days' - interval '30 minutes', 30) is not null,
  'ending exactly when my confirmed match starts is fine too: the challenge to Hank is created');

-- ---------------------------------------------------------
-- The inbox (as Alice)
-- ---------------------------------------------------------
select is(public.pending_challenge_count(), 1,
  'badge counts Bob''s pending challenge, not Cara''s expired one');
select set_eq(
  $$ select challenge_id from public.list_my_challenges() $$,
  $$ select challenge_id from public.challenges
      where challenge_id in (901, 902, 903, 904, 905, 907, 908)
         or opponent_id in ('77777777-7777-7777-7777-777777777777',
                            '88888888-8888-8888-8888-888888888888') $$,
  'list has both directions and every status, but not 906 (ended 3 days ago)');
select results_eq(
  $$ select direction, status, opponent_username, opponent_real_name, court_name, duration_minutes, game_id
       from public.get_challenge(901) $$,
  $$ values ('incoming', 'pending', 'bobby', 'Bob Burns', 'Denny Courts', 60, null::bigint) $$,
  'get_challenge shows the challenge from my side');
select throws_ok(
  $$ select * from public.get_challenge(999) $$,
  '22023', 'Challenge not found.', 'a challenge that doesn''t exist');

-- ---------------------------------------------------------
-- Accept, decline, cancel
-- ---------------------------------------------------------
select throws_ok(
  $$ select * from public.accept_challenge(903) $$,
  '22023', 'Challenge expired.', 'can''t accept once the start time has passed');
select throws_ok(
  $$ select * from public.accept_challenge(902) $$,
  '22023', 'Challenge not found.', 'can''t accept a challenge I sent');
select throws_ok(
  $$ select * from public.accept_challenge(908) $$,
  '22023', 'Challenge expired.', 'a challenge expires exactly at its start time');
select throws_ok(
  $$ select * from public.cancel_challenge(901) $$,
  '22023', 'Challenge not found.', 'I can''t cancel a pending challenge sent to me (I decline it instead)');
select is((select status from public.accept_challenge(901)), 'confirmed',
  'accepting Bob''s challenge makes it a confirmed match');
select throws_ok(
  $$ select * from public.accept_challenge(901) $$,
  '22023', 'Challenge already answered.', 'accepting twice is rejected');
select is((select status from public.cancel_challenge(907)), 'cancelled',
  'I can cancel a confirmed match that hasn''t started');
select throws_ok(
  $$ select * from public.cancel_challenge(905) $$,
  '22023', 'Match ended.', 'can''t cancel a match that is over');

-- Gwen declines Alice's challenge.
select set_config('request.jwt.claims',
  '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}', true);
select results_eq(
  $$ select status, closed_at is not null
       from public.decline_challenge(
         (select challenge_id from public.challenges
           where opponent_id = '77777777-7777-7777-7777-777777777777')) $$,
  $$ values ('declined', true) $$,
  'Gwen declines; closed_at is set');

select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is(public.challenge_status('77777777-7777-7777-7777-777777777777'), 'declined_recently',
  'after Gwen declined, I wait 24 hours');

-- ---------------------------------------------------------
-- report_result (as Alice, then Bob)
-- ---------------------------------------------------------
select throws_ok(
  $$ select public.report_result(907, '11111111-1111-1111-1111-111111111111') $$,
  '22023', 'Challenge not found.', 'a cancelled match has no result');
select throws_ok(
  $$ select public.report_result(901, '11111111-1111-1111-1111-111111111111') $$,
  '22023', 'Match has not started.', 'can''t report before the match starts');
select throws_ok(
  $$ select public.report_result(906, '11111111-1111-1111-1111-111111111111') $$,
  '22023', 'Too late to post a result.', 'can''t report more than 24 hours after the end');
select throws_ok(
  $$ select public.report_result(904, '33333333-3333-3333-3333-333333333333') $$,
  '22023', 'Winner must be one of the players.', 'the winner has to have played');

select set_config('test.ranked_game',
  public.report_result(904, '22222222-2222-2222-2222-222222222222')::text, true);
select results_eq(
  $$ select ranked, status, winning_side::integer, reported_by, challenge_id, confirmed_at
       from public.games where game_id = current_setting('test.ranked_game')::bigint $$,
  $$ values (true, 'pending', 2, '11111111-1111-1111-1111-111111111111'::uuid, 904::bigint, null::timestamptz) $$,
  'ranked result: a pending game, Bob (the opponent, side 2) won, reported by me');
select results_eq(
  $$ select user_id, side::integer from public.game_players
      where game_id = current_setting('test.ranked_game')::bigint order by side $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 1),
            ('22222222-2222-2222-2222-222222222222'::uuid, 2) $$,
  'the challenger is side 1 and the opponent is side 2');
-- Saved first: a query can't see a row inserted by a function it calls itself.
select set_config('test.casual_game',
  public.report_result(905, '11111111-1111-1111-1111-111111111111')::text, true);
select results_eq(
  $$ select status, confirmed_at is not null, ranked
       from public.games
      where game_id = current_setting('test.casual_game')::bigint $$,
  $$ values ('confirmed', true, false) $$,
  'casual result: confirmed right away, no confirmation step');

select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.report_result(904, '22222222-2222-2222-2222-222222222222') $$,
  '22023', 'Result already posted.', 'Bob can''t post a second result');
select throws_ok(
  $$ select * from public.cancel_challenge(904) $$,
  '22023', 'Match ended.', 'a match with a posted result can''t be cancelled');
select results_eq(
  $$ select direction, game_status, winner_id, reported_by from public.get_challenge(904) $$,
  $$ values ('incoming', 'pending', '22222222-2222-2222-2222-222222222222'::uuid,
             '11111111-1111-1111-1111-111111111111'::uuid) $$,
  'Bob sees the result Alice posted, waiting for him to confirm');

-- ---------------------------------------------------------
-- match_readiness
-- ---------------------------------------------------------
select results_eq(
  $$ select * from public.match_readiness(904) $$,
  $$ values (true, false) $$,
  'Bob is checked in at the match court and Alice isn''t');

select set_config('request.jwt.claims',
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.match_readiness(904) $$,
  '22023', 'Challenge not found.', 'Dev isn''t in the match, so he can''t see it');

-- ---------------------------------------------------------
-- Clients only go through the functions
-- ---------------------------------------------------------
select is_empty($$ select * from public.challenges $$,
  'RLS: Dev sees none of the other players'' challenges');
select throws_ok(
  $$ insert into public.challenges (challenger_id, opponent_id, court_id, ranked, starts_at, duration_minutes)
     values ('44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777',
             1, true, now() + interval '1 day', 60) $$,
  '42501', null, 'a client can''t insert a challenge directly');
select ok(
  not has_function_privilege('authenticated', 'public.challenge_rows(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.lock_players(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.challenge_status_for(uuid, uuid)', 'execute'),
  'the internal helpers aren''t callable by clients');

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$ select public.pending_challenge_count() $$,
  '42501', 'Not signed in.', 'no user id means not signed in');

set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$ select public.challenge_status('22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'signed-out visitors can''t call the challenge functions');

select * from finish();
rollback;
