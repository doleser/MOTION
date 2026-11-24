-- pgTAP: dispute warnings and the 7-day ranked ban.
-- Covers games.disputed_at checks, profiles.ranked_banned_until protection,
-- four disputes with no ban, an older dispute aging out at one month, a fifth
-- dispute setting a 7-day ban, rejecting new ranked challenges during the ban
-- while casual challenges and already-accepted ranked matches stay allowed,
-- preserving a longer ban, and lifting the ban once it expires.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'alice_w@test.local'),
  ('d0000000-0000-0000-0000-000000000002', 'bob_w@test.local'),
  ('d0000000-0000-0000-0000-000000000003', 'cara_w@test.local'),
  ('d0000000-0000-0000-0000-000000000004', 'dev_w@test.local');

update public.profiles
   set elo = 800,
       onboarded_at = now(),
       username = case user_id
         when 'd0000000-0000-0000-0000-000000000001' then 'alice_w'
         when 'd0000000-0000-0000-0000-000000000002' then 'bob_w'
         when 'd0000000-0000-0000-0000-000000000003' then 'cara_w'
         else 'dev_w'
       end,
       real_name = case user_id
         when 'd0000000-0000-0000-0000-000000000001' then 'Alice W'
         when 'd0000000-0000-0000-0000-000000000002' then 'Bob W'
         when 'd0000000-0000-0000-0000-000000000003' then 'Cara W'
         else 'Dev W'
       end
 where user_id in (
   'd0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000003',
   'd0000000-0000-0000-0000-000000000004');

-- 501-503: 3 recent disputes for Alice & Bob (inside the last month).
-- 504: 1 dispute for Alice & Cara at the 1-month boundary (aged out).
-- 505: pending ranked game Alice vs Cara (Alice's 4th in the last month).
-- 506: pending ranked game Alice vs Dev  (Alice's 5th in the last month).
-- 507: pending ranked game Alice vs Dev  (confirmed after Alice is banned).
-- 508: pending ranked game Alice vs Dev  (disputed while a 10-day ban is active).
insert into public.games
  (game_id, court_id, ranked, status, winning_side, reported_by, created_at, disputed_at)
overriding system value
select v.game_id, c.court_id, true, v.status, v.winning_side, v.reported_by,
       now() - v.created_ago,
       case when v.disputed_ago is not null then now() - v.disputed_ago end
  from (values
    (501, 'voided',  1, 'd0000000-0000-0000-0000-000000000001'::uuid, interval '10 days',  interval '9 days'),
    (502, 'voided',  1, 'd0000000-0000-0000-0000-000000000001'::uuid, interval '8 days',   interval '7 days'),
    (503, 'voided',  1, 'd0000000-0000-0000-0000-000000000001'::uuid, interval '6 days',   interval '5 days'),
    (504, 'voided',  1, 'd0000000-0000-0000-0000-000000000001'::uuid, interval '2 months', interval '1 month'),
    (505, 'pending', 1, 'd0000000-0000-0000-0000-000000000001'::uuid, interval '1 hour',   null::interval),
    (506, 'pending', 1, 'd0000000-0000-0000-0000-000000000001'::uuid, interval '1 hour',   null::interval),
    (507, 'pending', 2, 'd0000000-0000-0000-0000-000000000001'::uuid, interval '30 mins',  null::interval),
    (508, 'pending', 1, 'd0000000-0000-0000-0000-000000000004'::uuid, interval '20 mins',  null::interval)
  ) as v (game_id, status, winning_side, reported_by, created_ago, disputed_ago)
  join public.courts c on c.name = 'Denny Courts';

insert into public.game_players (game_id, user_id, side) values
  (501, 'd0000000-0000-0000-0000-000000000001', 1),
  (501, 'd0000000-0000-0000-0000-000000000002', 2),
  (502, 'd0000000-0000-0000-0000-000000000001', 1),
  (502, 'd0000000-0000-0000-0000-000000000002', 2),
  (503, 'd0000000-0000-0000-0000-000000000001', 1),
  (503, 'd0000000-0000-0000-0000-000000000002', 2),
  (504, 'd0000000-0000-0000-0000-000000000001', 1),
  (504, 'd0000000-0000-0000-0000-000000000003', 2),
  (505, 'd0000000-0000-0000-0000-000000000001', 1),
  (505, 'd0000000-0000-0000-0000-000000000003', 2),
  (506, 'd0000000-0000-0000-0000-000000000001', 1),
  (506, 'd0000000-0000-0000-0000-000000000004', 2),
  (507, 'd0000000-0000-0000-0000-000000000001', 1),
  (507, 'd0000000-0000-0000-0000-000000000004', 2),
  (508, 'd0000000-0000-0000-0000-000000000001', 1),
  (508, 'd0000000-0000-0000-0000-000000000004', 2);

-- Already-accepted ranked match (Alice vs Bob) ready to report while Alice is banned.
insert into public.challenges
  (challenge_id, challenger_id, opponent_id, court_id, ranked, starts_at, duration_minutes, status)
overriding system value
values (
  3001,
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  (select court_id from public.courts where name = 'Denny Courts'),
  true,
  now() - interval '1 hour',
  60,
  'confirmed'
);

-- ---------------------------------------------------------
-- Schema checks
-- ---------------------------------------------------------
select throws_ok(
  $$ insert into public.games (court_id, ranked, status, winning_side, disputed_at)
      values ((select court_id from public.courts where name = 'Denny Courts'),
              true, 'pending', 1, now()) $$,
  '23514', null,
  'disputed_at must be null on a pending game'
);

select throws_ok(
  $$ insert into public.games (court_id, ranked, status, winning_side, confirmed_at, disputed_at)
      values ((select court_id from public.courts where name = 'Denny Courts'),
              true, 'confirmed', 1, now(), now()) $$,
  '23514', null,
  'disputed_at must be null on a confirmed game'
);

select throws_ok(
  $$ insert into public.games (court_id, ranked, status, winning_side, created_at, disputed_at)
      values ((select court_id from public.courts where name = 'Denny Courts'),
              true, 'voided', 1, now(), now() - interval '1 hour') $$,
  '23514', null,
  'disputed_at cannot be before created_at'
);

-- ---------------------------------------------------------
-- Client cannot write ranked_banned_until
-- ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select throws_ok(
  $$ update public.profiles
        set ranked_banned_until = null
      where user_id = 'd0000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'user cannot update their own ranked_banned_until'
);

-- ---------------------------------------------------------
-- 4th dispute in the last month (+ 1 aged out at 1 month): no ban
-- ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "d0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);

select results_eq(
  $$ select status, disputed_at from public.dispute_result(505) $$,
  $$ values ('voided', now()) $$,
  'dispute voids the game and stamps disputed_at'
);

select is(
  (select ranked_banned_until from public.profiles
    where user_id = 'd0000000-0000-0000-0000-000000000001'),
  null::timestamptz,
  'four disputes in the last month plus one aged out do not ban Alice'
);

select is(
  (select ranked_banned_until from public.profiles
    where user_id = 'd0000000-0000-0000-0000-000000000003'),
  null::timestamptz,
  'Cara stays unbanned after one recent dispute'
);

-- ---------------------------------------------------------
-- 5th dispute in the last month: 7-day ranked ban for Alice only
-- ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "d0000000-0000-0000-0000-000000000004", "role": "authenticated"}', true);

select results_eq(
  $$ select status, disputed_at from public.dispute_result(506) $$,
  $$ values ('voided', now()) $$,
  'fifth dispute voids the game and stamps disputed_at'
);

select is(
  (select ranked_banned_until from public.profiles
    where user_id = 'd0000000-0000-0000-0000-000000000001'),
  now() + interval '7 days',
  'fifth dispute in the last month sets a 7-day ranked ban on Alice'
);

select is(
  (select ranked_banned_until from public.profiles
    where user_id = 'd0000000-0000-0000-0000-000000000004'),
  null::timestamptz,
  'Dev stays unbanned after one recent dispute'
);

-- ---------------------------------------------------------
-- Effects of the ban: ranked create blocked; casual & existing matches allowed
-- ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.create_challenge(
       'd0000000-0000-0000-0000-000000000002',
       true,
       (select court_id from public.courts where name = 'Denny Courts'),
       now() + interval '2 days',
       30) $$,
  '22023',
  'Ranked play is temporarily restricted.',
  'a banned player cannot create a ranked challenge'
);

select ok(
  public.create_challenge(
    'd0000000-0000-0000-0000-000000000002',
    false,
    (select court_id from public.courts where name = 'Denny Courts'),
    now() + interval '2 days',
    30) is not null,
  'a banned player can still create a casual challenge'
);

select ok(
  public.report_result(3001, 'd0000000-0000-0000-0000-000000000001') is not null,
  'a banned player can still report an already-accepted ranked match'
);

select set_config('request.jwt.claims',
  '{"sub": "d0000000-0000-0000-0000-000000000004", "role": "authenticated"}', true);

select results_eq(
  $$ select game_id, elo_before, elo_after from public.confirm_result(507) $$,
  $$ values (507::bigint, 800, 816) $$,
  'an already-reported ranked match can still be confirmed while a player is banned'
);

-- ---------------------------------------------------------
-- Existing longer ban is kept; expired ban lifts ranked create
-- ---------------------------------------------------------
reset role;
update public.profiles
   set ranked_banned_until = now() + interval '10 days'
 where user_id = 'd0000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select is(
  (select status from public.dispute_result(508)),
  'voided',
  'a sixth dispute still voids the game'
);

select is(
  (select ranked_banned_until from public.profiles
    where user_id = 'd0000000-0000-0000-0000-000000000001'),
  now() + interval '10 days',
  'another dispute does not shorten an existing longer ban'
);

reset role;
update public.profiles
   set ranked_banned_until = now()
 where user_id = 'd0000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select ok(
  public.create_challenge(
    'd0000000-0000-0000-0000-000000000003',
    true,
    (select court_id from public.courts where name = 'Denny Courts'),
    now() + interval '3 days',
    30) is not null,
  'once ranked_banned_until is no longer in the future, ranked challenges work again'
);

select * from finish();
rollback;
