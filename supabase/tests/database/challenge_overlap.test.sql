-- pgTAP tests for overlapping challenges (20261122020816_challenge_overlap.sql):
-- sending is blocked by your own pending sent challenges, accepting cancels both
-- players' other overlapping pending challenges, and accept checks the challenger too.
-- Rows the functions don't write are set up as postgres.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- Sending: Amy is the caller. Ben has a confirmed match with her; Cal, Dee and Fay
-- are fresh; Eve has sent Amy a pending challenge.
-- Accepting: Pat sent challenges to Quinn and Rae for overlapping times (possible
-- before this fix), Sam sent one to Quinn too, and Tia is used for the backstop.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'amy@test.local'),
  ('a0000000-0000-0000-0000-000000000002', 'ben@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'cal@test.local'),
  ('a0000000-0000-0000-0000-000000000004', 'dee@test.local'),
  ('a0000000-0000-0000-0000-000000000005', 'eve@test.local'),
  ('a0000000-0000-0000-0000-000000000006', 'fay@test.local'),
  ('b0000000-0000-0000-0000-000000000001', 'pat@test.local'),
  ('b0000000-0000-0000-0000-000000000002', 'quinn@test.local'),
  ('b0000000-0000-0000-0000-000000000003', 'rae@test.local'),
  ('b0000000-0000-0000-0000-000000000004', 'sam@test.local'),
  ('b0000000-0000-0000-0000-000000000005', 'tia@test.local');

update public.profiles as p
   set username = v.username,
       real_name = v.username,
       open_to_challenges = true,
       onboarded_at = now()
  from (values
    ('a0000000-0000-0000-0000-000000000001'::uuid, 'amy'),
    ('a0000000-0000-0000-0000-000000000002'::uuid, 'ben'),
    ('a0000000-0000-0000-0000-000000000003'::uuid, 'cal'),
    ('a0000000-0000-0000-0000-000000000004'::uuid, 'dee'),
    ('a0000000-0000-0000-0000-000000000005'::uuid, 'eve'),
    ('a0000000-0000-0000-0000-000000000006'::uuid, 'fay'),
    ('b0000000-0000-0000-0000-000000000001'::uuid, 'pat'),
    ('b0000000-0000-0000-0000-000000000002'::uuid, 'quinn'),
    ('b0000000-0000-0000-0000-000000000003'::uuid, 'rae'),
    ('b0000000-0000-0000-0000-000000000004'::uuid, 'sam'),
    ('b0000000-0000-0000-0000-000000000005'::uuid, 'tia')
  ) as v (user_id, username)
 where p.user_id = v.user_id;

-- now() is fixed for the whole transaction, so these times line up with the calls below.
--   1001 Amy -> Ben, confirmed, in 2 days, 60 min
--   1002 Eve -> Amy, pending, in 7 days, 60 min (sent TO Amy)
--   2001 Pat -> Quinn, pending, in 5 days, 60 min (Quinn accepts it)
--   2002 Pat -> Rae, pending, in 5 days 30 min, 60 min (overlaps 2001)
--   2003 Sam -> Quinn, pending, in 5 days, 60 min (overlaps 2001, sent to Quinn)
--   2004 Sam -> Pat, pending, in 6 days, 60 min (doesn't overlap)
--   2005 Pat -> Sam, pending, in 5 days 1 hour, 30 min (back to back with 2001)
insert into public.challenges
  (challenge_id, challenger_id, opponent_id, court_id, ranked, starts_at, duration_minutes, status)
overriding system value
select v.id, v.challenger, v.opponent,
       (select court_id from public.courts where name = 'Denny Courts'),
       false, now() + v.starts_in, v.minutes, v.status
  from (values
    (1001, 'a0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid,
           interval '2 days', 60, 'confirmed'),
    (1002, 'a0000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid,
           interval '7 days', 60, 'pending'),
    (2001, 'b0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid,
           interval '5 days', 60, 'pending'),
    (2002, 'b0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000003'::uuid,
           interval '5 days 30 minutes', 60, 'pending'),
    (2003, 'b0000000-0000-0000-0000-000000000004'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid,
           interval '5 days', 60, 'pending'),
    (2004, 'b0000000-0000-0000-0000-000000000004'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid,
           interval '6 days', 60, 'pending'),
    (2005, 'b0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid,
           interval '5 days 1 hour', 30, 'pending')
  ) as v (id, challenger, opponent, starts_in, minutes, status);

-- ---------------------------------------------------------
-- Sending (as Amy)
-- ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.create_challenge('a0000000-0000-0000-0000-000000000003', false,
       (select court_id from public.courts where name = 'Denny Courts'),
       now() + interval '2 days 30 minutes', 60) $$,
  '22023', 'You already have a match at that time.',
  'overlapping my confirmed match is still rejected');
select ok(
  public.create_challenge('a0000000-0000-0000-0000-000000000003', false,
    (select court_id from public.courts where name = 'Denny Courts'),
    now() + interval '3 days', 60) is not null,
  'a free time works: the challenge to Cal is created');
select throws_ok(
  $$ select public.create_challenge('a0000000-0000-0000-0000-000000000004', false,
       (select court_id from public.courts where name = 'Denny Courts'),
       now() + interval '3 days 30 minutes', 60) $$,
  '22023', 'You already sent a challenge for that time.',
  'overlapping my pending challenge to Cal is rejected');
select ok(
  public.create_challenge('a0000000-0000-0000-0000-000000000004', false,
    (select court_id from public.courts where name = 'Denny Courts'),
    now() + interval '3 days 1 hour', 60) is not null,
  'back to back with my pending challenge is fine: the challenge to Dee is created');
select ok(
  public.create_challenge('a0000000-0000-0000-0000-000000000006', false,
    (select court_id from public.courts where name = 'Denny Courts'),
    now() + interval '7 days', 60) is not null,
  'Eve''s pending challenge TO me at that time doesn''t block me: the challenge to Fay is created');

-- ---------------------------------------------------------
-- Accepting (as Quinn)
-- ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "b0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);

select is((select status from public.accept_challenge(2001)), 'confirmed',
  'Quinn accepts Pat''s challenge');

reset role;
select is((select status from public.challenges where challenge_id = 2002), 'cancelled',
  'Pat''s overlapping challenge to Rae is cancelled');
select is((select status from public.challenges where challenge_id = 2003), 'cancelled',
  'Sam''s overlapping challenge to Quinn is cancelled');
select is((select status from public.challenges where challenge_id = 2004), 'pending',
  'Sam''s challenge to Pat at another time stays pending');
select is((select status from public.challenges where challenge_id = 2005), 'pending',
  'Pat''s back to back challenge to Sam stays pending');
select ok((select closed_at is not null from public.challenges where challenge_id = 2002),
  'a cancelled challenge gets closed_at, so it shows in RECENT');

-- Backstop: a pending challenge that slipped past the cancel (two accepts at the same
-- moment), made here by inserting it after the accept.
insert into public.challenges
  (challenge_id, challenger_id, opponent_id, court_id, ranked, starts_at, duration_minutes, status)
overriding system value
values (2006, 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005',
        (select court_id from public.courts where name = 'Denny Courts'),
        false, now() + interval '5 days 15 minutes', 30, 'pending');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "b0000000-0000-0000-0000-000000000005", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.accept_challenge(2006) $$,
  '22023', 'Time no longer available.',
  'Tia can''t accept: Pat already has a match then (and the message doesn''t say why)');

select * from finish();
rollback;
