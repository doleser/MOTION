-- pgTAP tests for elo_delta, preview_elo, confirm_result, and dispute_result.
-- Rows are set up as postgres. Reporting a result is not in this slice, so the
-- pending games are inserted here. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'cara@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'dev@test.local');

-- Alice 800, Bob 950 (150 above her), Cara and Dev 800.
update public.profiles set elo = 800
 where user_id in (
   '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444');
update public.profiles set elo = 950
 where user_id = '22222222-2222-2222-2222-222222222222';

-- Alice reports every game. 301 is the ranked confirm (Bob won). 304 is casual.
-- 307 is already confirmed. Ids start at 301 so they stay clear of other tests.
insert into public.games
  (game_id, court_id, ranked, status, winning_side, reported_by, created_at, confirmed_at)
overriding system value
select v.game_id, c.court_id, v.ranked, v.status, v.winning_side,
       '11111111-1111-1111-1111-111111111111',
       now() - interval '1 hour',
       case when v.status = 'confirmed' then now() end
  from (values
    (301, true,  'pending',   2),
    (302, true,  'pending',   2),
    (303, true,  'pending',   1),
    (304, false, 'pending',   1),
    (305, true,  'pending',   1),
    (306, true,  'pending',   1),
    (307, true,  'confirmed', 2)
  ) as v (game_id, ranked, status, winning_side)
  join public.courts c on c.name = 'Denny Courts';

insert into public.game_players (game_id, user_id, side) values
  (301, '11111111-1111-1111-1111-111111111111', 1),
  (301, '22222222-2222-2222-2222-222222222222', 2),
  (302, '11111111-1111-1111-1111-111111111111', 1),
  (302, '22222222-2222-2222-2222-222222222222', 2),
  (303, '11111111-1111-1111-1111-111111111111', 1),
  (303, '33333333-3333-3333-3333-333333333333', 2),
  (304, '11111111-1111-1111-1111-111111111111', 1),
  (304, '22222222-2222-2222-2222-222222222222', 2),
  (305, '11111111-1111-1111-1111-111111111111', 1),
  (305, '44444444-4444-4444-4444-444444444444', 2),
  (306, '11111111-1111-1111-1111-111111111111', 1),
  (306, '33333333-3333-3333-3333-333333333333', 2),
  (307, '11111111-1111-1111-1111-111111111111', 1),
  (307, '22222222-2222-2222-2222-222222222222', 2);

-- ---------------------------------------------------------
-- Formula, as postgres (clients cannot call elo_delta)
-- ---------------------------------------------------------
select is(public.elo_delta(800, 800), 16, 'an even game moves 16');
select is(public.elo_delta(800, 950), 23, 'a 150-point underdog gains 23 for a win');
select is(public.elo_delta(950, 800), 9, 'a 150-point favorite gains 9 for a win');
select is(public.elo_delta(400, 800), 29, 'a 400-point underdog gains 29 for a win');
select is(public.elo_delta(800, 400), 3, 'a 400-point favorite gains 3 for a win');

-- ---------------------------------------------------------
-- preview_elo
-- ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select results_eq(
  $$ select win, lose from public.preview_elo('22222222-2222-2222-2222-222222222222') $$,
  $$ values (23, -9) $$,
  'Alice, 150 points below Bob, previews +23 / -9'
);

select set_config('request.jwt.claims',
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select results_eq(
  $$ select win, lose from public.preview_elo('44444444-4444-4444-4444-444444444444') $$,
  $$ values (16, -16) $$,
  'an even pair previews +16 / -16'
);

select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.preview_elo('11111111-1111-1111-1111-111111111111') $$,
  '22023',
  'You can''t play yourself.',
  'a player cannot preview a game against themselves'
);

select throws_ok(
  $$ select * from public.preview_elo('99999999-9999-9999-9999-999999999999') $$,
  '22023',
  'Opponent not found.',
  'an unknown opponent is rejected'
);

select throws_ok(
  $$ select * from public.preview_elo(null) $$,
  '22023',
  'Opponent is required.',
  'preview requires an opponent'
);

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.preview_elo('22222222-2222-2222-2222-222222222222') $$,
  '42501',
  'Not signed in.',
  'preview requires a signed-in player'
);

-- ---------------------------------------------------------
-- confirm_result errors
-- ---------------------------------------------------------
select throws_ok(
  $$ select * from public.confirm_result(301) $$,
  '42501',
  'Not signed in.',
  'confirm requires a signed-in player'
);

select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.confirm_result(null) $$,
  '22023',
  'Game is required.',
  'confirm requires a game'
);

select throws_ok(
  $$ select * from public.confirm_result(999) $$,
  '22023',
  'Game not found.',
  'confirm of a missing game is rejected'
);

select set_config('request.jwt.claims',
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.confirm_result(303) $$,
  '22023',
  'Game not found.',
  'a player who is not in the game cannot confirm it'
);

select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.confirm_result(302) $$,
  '22023',
  'The other player confirms this result.',
  'the reporter cannot confirm their own result'
);

select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.confirm_result(307) $$,
  '22023',
  'Result is not waiting for confirmation.',
  'a confirmed game cannot be confirmed again'
);

-- ---------------------------------------------------------
-- dispute_result
-- ---------------------------------------------------------
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.dispute_result(305) $$,
  '42501',
  'Not signed in.',
  'dispute requires a signed-in player'
);

select set_config('request.jwt.claims',
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.dispute_result(null) $$,
  '22023',
  'Game is required.',
  'dispute requires a game'
);

select throws_ok(
  $$ select * from public.dispute_result(999) $$,
  '22023',
  'Game not found.',
  'dispute of a missing game is rejected'
);

select throws_ok(
  $$ select * from public.dispute_result(303) $$,
  '22023',
  'Game not found.',
  'a player who is not in the game cannot dispute it'
);

select results_eq(
  $$ select status from public.dispute_result(305) $$,
  $$ values ('voided') $$,
  'dispute voids the game'
);

select results_eq(
  $$ select user_id, elo from public.profiles
      where user_id in (
        '11111111-1111-1111-1111-111111111111',
        '44444444-4444-4444-4444-444444444444')
      order by user_id $$,
  $$ values
       ('11111111-1111-1111-1111-111111111111'::uuid, 800),
       ('44444444-4444-4444-4444-444444444444'::uuid, 800) $$,
  'a void leaves profiles.elo unchanged'
);

select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.dispute_result(306) $$,
  '22023',
  'The other player confirms this result.',
  'the reporter cannot dispute their own result'
);

select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.dispute_result(307) $$,
  '22023',
  'Result is not waiting for confirmation.',
  'a confirmed game cannot be disputed'
);

-- ---------------------------------------------------------
-- casual confirm, then the ranked confirm
-- ---------------------------------------------------------
select results_eq(
  $$ select game_id, elo_before, elo_after from public.confirm_result(304) $$,
  $$ values (304::bigint, 950, 950) $$,
  'a casual confirm returns the caller''s rating unchanged'
);

-- elo_history is visible only to its owner under RLS, so read it as the table owner.
reset role;

select is_empty(
  $$ select 1 from public.elo_history where game_id = 304 $$,
  'a casual confirm writes no Elo history'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select results_eq(
  $$ select user_id, elo from public.profiles
      where user_id in (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222')
      order by user_id $$,
  $$ values
       ('11111111-1111-1111-1111-111111111111'::uuid, 800),
       ('22222222-2222-2222-2222-222222222222'::uuid, 950) $$,
  'a casual confirm does not change Elo'
);

select results_eq(
  $$ select game_id, elo_before, elo_after from public.confirm_result(301) $$,
  $$ values (301::bigint, 950, 959) $$,
  'Bob confirming his win goes from 950 to 959'
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
  'confirm moves both ratings by the same amount'
);

reset role;

select results_eq(
  $$ select user_id, elo_before, elo_after
       from public.elo_history
      where game_id = 301
      order by user_id $$,
  $$ values
       ('11111111-1111-1111-1111-111111111111'::uuid, 800, 791),
       ('22222222-2222-2222-2222-222222222222'::uuid, 950, 959) $$,
  'confirm writes both Elo history rows'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.confirm_result(301) $$,
  '22023',
  'Result is not waiting for confirmation.',
  'confirming the same game again is rejected'
);

-- ---------------------------------------------------------
-- Grants
-- ---------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select throws_ok(
  $$ select * from public.preview_elo('22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'anon cannot execute preview_elo'
);

select throws_ok(
  $$ select * from public.confirm_result(301) $$,
  '42501', null,
  'anon cannot execute confirm_result'
);

select throws_ok(
  $$ select * from public.dispute_result(302) $$,
  '42501', null,
  'anon cannot execute dispute_result'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.elo_delta(800, 800) $$,
  '42501', null,
  'authenticated cannot execute elo_delta'
);

select * from finish();
rollback;
