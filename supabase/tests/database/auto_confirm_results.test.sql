-- pgTAP: a pending result reported at least 24 hours ago is confirmed.
-- Ranked games move both ratings. Casual games and a game missing a player
-- confirm with no Elo change. A younger pending game and a void stay as they are.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'cara@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'dev@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'eve@test.local');

-- Alice 800, Bob 950, everyone else 800.
update public.profiles set elo = 800
 where user_id in (
   '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444',
   '55555555-5555-5555-5555-555555555555');
update public.profiles set elo = 950
 where user_id = '22222222-2222-2222-2222-222222222222';

-- 401 ranked, reported exactly 24 hours ago, Bob won.
-- 402 ranked, reported 23 hours ago.
-- 403 voided, reported 25 hours ago.
-- 404 casual pending, reported 25 hours ago.
-- 405 ranked, reported 25 hours ago; Dev is deleted before the sweep.
insert into public.games
  (game_id, court_id, ranked, status, winning_side, reported_by, created_at)
overriding system value
select v.game_id, c.court_id, v.ranked, v.status, v.winning_side, v.reported_by,
       now() - v.age
  from (values
    (401, true,  'pending', 2, '11111111-1111-1111-1111-111111111111'::uuid, interval '24 hours'),
    (402, true,  'pending', 1, '11111111-1111-1111-1111-111111111111'::uuid, interval '23 hours'),
    (403, true,  'voided',  1, '33333333-3333-3333-3333-333333333333'::uuid, interval '25 hours'),
    (404, false, 'pending', 1, '11111111-1111-1111-1111-111111111111'::uuid, interval '25 hours'),
    (405, true,  'pending', 1, '55555555-5555-5555-5555-555555555555'::uuid, interval '25 hours')
  ) as v (game_id, ranked, status, winning_side, reported_by, age)
  join public.courts c on c.name = 'Denny Courts';

insert into public.game_players (game_id, user_id, side) values
  (401, '11111111-1111-1111-1111-111111111111', 1),
  (401, '22222222-2222-2222-2222-222222222222', 2),
  (402, '11111111-1111-1111-1111-111111111111', 1),
  (402, '33333333-3333-3333-3333-333333333333', 2),
  (403, '33333333-3333-3333-3333-333333333333', 1),
  (403, '22222222-2222-2222-2222-222222222222', 2),
  (404, '11111111-1111-1111-1111-111111111111', 1),
  (404, '33333333-3333-3333-3333-333333333333', 2),
  (405, '44444444-4444-4444-4444-444444444444', 1),
  (405, '55555555-5555-5555-5555-555555555555', 2);

delete from auth.users where id = '44444444-4444-4444-4444-444444444444';

select is(
  public.auto_confirm_results(),
  3,
  'the sweep confirms the three pending games at least 24 hours old'
);

select is(
  (select status from public.games where game_id = 401),
  'confirmed',
  'a ranked game reported 24 hours ago is confirmed'
);

select results_eq(
  $$ select user_id, elo_before, elo_after
       from public.elo_history
      where game_id = 401
      order by user_id $$,
  $$ values
       ('11111111-1111-1111-1111-111111111111'::uuid, 800, 791),
       ('22222222-2222-2222-2222-222222222222'::uuid, 950, 959) $$,
  'the sweep writes both Elo history rows'
);

select results_eq(
  $$ select user_id, elo from public.profiles
      where user_id in (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222')
      order by user_id $$,
  $$ values
       ('11111111-1111-1111-1111-111111111111'::uuid, 791),
       ('22222222-2222-2222-2222-222222222222'::uuid, 959) $$,
  'the sweep moves both ratings by the same amount'
);

select is(
  (select status from public.games where game_id = 402),
  'pending',
  'a ranked game reported 23 hours ago stays pending'
);

select is_empty(
  $$ select 1 from public.elo_history where game_id = 402 $$,
  'a game inside the window writes no Elo history'
);

select is(
  (select status from public.games where game_id = 403),
  'voided',
  'a voided game is not confirmed by the sweep'
);

select is_empty(
  $$ select 1 from public.elo_history where game_id = 403 $$,
  'a voided game writes no Elo history'
);

select is(
  (select status from public.games where game_id = 404),
  'confirmed',
  'a pending casual game past the window is confirmed'
);

select is_empty(
  $$ select 1 from public.elo_history where game_id = 404 $$,
  'a casual confirm writes no Elo history'
);

select is(
  (select elo from public.profiles where user_id = '33333333-3333-3333-3333-333333333333'),
  800,
  'a player outside the ranked confirm keeps their rating'
);

select is(
  (select status from public.games where game_id = 405),
  'confirmed',
  'a game missing a player is confirmed so the sweep can finish'
);

select is_empty(
  $$ select 1 from public.elo_history where game_id = 405 $$,
  'a game missing a player writes no Elo history'
);

select is(
  (select elo from public.profiles where user_id = '55555555-5555-5555-5555-555555555555'),
  800,
  'the remaining player keeps their rating'
);

select is_empty(
  $$ select 1 from public.profiles where user_id = '44444444-4444-4444-4444-444444444444' $$,
  'the deleted account is gone'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.auto_confirm_results() $$,
  '42501', null,
  'authenticated cannot execute auto_confirm_results'
);

select throws_ok(
  $$ select public.finalize_confirmed_game(402) $$,
  '42501', null,
  'authenticated cannot execute finalize_confirmed_game'
);

select * from finish();
rollback;
