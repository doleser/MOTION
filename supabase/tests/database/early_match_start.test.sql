-- pgTAP tests for starting a 1v1 match (20261125032337_early_match_start.sql):
-- every rule start_match checks, an early start followed by a report, report_result
-- needing a started match, and cancel_challenge before vs. after starting.
-- Rows the functions don't write are set up as postgres.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- Amy and Ben play 4001, the match that gets started. The others each set up one
-- rule. Joe isn't in any of these matches.
insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000001', 'amy@test.local'),
  ('e0000000-0000-0000-0000-000000000002', 'ben@test.local'),
  ('e0000000-0000-0000-0000-000000000003', 'cal@test.local'),
  ('e0000000-0000-0000-0000-000000000004', 'dee@test.local'),
  ('e0000000-0000-0000-0000-000000000005', 'eve@test.local'),
  ('e0000000-0000-0000-0000-000000000006', 'fay@test.local'),
  ('e0000000-0000-0000-0000-000000000007', 'gus@test.local'),
  ('e0000000-0000-0000-0000-000000000008', 'hal@test.local'),
  ('e0000000-0000-0000-0000-000000000009', 'ivy@test.local'),
  ('e0000000-0000-0000-0000-000000000010', 'joe@test.local'),
  ('e0000000-0000-0000-0000-000000000011', 'kim@test.local'),
  ('e0000000-0000-0000-0000-000000000012', 'ned@test.local'),
  ('e0000000-0000-0000-0000-000000000013', 'ola@test.local');

update public.profiles as p
   set username = v.username,
       real_name = v.username,
       open_to_challenges = true,
       onboarded_at = now()
  from (values
    ('e0000000-0000-0000-0000-000000000001'::uuid, 'amy'),
    ('e0000000-0000-0000-0000-000000000002'::uuid, 'ben'),
    ('e0000000-0000-0000-0000-000000000003'::uuid, 'cal'),
    ('e0000000-0000-0000-0000-000000000004'::uuid, 'dee'),
    ('e0000000-0000-0000-0000-000000000005'::uuid, 'eve'),
    ('e0000000-0000-0000-0000-000000000006'::uuid, 'fay'),
    ('e0000000-0000-0000-0000-000000000007'::uuid, 'gus'),
    ('e0000000-0000-0000-0000-000000000008'::uuid, 'hal'),
    ('e0000000-0000-0000-0000-000000000009'::uuid, 'ivy'),
    ('e0000000-0000-0000-0000-000000000010'::uuid, 'joe'),
    ('e0000000-0000-0000-0000-000000000011'::uuid, 'kim'),
    ('e0000000-0000-0000-0000-000000000012'::uuid, 'ned'),
    ('e0000000-0000-0000-0000-000000000013'::uuid, 'ola')
  ) as v (user_id, username)
 where p.user_id = v.user_id;

-- Ola blocked Ned.
insert into public.blocks (blocker_id, blocked_id) values
  ('e0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000012');

-- now() is fixed for the whole transaction, so these times line up with the calls below.
-- All at Denny Courts, ranked, confirmed, 60 minutes.
--   4001 Amy -> Ben, in 20 minutes (started early, then reported)
--   4002 Amy -> Cal, in 31 minutes (too early; later: report without starting, cancel)
--   4003 Dee -> Eve, in 10 minutes (Eve isn't checked in)
--   4004 Fay -> Gus, in 10 minutes (Gus is checked in at Ravenna Park instead)
--   4005 Hal -> Ivy, started 2 hours ago by the clock (over; nobody started it)
--   4006 Kim -> Amy, in 25 minutes (Amy is already in 4001 once it starts)
--   4007 Ned -> Ola, in 10 minutes (blocked pair)
insert into public.challenges
  (challenge_id, challenger_id, opponent_id, court_id, ranked, starts_at, duration_minutes, status)
overriding system value
select v.id, v.challenger, v.opponent,
       (select court_id from public.courts where name = 'Denny Courts'),
       true, now() + v.starts_in, 60, 'confirmed'
  from (values
    (4001, 'e0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000002'::uuid, interval '20 minutes'),
    (4002, 'e0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000003'::uuid, interval '31 minutes'),
    (4003, 'e0000000-0000-0000-0000-000000000004'::uuid, 'e0000000-0000-0000-0000-000000000005'::uuid, interval '10 minutes'),
    (4004, 'e0000000-0000-0000-0000-000000000006'::uuid, 'e0000000-0000-0000-0000-000000000007'::uuid, interval '10 minutes'),
    (4005, 'e0000000-0000-0000-0000-000000000008'::uuid, 'e0000000-0000-0000-0000-000000000009'::uuid, interval '-2 hours'),
    (4006, 'e0000000-0000-0000-0000-000000000011'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid, interval '25 minutes'),
    (4007, 'e0000000-0000-0000-0000-000000000012'::uuid, 'e0000000-0000-0000-0000-000000000013'::uuid, interval '10 minutes')
  ) as v (id, challenger, opponent, starts_in);

-- Everyone is checked in at Denny except Eve (nowhere) and Gus (Ravenna Park).
insert into public.check_ins (user_id, court_id)
select u.id, (select court_id from public.courts where name = 'Denny Courts')
  from (values
    ('e0000000-0000-0000-0000-000000000001'::uuid),
    ('e0000000-0000-0000-0000-000000000002'::uuid),
    ('e0000000-0000-0000-0000-000000000003'::uuid),
    ('e0000000-0000-0000-0000-000000000004'::uuid),
    ('e0000000-0000-0000-0000-000000000006'::uuid),
    ('e0000000-0000-0000-0000-000000000008'::uuid),
    ('e0000000-0000-0000-0000-000000000009'::uuid),
    ('e0000000-0000-0000-0000-000000000011'::uuid),
    ('e0000000-0000-0000-0000-000000000012'::uuid),
    ('e0000000-0000-0000-0000-000000000013'::uuid)
  ) as u (id);
insert into public.check_ins (user_id, court_id) values
  ('e0000000-0000-0000-0000-000000000007',
   (select court_id from public.courts where name = 'Ravenna Park'));

select has_column('public', 'challenges', 'started_at', 'challenges has started_at');

set local role authenticated;

-- ---------------------------------------------------------
-- start_match: the rules
-- ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.start_match(4002) $$,
  '22023', 'Check-in is not open.', '31 minutes before the start is too early');

select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.start_match(4003) $$,
  '22023', 'Both players must be checked in.', 'Eve isn''t checked in');

select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000006", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.start_match(4004) $$,
  '22023', 'Both players must be checked in.', 'Gus is checked in at a different court');

select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000008", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.start_match(4005) $$,
  '22023', 'Match ended.', 'can''t start after the scheduled end');

select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000010", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.start_match(4001) $$,
  '22023', 'Challenge not found.', 'Joe isn''t in the match');

select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000012", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.start_match(4007) $$,
  '22023', 'Challenge not found.', 'a blocked pair looks like no challenge');

-- ---------------------------------------------------------
-- An early start (Amy, 20 minutes before), then Ben
-- ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select results_eq(
  $$ select status, started_at from public.start_match(4001) $$,
  $$ values ('confirmed', now()) $$,
  'Amy starts the match 20 minutes early; started_at is now');

select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.start_match(4001) $$,
  '22023', 'Match already started.', 'Ben''s Start Match after Amy''s is rejected');
select results_eq(
  $$ select started_at, starts_at - now() from public.get_challenge(4001) $$,
  $$ values (now(), interval '20 minutes') $$,
  'Ben sees it started for him too, and the scheduled start didn''t move');
select throws_ok(
  $$ select * from public.cancel_challenge(4001) $$,
  '22023', 'Match already started.', 'a started match can''t be cancelled');

-- ---------------------------------------------------------
-- Another match in progress
-- ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.start_match(4006) $$,
  '22023', 'You have another match right now.', 'Amy is already playing 4001');

select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000011", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.start_match(4006) $$,
  '22023', 'Time no longer available.',
  'Kim''s opponent is busy: a vague message that doesn''t reveal her schedule');

-- ---------------------------------------------------------
-- report_result and cancel_challenge (as Amy)
-- ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.report_result(4002, 'e0000000-0000-0000-0000-000000000001') $$,
  '22023', 'Match has not started.', 'can''t report a match nobody started');
select ok(
  public.report_result(4001, 'e0000000-0000-0000-0000-000000000002') is not null,
  'after the early start, the result is reported before the scheduled start time');
select is((select status from public.cancel_challenge(4002)), 'cancelled',
  'a confirmed match that was never started can still be cancelled');

-- ---------------------------------------------------------
-- Who can call it
-- ---------------------------------------------------------
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.start_match(4001) $$,
  '42501', 'Not signed in.', 'no user id means not signed in');

reset role;
select ok(
  not has_function_privilege('anon', 'public.start_match(bigint)', 'execute')
  and has_function_privilege('authenticated', 'public.start_match(bigint)', 'execute'),
  'start_match is for signed-in players only');

select * from finish();
rollback;
