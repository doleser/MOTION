-- pgTAP: King of the Court sessions, queue, results, and visibility.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(56);

insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'alice.kot@test.local'),
  ('a2222222-2222-2222-2222-222222222222', 'bob.kot@test.local'),
  ('a3333333-3333-3333-3333-333333333333', 'cara.kot@test.local'),
  ('a4444444-4444-4444-4444-444444444444', 'dev.kot@test.local'),
  ('a5555555-5555-5555-5555-555555555555', 'erin.kot@test.local'),
  ('a6666666-6666-6666-6666-666666666666', 'gus.kot@test.local'),
  ('a7777777-7777-7777-7777-777777777777', 'finn.kot@test.local');

update public.profiles
   set elo = 800,
       onboarded_at = now(),
       username = case user_id
         when 'a1111111-1111-1111-1111-111111111111' then 'kota'
         when 'a2222222-2222-2222-2222-222222222222' then 'kotb'
         when 'a3333333-3333-3333-3333-333333333333' then 'kotc'
         when 'a4444444-4444-4444-4444-444444444444' then 'kotd'
         when 'a5555555-5555-5555-5555-555555555555' then 'kote'
         when 'a6666666-6666-6666-6666-666666666666' then 'kotg'
         else 'kotf'
       end,
       real_name = case user_id
         when 'a1111111-1111-1111-1111-111111111111' then 'Alice Kot'
         when 'a2222222-2222-2222-2222-222222222222' then 'Bob Kot'
         when 'a3333333-3333-3333-3333-333333333333' then 'Cara Kot'
         when 'a4444444-4444-4444-4444-444444444444' then 'Dev Kot'
         when 'a5555555-5555-5555-5555-555555555555' then 'Erin Kot'
         when 'a6666666-6666-6666-6666-666666666666' then 'Gus Kot'
         else 'Finn Kot'
       end
 where user_id in (
   'a1111111-1111-1111-1111-111111111111',
   'a2222222-2222-2222-2222-222222222222',
   'a3333333-3333-3333-3333-333333333333',
   'a4444444-4444-4444-4444-444444444444',
   'a5555555-5555-5555-5555-555555555555',
   'a6666666-6666-6666-6666-666666666666',
   'a7777777-7777-7777-7777-777777777777');

select set_config(
  'test.denny',
  (select court_id::text from public.courts where name = 'Denny Courts'),
  true
);

-- The app reads sessions only through RPCs. These tests read the tables directly.
grant select on public.sessions to authenticated;
grant select on public.session_players to authenticated;
create policy kotc_test_read_sessions on public.sessions
  for select to authenticated using (true);
create policy kotc_test_read_players on public.session_players
  for select to authenticated using (true);

insert into public.check_ins (user_id, court_id)
select u, current_setting('test.denny')::bigint
  from unnest(array[
    'a1111111-1111-1111-1111-111111111111',
    'a2222222-2222-2222-2222-222222222222',
    'a3333333-3333-3333-3333-333333333333',
    'a4444444-4444-4444-4444-444444444444',
    'a5555555-5555-5555-5555-555555555555',
    'a6666666-6666-6666-6666-666666666666'
  ]::uuid[]) u;

-- ---------------------------------------------------------
-- Start guards
-- ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);

select throws_ok(
  $$ select public.start_kotc_session(current_setting('test.denny')::bigint, true) $$,
  '42501', 'Not signed in.',
  'starting a session requires a signed-in player'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a7777777-7777-7777-7777-777777777777","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.start_kotc_session(current_setting('test.denny')::bigint, true) $$,
  '22023', 'Not checked in.',
  'a player who is not checked in cannot start'
);

reset role;
update public.courts set status = 'closed' where court_id = current_setting('test.denny')::bigint;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.start_kotc_session(current_setting('test.denny')::bigint, true) $$,
  '22023', 'Court is not available.',
  'a closed court cannot host a session'
);
reset role;
update public.courts set status = 'active' where court_id = current_setting('test.denny')::bigint;

update public.profiles
   set ranked_banned_until = now() + interval '2 days'
 where user_id = 'a4444444-4444-4444-4444-444444444444';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a4444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.start_kotc_session(current_setting('test.denny')::bigint, true) $$,
  '22023', 'Ranked play is paused.',
  'a ranked ban blocks a ranked start'
);
select set_config(
  'test.dev_casual',
  public.start_kotc_session(current_setting('test.denny')::bigint, false)::text,
  true
);
select is(
  (public.get_court_sessions(current_setting('test.denny')::bigint) -> 0 -> 'king' ->> 'user_id'),
  'a4444444-4444-4444-4444-444444444444',
  'a casual start still makes the caller king while they are banned'
);
select public.leave_kotc_session(current_setting('test.dev_casual')::bigint);

-- ---------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select set_config(
  'test.s1',
  public.start_kotc_session(current_setting('test.denny')::bigint, true)::text,
  true
);
select is(
  (public.get_court_sessions(current_setting('test.denny')::bigint) -> 0 ->> 'session_number')::int,
  1,
  'the first running session is Session 1'
);
select is(
  (public.get_court_sessions(current_setting('test.denny')::bigint) -> 0 ->> 'host_username'),
  'kota',
  'the host username stays on the session'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select set_config(
  'test.s2',
  public.start_kotc_session(current_setting('test.denny')::bigint, true)::text,
  true
);
select is(
  (select session_number from public.sessions where session_id = current_setting('test.s2')::bigint),
  2,
  'a second running session takes the next number'
);

select public.leave_kotc_session(current_setting('test.s2')::bigint);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select public.leave_kotc_session(current_setting('test.s1')::bigint);

select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
select set_config(
  'test.reuse',
  public.start_kotc_session(current_setting('test.denny')::bigint, true)::text,
  true
);
select is(
  (select session_number from public.sessions where session_id = current_setting('test.reuse')::bigint),
  1,
  'a new session reuses the lowest free number'
);
select public.leave_kotc_session(current_setting('test.reuse')::bigint);

reset role;
select throws_ok(
  $$ insert into public.sessions (court_id, session_number, host_id, ranked, king_id)
     values (current_setting('test.denny')::bigint, 1,
             'a1111111-1111-1111-1111-111111111111', true,
             'a1111111-1111-1111-1111-111111111111'),
            (current_setting('test.denny')::bigint, 1,
             'a2222222-2222-2222-2222-222222222222', true,
             'a2222222-2222-2222-2222-222222222222') $$,
  '23505', null,
  'two running sessions cannot share a number'
);

-- ---------------------------------------------------------
-- Join and leave
-- ---------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select set_config(
  'test.main',
  public.start_kotc_session(current_setting('test.denny')::bigint, true)::text,
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.main')::bigint);
select public.join_kotc_session(current_setting('test.main')::bigint);
select is(
  (select count(*) from public.session_players
    where session_id = current_setting('test.main')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'
      and state = 'waiting'),
  1::bigint,
  'joining twice leaves one waiting row'
);
select is(
  (public.get_court_sessions(current_setting('test.denny')::bigint) -> 0 -> 'queue' -> 0 ->> 'user_id'),
  'a2222222-2222-2222-2222-222222222222',
  'the first joiner is at the back of the line'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
select set_config(
  'test.other',
  public.start_kotc_session(current_setting('test.denny')::bigint, false)::text,
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.other')::bigint);
select is(
  (select left_reason from public.session_players
    where session_id = current_setting('test.main')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'),
  'switched',
  'joining another session leaves the first one'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a4444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.join_kotc_session(current_setting('test.main')::bigint) $$,
  '22023', 'Ranked play is paused.',
  'a ranked ban blocks joining a ranked session'
);
select public.join_kotc_session(current_setting('test.other')::bigint);
select is(
  (select state from public.session_players
    where session_id = current_setting('test.other')::bigint
      and user_id = 'a4444444-4444-4444-4444-444444444444'),
  'waiting',
  'a ranked ban still allows a casual session'
);
select public.leave_kotc_session(current_setting('test.other')::bigint);

select set_config(
  'request.jwt.claims',
  '{"sub":"a5555555-5555-5555-5555-555555555555","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.main')::bigint);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select public.leave_kotc_session(current_setting('test.main')::bigint);
select is(
  (select king_id from public.sessions where session_id = current_setting('test.main')::bigint),
  null,
  'the king leaving vacates the crown'
);

select throws_ok(
  $$ select public.leave_kotc_session(current_setting('test.main')::bigint) $$,
  '22023', 'Not in session.',
  'leaving a session you are not in is rejected'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a5555555-5555-5555-5555-555555555555","role":"authenticated"}',
  true
);
select public.leave_kotc_session(current_setting('test.main')::bigint);

-- Close both sessions so later sections start clean. Bob is still waiting.
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.leave_kotc_session(current_setting('test.other')::bigint);
select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
select public.leave_kotc_session(current_setting('test.other')::bigint);
select is(
  (select ended_at is not null from public.sessions where session_id = current_setting('test.other')::bigint),
  true,
  'the last player leaving ends the session'
);

-- ---------------------------------------------------------
-- I'm here
-- ---------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select set_config(
  'test.here',
  public.start_kotc_session(current_setting('test.denny')::bigint, true)::text,
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.here')::bigint);
select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.here')::bigint);

select isnt(
  (select here_deadline from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'),
  null,
  'the first waiting player gets a deadline while a spot is open'
);
select is(
  (select here_deadline from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a3333333-3333-3333-3333-333333333333'),
  null,
  'the second waiting player has no deadline while only one spot is open'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.confirm_kotc_here(current_setting('test.here')::bigint);
select is(
  (select state from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'),
  'on_court',
  'tapping I am here steps onto the court and clears the miss count'
);
select is(
  (select missed_here_count from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'),
  0,
  'showing up resets the miss count'
);
select is(
  (select here_deadline from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a3333333-3333-3333-3333-333333333333'),
  null,
  'nobody new is called while the king already has an opponent'
);

-- Vacant crown: both of the first two are called together.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select public.leave_kotc_session(current_setting('test.here')::bigint);
select isnt(
  (select here_deadline from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a3333333-3333-3333-3333-333333333333'),
  null,
  'with the crown vacant and one player on court, the next player is called'
);

-- Put Bob back in line, then drop the kingless game setup: both waiting, court empty.
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.leave_kotc_session(current_setting('test.here')::bigint);
select public.join_kotc_session(current_setting('test.here')::bigint);
select isnt(
  (select here_deadline from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'
      and state = 'waiting'),
  null,
  'both of the first two get a deadline when the crown is vacant and the court is empty'
);
select isnt(
  (select here_deadline from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a3333333-3333-3333-3333-333333333333'
      and state = 'waiting'),
  null,
  'the second player is called at the same time'
);

reset role;
update public.session_players
   set here_deadline = now() - interval '1 minute'
 where session_id = current_setting('test.here')::bigint
   and user_id = 'a2222222-2222-2222-2222-222222222222';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.confirm_kotc_here(current_setting('test.here')::bigint) $$,
  '22023', 'Not up next.',
  'confirming after the deadline does not count as showing up'
);
select is(
  (select missed_here_count from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'),
  0,
  'the late tap does not record the miss'
);

reset role;
select public.kotc_expire_here();
select is(
  (select missed_here_count from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'
      and state = 'waiting'),
  1,
  'the first miss sends the player to the back of the line'
);

update public.session_players
   set here_deadline = now() - interval '1 minute'
 where session_id = current_setting('test.here')::bigint
   and user_id = 'a2222222-2222-2222-2222-222222222222'
   and state = 'waiting';
select public.kotc_expire_here();
select is(
  (select left_reason from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'),
  'no_show',
  'a second miss in a row removes the player'
);

-- A show-up between misses resets the count. Fresh line: Cara is waiting.
-- Bob rejoins, misses once, then makes it on court.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.here')::bigint);
reset role;
update public.session_players
   set here_deadline = now() - interval '1 minute'
 where session_id = current_setting('test.here')::bigint
   and user_id = 'a2222222-2222-2222-2222-222222222222'
   and state = 'waiting';
select public.kotc_expire_here();
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.confirm_kotc_here(current_setting('test.here')::bigint);
select is(
  (select missed_here_count from public.session_players
    where session_id = current_setting('test.here')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'),
  0,
  'showing up after one miss resets the count'
);

-- ---------------------------------------------------------
-- Results
-- ---------------------------------------------------------
-- Bob is on court, Cara may still be waiting or on court. Leave Cara if needed
-- and report a kingless game once Alice is gone. This session has no king.
-- Start a ranked session with a king for the king-win case instead.
select public.leave_kotc_session(current_setting('test.here')::bigint);
select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
select public.leave_kotc_session(current_setting('test.here')::bigint);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select set_config(
  'test.ranked',
  public.start_kotc_session(current_setting('test.denny')::bigint, true)::text,
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.ranked')::bigint);
select public.confirm_kotc_here(current_setting('test.ranked')::bigint);
select set_config(
  'test.king_game',
  public.report_kotc_result(
    current_setting('test.ranked')::bigint,
    'a1111111-1111-1111-1111-111111111111'
  )::text,
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select public.confirm_result(current_setting('test.king_game')::bigint);
select is(
  (select king_streak from public.sessions where session_id = current_setting('test.ranked')::bigint),
  1,
  'when the king wins, the streak becomes 1'
);
select is(
  (select state from public.session_players
    where session_id = current_setting('test.ranked')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'),
  'waiting',
  'the loser goes to the back of the line'
);
select is(
  (select elo from public.profiles where user_id = 'a1111111-1111-1111-1111-111111111111'),
  816,
  'a ranked King of the Court win moves Elo'
);

-- Challenger wins the next game.
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.confirm_kotc_here(current_setting('test.ranked')::bigint);
select set_config(
  'test.chal_game',
  public.report_kotc_result(
    current_setting('test.ranked')::bigint,
    'a2222222-2222-2222-2222-222222222222'
  )::text,
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select public.confirm_result(current_setting('test.chal_game')::bigint);
select is(
  (select king_id from public.sessions where session_id = current_setting('test.ranked')::bigint),
  'a2222222-2222-2222-2222-222222222222'::uuid,
  'the challenger who wins becomes king'
);
select is(
  (select king_streak from public.sessions where session_id = current_setting('test.ranked')::bigint),
  1,
  'a new king starts at streak 1'
);

-- Casual: no Elo. Cara and Dev, both still 800.
select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
select set_config(
  'test.casual',
  public.start_kotc_session(current_setting('test.denny')::bigint, false)::text,
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a4444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
-- Dev is still ranked-banned; casual join is allowed. He may already be free.
select public.join_kotc_session(current_setting('test.casual')::bigint);
select public.confirm_kotc_here(current_setting('test.casual')::bigint);
select set_config(
  'test.casual_game',
  public.report_kotc_result(
    current_setting('test.casual')::bigint,
    'a3333333-3333-3333-3333-333333333333'
  )::text,
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
select public.confirm_result(current_setting('test.casual_game')::bigint);
select is(
  (select elo from public.profiles where user_id = 'a3333333-3333-3333-3333-333333333333'),
  800,
  'a casual King of the Court game does not move Elo'
);

-- 5-minute auto-confirm, and a young 1v1 stays pending.
select set_config(
  'request.jwt.claims',
  '{"sub":"a4444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
select public.confirm_kotc_here(current_setting('test.casual')::bigint);
select set_config(
  'test.auto_game',
  public.report_kotc_result(
    current_setting('test.casual')::bigint,
    'a4444444-4444-4444-4444-444444444444'
  )::text,
  true
);
reset role;
update public.games
   set created_at = now() - interval '5 minutes'
 where game_id = current_setting('test.auto_game')::bigint;

insert into public.games (
  game_id, court_id, ranked, status, winning_side, reported_by, created_at
)
overriding system value
values (
  9101,
  current_setting('test.denny')::bigint,
  true,
  'pending',
  1,
  'a5555555-5555-5555-5555-555555555555',
  now() - interval '10 minutes'
);
insert into public.game_players (game_id, user_id, side) values
  (9101, 'a5555555-5555-5555-5555-555555555555', 1),
  (9101, 'a6666666-6666-6666-6666-666666666666', 2);

select is(
  (select status from public.games where game_id = current_setting('test.auto_game')::bigint),
  'pending',
  'a King of the Court result is still pending before the sweep'
);
select ok(
  public.auto_confirm_results() > 0,
  'the sweep confirms the King of the Court game'
);
select is(
  (select status from public.games where game_id = current_setting('test.auto_game')::bigint),
  'confirmed',
  'a King of the Court result auto-confirms after 5 minutes'
);
select is(
  (select status from public.games where game_id = 9101),
  'pending',
  'a 1v1 result younger than 24 hours stays pending'
);

-- Dispute does not ban, and both players go to the back.
insert into public.games (
  game_id, court_id, ranked, status, winning_side, reported_by, created_at, disputed_at
)
overriding system value
select v.id, current_setting('test.denny')::bigint, true, 'voided', 1,
       'a1111111-1111-1111-1111-111111111111'::uuid,
       now() - interval '3 days', now() - interval '2 days'
  from generate_series(9102, 9105) v (id);
insert into public.game_players (game_id, user_id, side)
select v.id, 'a1111111-1111-1111-1111-111111111111', 1
  from generate_series(9102, 9105) v (id);
insert into public.game_players (game_id, user_id, side)
select v.id, 'a2222222-2222-2222-2222-222222222222', 2
  from generate_series(9102, 9105) v (id);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
-- Alice is waiting in the ranked session behind Bob, who is king.
select public.confirm_kotc_here(current_setting('test.ranked')::bigint);
select set_config(
  'test.dispute_game',
  public.report_kotc_result(
    current_setting('test.ranked')::bigint,
    'a1111111-1111-1111-1111-111111111111'
  )::text,
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.dispute_result(current_setting('test.dispute_game')::bigint);
select is(
  (select status from public.games where game_id = current_setting('test.dispute_game')::bigint),
  'voided',
  'a disputed King of the Court game is voided'
);
select is(
  (select king_id from public.sessions where session_id = current_setting('test.ranked')::bigint),
  null,
  'a dispute vacates the crown'
);
select is(
  (select ranked_banned_until from public.profiles
    where user_id = 'a1111111-1111-1111-1111-111111111111'),
  null,
  'a King of the Court dispute does not count toward the ranked ban'
);

-- Winner left before confirm: Elo applies, crown stays vacant, loser goes back.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.ranked')::bigint);
select public.confirm_kotc_here(current_setting('test.ranked')::bigint);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.ranked')::bigint);
select public.confirm_kotc_here(current_setting('test.ranked')::bigint);
select set_config(
  'test.left_game',
  public.report_kotc_result(
    current_setting('test.ranked')::bigint,
    'a2222222-2222-2222-2222-222222222222'
  )::text,
  true
);
reset role;
update public.profiles
   set elo = 800
 where user_id in (
   'a1111111-1111-1111-1111-111111111111',
   'a2222222-2222-2222-2222-222222222222'
 );
update public.check_ins
   set checked_out_at = now()
 where user_id = 'a2222222-2222-2222-2222-222222222222'
   and checked_out_at is null;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select public.confirm_result(current_setting('test.left_game')::bigint);
select is(
  (select elo from public.profiles where user_id = 'a2222222-2222-2222-2222-222222222222'),
  816,
  'Elo still applies when the winner has left'
);
select is(
  (select king_id from public.sessions where session_id = current_setting('test.ranked')::bigint),
  null,
  'the crown stays vacant when the winner has left'
);
select is(
  (select state from public.session_players
    where session_id = current_setting('test.ranked')::bigint
      and user_id = 'a1111111-1111-1111-1111-111111111111'),
  'waiting',
  'the loser goes to the back when the winner has left'
);

-- Check-out removes a player who is still in a session.
reset role;
insert into public.check_ins (user_id, court_id)
values (
  'a2222222-2222-2222-2222-222222222222',
  current_setting('test.denny')::bigint
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.ranked')::bigint);
reset role;
update public.check_ins
   set checked_out_at = now()
 where user_id = 'a2222222-2222-2222-2222-222222222222'
   and checked_out_at is null;
select is(
  (select left_reason from public.session_players
    where session_id = current_setting('test.ranked')::bigint
      and user_id = 'a2222222-2222-2222-2222-222222222222'
      and state = 'left'
    order by left_at desc nulls last
    limit 1),
  'checked_out',
  'checking out removes the player from the session'
);

-- ---------------------------------------------------------
-- Visibility and counts
-- ---------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a7777777-7777-7777-7777-777777777777","role":"authenticated"}',
  true
);
select is(
  public.get_court_sessions(current_setting('test.denny')::bigint),
  '[]'::jsonb,
  'a player who is not checked in sees no sessions'
);

reset role;
insert into public.blocks (blocker_id, blocked_id)
values (
  'a1111111-1111-1111-1111-111111111111',
  'a3333333-3333-3333-3333-333333333333'
);
insert into public.check_ins (user_id, court_id)
values (
  'a2222222-2222-2222-2222-222222222222',
  current_setting('test.denny')::bigint
);
-- Cara is still in some session or not. Put both Alice and Cara in a new one.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select public.leave_kotc_session(current_setting('test.ranked')::bigint);
select set_config(
  'test.block',
  public.start_kotc_session(current_setting('test.denny')::bigint, false)::text,
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
select public.join_kotc_session(current_setting('test.block')::bigint);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select ok(
  public.get_court_sessions(current_setting('test.denny')::bigint)::text
    like '%a3333333-3333-3333-3333-333333333333%',
  'a block does not hide a player from the King of the Court line'
);

reset role;
insert into public.challenges (
  challenger_id, opponent_id, court_id, ranked, starts_at, duration_minutes, status
)
values (
  'a1111111-1111-1111-1111-111111111111',
  'a5555555-5555-5555-5555-555555555555',
  current_setting('test.denny')::bigint,
  false,
  now() - interval '5 minutes',
  60,
  'confirmed'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select ok(
  not exists (
    select 1 from public.get_court_players(current_setting('test.denny')::bigint)
     where user_id = 'a3333333-3333-3333-3333-333333333333'
  ),
  'the whos-here list still hides a blocked player'
);
select ok(
  exists (
    select 1 from public.get_court_players(current_setting('test.denny')::bigint)
     where user_id = 'a5555555-5555-5555-5555-555555555555'
       and real_name = 'Erin Kot'
  ),
  'a confirmed 1v1 opponent is visible, with their real name'
);
select ok(
  not exists (
    select 1 from public.get_court_players(current_setting('test.denny')::bigint)
     where user_id = 'a6666666-6666-6666-6666-666666666666'
  ),
  'a checked-in player outside King of the Court and outside the match is only a count'
);

select is(
  (select session_live from public.nearby_courts(47.660225, -122.306971, 500)
    where name = 'Denny Courts'),
  true,
  'nearby courts report a live King of the Court session'
);
select ok(
  (select kotc_waiting from public.get_court(current_setting('test.denny')::bigint)) >= 1,
  'court details include how many players are waiting'
);

select ok(
  exists (
    select 1
      from pg_policies
     where schemaname = 'realtime'
       and tablename = 'messages'
       and policyname = 'Checked-in players read KOTC updates'
  ),
  'checked-in players can read King of the Court broadcasts'
);

select * from finish();
rollback;
