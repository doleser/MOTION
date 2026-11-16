-- pgTAP tests for search_players: handle prefixes, exclusions, and grants.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'caller@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'johanna@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'jobell@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'johnny@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'johnp@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'noah@test.local'),
  ('77777777-7777-7777-7777-777777777777', 'zzkim@test.local'),
  ('88888888-8888-8888-8888-888888888888', 'bigjohn@test.local'),
  ('99999999-9999-9999-9999-999999999999', 'joey@test.local'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'maya@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'sam@test.local');

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
       'p' || lpad(i::text, 2, '0') || '@test.local'
  from generate_series(1, 21) as i;

update public.profiles as p
   set username = v.username,
       real_name = v.real_name,
       elo = v.elo,
       onboarded_at = case when v.finished then now() else null end
  from (values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'jcaller', 'Jace Allan', 900, true),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'johanna', 'Johanna Lee', 1462, true),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'jo_bell', 'Jordan Bell', 1175, true),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'johnny_n', 'Johnny Nguyen', 1420, true),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'JohnP', 'John Park', 1210, true),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'noahk', 'Noah Kim', 1506, true),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'zzkim', 'Noah Kim', 1100, true),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'bigjohn', 'Big John', 1300, true),
    ('99999999-9999-9999-9999-999999999999'::uuid, 'joey_u', 'Joey Unfinished', 1200, false),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'mayac', 'Maya Chen', 1350, true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'samr', 'Sam Rivera', 1284, true)
  ) as v(user_id, username, real_name, elo, finished)
 where p.user_id = v.user_id;

update public.profiles as p
   set username = split_part(u.email, '@', 1),
       real_name = 'Player ' || split_part(u.email, '@', 1),
       elo = 800,
       onboarded_at = now()
  from auth.users as u
 where p.user_id = u.id
   and u.email like 'p%@test.local';

-- The caller blocked Maya. Sam blocked the caller. Either direction hides both.
insert into public.blocks (blocker_id, blocked_id) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- bigjohn is in the fixture and does not start with j, so it is not here.
select results_eq(
  $$ select user_id, real_name, username, elo from public.search_players('j') $$,
  $$ values
       ('33333333-3333-3333-3333-333333333333'::uuid, 'Jordan Bell'::text, 'jo_bell'::text, 1175),
       ('22222222-2222-2222-2222-222222222222'::uuid, 'Johanna Lee'::text, 'johanna'::text, 1462),
       ('44444444-4444-4444-4444-444444444444'::uuid, 'Johnny Nguyen'::text, 'johnny_n'::text, 1420),
       ('55555555-5555-5555-5555-555555555555'::uuid, 'John Park'::text, 'JohnP'::text, 1210) $$,
  'a one-letter prefix returns finished, unblocked handles in username order'
);

select results_eq(
  $$ select username from public.search_players('  JoH  ') $$,
  $$ values ('johanna'::text), ('johnny_n'), ('JohnP') $$,
  'search trims, ignores case, and matches a handle prefix'
);

select results_eq(
  $$ select username from public.search_players('noah') $$,
  $$ values ('noahk'::text) $$,
  'a real name is not searched when the username does not start with the query'
);

select is_empty(
  $$ select * from public.search_players('hk') $$,
  'a suffix of a username does not match'
);

select is_empty(
  $$ select * from public.search_players('gjohn') $$,
  'a match in the middle of a username does not match'
);

select results_eq(
  $$ select username from public.search_players('jo_') $$,
  $$ values ('jo_bell'::text) $$,
  'an underscore in the query is a literal character'
);

select is_empty(
  $$ select * from public.search_players('maya') $$,
  'a player the caller blocked is hidden'
);

select is_empty(
  $$ select * from public.search_players('sam') $$,
  'a player who blocked the caller is hidden'
);

select is_empty(
  $$ select * from public.search_players(null) $$,
  'null returns no rows'
);

select is_empty(
  $$ select * from public.search_players('') $$,
  'an empty query returns no rows'
);

select is_empty(
  $$ select * from public.search_players('   ') $$,
  'a blank query returns no rows'
);

select is_empty(
  $$ select * from public.search_players('@noahk') $$,
  'a leading @ returns no rows'
);

select is_empty(
  $$ select * from public.search_players('noah k') $$,
  'a space in the query returns no rows'
);

select is_empty(
  $$ select * from public.search_players('%') $$,
  'a percent sign returns no rows'
);

select is_empty(
  $$ select * from public.search_players(repeat('a', 17)) $$,
  'a query longer than 16 characters returns no rows'
);

select is(
  (select count(*)::int from public.search_players('p')),
  20,
  'search returns at most 20 rows'
);

select is_empty(
  $$ select * from public.search_players('p') where username = 'p21' $$,
  'the 21st match in username order is left out'
);

select is(
  (select username from public.search_players('p') limit 1),
  'p01',
  'the capped rows are the first usernames in order'
);

select set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select is_empty(
  $$ select * from public.search_players('jcaller') $$,
  'the blocked player also cannot find the caller'
);

select set_config('request.jwt.claims',
  '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}', true);

select is_empty(
  $$ select * from public.search_players('jcaller') $$,
  'the player who blocked the caller cannot find the caller'
);

select set_config('request.jwt.claims',
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);

select results_eq(
  $$ select username from public.search_players('jcaller') $$,
  $$ values ('jcaller'::text) $$,
  'another player can find the caller when nobody blocked them'
);

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.search_players('j') $$,
  '42501',
  'Not signed in.',
  'a request with no user id is rejected'
);

set local role anon;
select set_config('request.jwt.claims', '', true);

select throws_ok(
  $$ select * from public.search_players('j') $$,
  '42501',
  'permission denied for function search_players',
  'anon cannot call search_players'
);

select * from finish();
rollback;
