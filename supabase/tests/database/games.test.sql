-- pgTAP tests for public.games, game_players, and elo_history: checks and foreign keys,
-- no client writes, RLS (players see only the games they played in), and player_record
-- (the Player Profile screen's W/L, streak, and recent form).
-- Rows are set up as postgres, since the result functions are Jace's.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- Alice and Bob have played 9 games at Denny. Cara beat Erin at Ravenna. Dev has no games.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'cara@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'dev@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'erin@test.local');

-- Explicit ids so the rows below can refer to them. They start at 101 so the identity
-- sequence (which starts at 1) can't collide with them.
-- Alice is side 1, so winning_side = 1 is an Alice win. Oldest first:
--   101 W, 102 W, 103 L, 104 L, 105 W, 106 W  (confirmed, ranked)
--   107 L pending, 108 L voided, 109 L casual  (newer, but none of them count)
insert into public.games
  (game_id, court_id, ranked, status, winning_side, reported_by, created_at, confirmed_at)
overriding system value
select v.game_id, c.court_id, v.ranked, v.status, v.winning_side, v.reported_by,
       now() - v.ago - interval '1 hour',
       case when v.status = 'confirmed' then now() - v.ago end
  from (values
    (101, 'Denny Courts', true,  'confirmed', 1, '11111111-1111-1111-1111-111111111111'::uuid, interval '7 days'),
    (102, 'Denny Courts', true,  'confirmed', 1, '11111111-1111-1111-1111-111111111111'::uuid, interval '6 days'),
    (103, 'Denny Courts', true,  'confirmed', 2, '22222222-2222-2222-2222-222222222222'::uuid, interval '5 days'),
    (104, 'Denny Courts', true,  'confirmed', 2, '22222222-2222-2222-2222-222222222222'::uuid, interval '4 days'),
    (105, 'Denny Courts', true,  'confirmed', 1, '11111111-1111-1111-1111-111111111111'::uuid, interval '3 days'),
    (106, 'Denny Courts', true,  'confirmed', 1, '22222222-2222-2222-2222-222222222222'::uuid, interval '2 days'),
    (107, 'Denny Courts', true,  'pending',   2, '22222222-2222-2222-2222-222222222222'::uuid, interval '1 hour'),
    (108, 'Denny Courts', true,  'voided',    2, '22222222-2222-2222-2222-222222222222'::uuid, interval '1 day'),
    (109, 'Denny Courts', false, 'confirmed', 2, '22222222-2222-2222-2222-222222222222'::uuid, interval '1 day'),
    (110, 'Ravenna Park', true,  'confirmed', 1, '33333333-3333-3333-3333-333333333333'::uuid, interval '1 day')
  ) as v (game_id, court_name, ranked, status, winning_side, reported_by, ago)
  join public.courts c on c.name = v.court_name;

insert into public.game_players (game_id, user_id, side)
select g, '11111111-1111-1111-1111-111111111111'::uuid, 1 from generate_series(101, 109) g
union all
select g, '22222222-2222-2222-2222-222222222222'::uuid, 2 from generate_series(101, 109) g
union all
values (110, '33333333-3333-3333-3333-333333333333'::uuid, 1),
       (110, '55555555-5555-5555-5555-555555555555'::uuid, 2);

insert into public.elo_history (user_id, game_id, elo_before, elo_after) values
  ('11111111-1111-1111-1111-111111111111', 106, 1490, 1506),
  ('22222222-2222-2222-2222-222222222222', 106, 1510, 1494);

-- ---------------------------------------------------------
-- Schema
-- ---------------------------------------------------------
select has_index('public', 'game_players', 'game_players_user_id_idx',
  'game_players has an index on user_id for a player''s games');

-- ---------------------------------------------------------
-- player_record (as postgres)
-- ---------------------------------------------------------
select results_eq(
  $$ select * from public.player_record('11111111-1111-1111-1111-111111111111') $$,
  $$ values (4, 2, 2, '{W,L,L,W,W}'::text[]) $$,
  'Alice: 4-2, W2, last 5 oldest first; pending, voided, and casual games not counted'
);

select results_eq(
  $$ select * from public.player_record('22222222-2222-2222-2222-222222222222') $$,
  $$ values (2, 4, -2, '{L,W,W,L,L}'::text[]) $$,
  'Bob: 2-4, L2 (a negative streak)'
);

select results_eq(
  $$ select * from public.player_record('33333333-3333-3333-3333-333333333333') $$,
  $$ values (1, 0, 1, '{W}'::text[]) $$,
  'Cara: one game, so recent has one result'
);

select results_eq(
  $$ select * from public.player_record('44444444-4444-4444-4444-444444444444') $$,
  $$ values (0, 0, 0, '{}'::text[]) $$,
  'Dev: no games gives 0-0, streak 0, and an empty recent list'
);

-- ---------------------------------------------------------
-- Checks and foreign keys
-- ---------------------------------------------------------
select throws_ok(
  $$ insert into public.games (court_id, ranked, winning_side)
      values ((select court_id from public.courts where name = 'Denny Courts'), true, 3) $$,
  '23514', null,
  'winning_side must be 1 or 2'
);

select throws_ok(
  $$ insert into public.games (court_id, ranked, winning_side)
      values ((select court_id from public.courts where name = 'Denny Courts'), true, null) $$,
  '23502', null,
  'a game is created when the result is reported, so winning_side is required'
);

select throws_ok(
  $$ insert into public.games (court_id, ranked, status, winning_side)
      values ((select court_id from public.courts where name = 'Denny Courts'), true, 'disputed', 1) $$,
  '23514', null,
  'status must be pending, confirmed, or voided'
);

select throws_ok(
  $$ insert into public.games (court_id, ranked, status, winning_side)
      values ((select court_id from public.courts where name = 'Denny Courts'), true, 'confirmed', 1) $$,
  '23514', null,
  'a confirmed game needs confirmed_at'
);

select throws_ok(
  $$ insert into public.games (court_id, ranked, status, winning_side, confirmed_at)
      values ((select court_id from public.courts where name = 'Denny Courts'), true, 'confirmed', 1,
              now() - interval '1 hour') $$,
  '23514', null,
  'confirmed_at cannot be before created_at'
);

select throws_ok(
  $$ insert into public.games (court_id, ranked, winning_side) values (-1, true, 1) $$,
  '23503', null,
  'a game must be at a real court'
);

select throws_ok(
  $$ delete from public.courts where name = 'Ravenna Park' $$,
  '23503', null,
  'a court with games cannot be deleted (on delete restrict)'
);

select throws_ok(
  $$ insert into public.game_players (game_id, user_id, side)
      values (110, '44444444-4444-4444-4444-444444444444', 3) $$,
  '23514', null,
  'side must be 1 or 2'
);

select throws_ok(
  $$ insert into public.game_players (game_id, user_id, side)
      values (110, '33333333-3333-3333-3333-333333333333', 2) $$,
  '23505', null,
  'a player is in a game only once'
);

select throws_ok(
  $$ insert into public.elo_history (user_id, game_id, elo_before, elo_after)
      values ('11111111-1111-1111-1111-111111111111', 106, 1506, 1520) $$,
  '23505', null,
  'at most one Elo change per player for a game'
);

-- ---------------------------------------------------------
-- No client writes (as Alice)
-- ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ insert into public.games (court_id, ranked, status, winning_side, confirmed_at)
      values ((select court_id from public.courts where name = 'Denny Courts'), true, 'confirmed', 1, now()) $$,
  '42501', null,
  'user cannot insert games directly'
);

select throws_ok(
  $$ update public.games set winning_side = 1 where game_id = 103 $$,
  '42501', null,
  'user cannot change a game''s winner'
);

select throws_ok(
  $$ delete from public.games where game_id = 103 $$,
  '42501', null,
  'user cannot delete games'
);

select throws_ok(
  $$ insert into public.game_players (game_id, user_id, side)
      values (110, '11111111-1111-1111-1111-111111111111', 1) $$,
  '42501', null,
  'user cannot add themselves to a game'
);

select throws_ok(
  $$ delete from public.game_players where game_id = 103 $$,
  '42501', null,
  'user cannot remove players from a game'
);

select throws_ok(
  $$ insert into public.elo_history (user_id, elo_before, elo_after)
      values ('11111111-1111-1111-1111-111111111111', 1506, 3000) $$,
  '42501', null,
  'user cannot insert Elo history'
);

select throws_ok(
  $$ update public.elo_history set elo_after = 3000
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'user cannot update Elo history'
);

-- ---------------------------------------------------------
-- RLS: who sees which games (as Alice)
-- ---------------------------------------------------------
select set_eq(
  $$ select game_id from public.games $$,
  $$ select generate_series(101, 109)::bigint $$,
  'Alice sees all of her games, including pending, voided, and casual ones'
);

select set_eq(
  $$ select distinct user_id from public.game_players $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid),
            ('22222222-2222-2222-2222-222222222222'::uuid) $$,
  'Alice sees her opponent''s game_players rows, but no one from games she wasn''t in'
);

select results_eq(
  $$ select user_id from public.elo_history $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'Alice sees only her own Elo history'
);

select results_eq(
  $$ select * from public.player_record('33333333-3333-3333-3333-333333333333') $$,
  $$ values (1, 0, 1, '{W}'::text[]) $$,
  'any signed-in user can see another player''s record'
);

select set_config('request.jwt.claims',
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);

select is_empty(
  $$ select * from public.games $$,
  'Dev, with no games, sees no games'
);

select is_empty(
  $$ select * from public.game_players $$,
  'Dev, with no games, sees no game_players rows'
);

set local role anon;
select set_config('request.jwt.claims', '', true);

select is_empty(
  $$ select * from public.games $$,
  'anon cannot read games'
);

select is_empty(
  $$ select * from public.elo_history $$,
  'anon cannot read Elo history'
);

select throws_ok(
  $$ select * from public.player_record('11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'anon cannot call player_record'
);

-- ---------------------------------------------------------
-- Deleting an account
-- ---------------------------------------------------------
reset role;
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';

select is_empty(
  $$ select * from public.game_players where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'deleting the auth user removes them from their games'
);

select results_eq(
  $$ select * from public.player_record('11111111-1111-1111-1111-111111111111') $$,
  $$ values (4, 2, 2, '{W,L,L,W,W}'::text[]) $$,
  'the opponent''s record is unchanged after the account is deleted'
);

select is(
  (select reported_by from public.games where game_id = 103),
  null::uuid,
  'a deleted reporter leaves the game in place with reported_by = null'
);

select * from finish();
rollback;
