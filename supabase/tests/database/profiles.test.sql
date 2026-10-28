-- pgTAP tests for public.profiles: the sign-up trigger, username rules,
-- RLS, and the column grants that keep users from writing their own elo.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Two test users. Inserting into auth.users fires on_auth_user_created.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local');

-- ---------------------------------------------------------
-- Sign-up trigger
-- ---------------------------------------------------------
select is(
  (select count(*)::int from public.profiles
    where user_id in ('11111111-1111-1111-1111-111111111111',
                      '22222222-2222-2222-2222-222222222222')),
  2,
  'trigger creates one profile per new auth user'
);

select results_eq(
  $$ select username, elo, open_to_challenges from public.profiles
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values (null::text, 1200, true) $$,
  'new profile starts with no username, elo 1200, open to challenges'
);

-- ---------------------------------------------------------
-- Username rules (CHECK + case-insensitive unique index)
-- ---------------------------------------------------------
select throws_ok(
  $$ update public.profiles set username = 'ab'
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'username shorter than 3 characters is rejected'
);

select throws_ok(
  $$ update public.profiles set username = 'bad name!'
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'username with spaces or symbols is rejected'
);

select throws_ok(
  $$ update public.profiles set username = 'abcdefghijklmnopq'
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'username longer than 16 characters is rejected'
);

select lives_ok(
  $$ update public.profiles set username = 'Alice_403'
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'valid username is accepted'
);

select throws_ok(
  $$ update public.profiles set username = 'ALICE_403'
      where user_id = '22222222-2222-2222-2222-222222222222' $$,
  '23505', null,
  'usernames are unique ignoring case'
);

-- ---------------------------------------------------------
-- Signed-out visitor (anon)
-- ---------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select is_empty(
  $$ select * from public.profiles $$,
  'anon cannot read any profiles'
);

-- ---------------------------------------------------------
-- Signed in as Alice (authenticated)
-- ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.profiles
    where user_id in ('11111111-1111-1111-1111-111111111111',
                      '22222222-2222-2222-2222-222222222222')),
  2,
  'signed-in user can read other profiles'
);

select lives_ok(
  $$ update public.profiles set open_to_challenges = false
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'user can update their own open_to_challenges'
);

select throws_ok(
  $$ update public.profiles set elo = 3000
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'user cannot write their own elo (column grant)'
);

select throws_ok(
  $$ insert into public.profiles (user_id)
      values ('33333333-3333-3333-3333-333333333333') $$,
  '42501', null,
  'user cannot insert profiles directly'
);

-- RLS hides Bob's row from Alice's update, so it changes nothing instead of erroring.
update public.profiles set username = 'hacked'
  where user_id = '22222222-2222-2222-2222-222222222222';

select is(
  (select username from public.profiles
    where user_id = '22222222-2222-2222-2222-222222222222'),
  null,
  'user cannot update someone else''s profile (RLS)'
);

-- ---------------------------------------------------------
-- Cascade delete
-- ---------------------------------------------------------
reset role;
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';

select is_empty(
  $$ select * from public.profiles
      where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'deleting the auth user deletes their profile'
);

select * from finish();
rollback;
