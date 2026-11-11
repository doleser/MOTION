-- pgTAP tests for sign-up: complete_profile (starting elo, real name, works only once),
-- is_username_available, and the column grants on the new profile columns.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- One user per level, plus Erin for the failure cases.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'cara@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'dev@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'erin@test.local');

set local role authenticated;

-- ---------------------------------------------------------
-- Starting elo for each level
-- ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- The name has extra spaces on purpose: complete_profile trims them.
select is(
  (public.complete_profile(
     p_username      => 'Alice_403',
     p_level         => 'beginner',
     p_position      => 'Guard',
     p_height_cm     => 183,
     p_tags          => array['shooter', 'defender'],
     p_home_court_id => (select court_id from public.courts where source_ref = 'uw-ima'),
     p_real_name     => '  Alice Lee  '
  )).elo,
  400,
  'beginner starts at 400'
);

select results_eq(
  $$ select username, real_name, position, height_cm, tags, home_court_id, onboarded_at is not null
       from public.profiles where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ select 'Alice_403'::text, 'Alice Lee'::text, 'Guard'::text, 183, array['shooter', 'defender'],
            court_id, true
       from public.courts where source_ref = 'uw-ima' $$,
  'complete_profile saves the handle, the trimmed real name, the details, and onboarded_at'
);

select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is(
  (public.complete_profile(
     p_username  => 'Bob_403',
     p_level     => 'intermediate',
     p_real_name => 'D''Angelo Nguyễn-Ruiz'
  )).elo,
  800,
  'intermediate starts at 800'
);

select is(
  (select real_name from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'),
  'D''Angelo Nguyễn-Ruiz',
  'a real name with an apostrophe, a hyphen, and accents is saved as typed'
);

select set_config('request.jwt.claims',
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select is(
  (public.complete_profile(
     p_username => 'Cara_403', p_level => 'advanced', p_real_name => 'Cara Smith'
  )).elo,
  1200,
  'advanced starts at 1200'
);

select set_config('request.jwt.claims',
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);

select is(
  (public.complete_profile(
     p_username => 'Dev_403', p_level => 'skipped', p_real_name => 'Dev Patel'
  )).elo,
  800,
  'skipping the self-assessment starts at 800'
);

select results_eq(
  $$ select position, height_cm, tags, home_court_id from public.profiles
      where user_id = '44444444-4444-4444-4444-444444444444' $$,
  $$ values (null::text, null::integer, null::text[], null::bigint) $$,
  'skipped details are saved as null'
);

-- ---------------------------------------------------------
-- Works only once
-- ---------------------------------------------------------
-- These calls include a real name, so they reach the once-only check
-- (55000) instead of failing earlier on a missing name (22023).
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.complete_profile(
       p_username => 'Alice_403', p_level => 'advanced', p_real_name => 'Alice Lee') $$,
  '55000', null,
  'a second call fails'
);

-- Users can clear their own username; that must not reopen sign-up.
update public.profiles set username = null
  where user_id = '11111111-1111-1111-1111-111111111111';

select throws_ok(
  $$ select public.complete_profile(
       p_username => 'Alice_Again', p_level => 'advanced', p_real_name => 'Alice Lee') $$,
  '55000', null,
  'clearing the username does not allow a second call'
);

select is(
  (select elo from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  400,
  'elo is unchanged after the failed second calls'
);

-- ---------------------------------------------------------
-- Column grants
-- ---------------------------------------------------------
select throws_ok(
  $$ update public.profiles set elo = 3000
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'user still cannot write their own elo (column grant)'
);

select throws_ok(
  $$ update public.profiles set onboarded_at = null
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'user cannot write onboarded_at (column grant)'
);

select lives_ok(
  $$ update public.profiles
        set position = 'Forward', height_cm = 190, tags = array['rebounder'], home_court_id = null
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'user can edit their position, height, tags, and home court'
);

select throws_ok(
  $$ update public.profiles set home_court_id = -1
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23503', null,
  'home court must be a real court'
);

-- NULL is the only "not filled in" value.
select throws_ok(
  $$ update public.profiles set position = '  '
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'position cannot be blank'
);

select throws_ok(
  $$ update public.profiles set tags = '{}'
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'tags cannot be an empty list'
);

-- Real name: editable, but never blank, padded, or removed once sign-up is done.
select lives_ok(
  $$ update public.profiles set real_name = 'Alice L.'
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'user can edit their real name'
);

select throws_ok(
  $$ update public.profiles set real_name = ''
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'real name cannot be blank'
);

select throws_ok(
  $$ update public.profiles set real_name = ' Alice '
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'real name cannot start or end with spaces (the app trims before saving)'
);

select throws_ok(
  $$ update public.profiles set real_name = null
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a finished profile cannot remove its real name'
);

-- ---------------------------------------------------------
-- Bad input (as Erin, who hasn't finished sign-up)
-- ---------------------------------------------------------
-- Every call below gives a valid real name unless the name is what's being
-- tested, so each test fails for the reason in its description.
select set_config('request.jwt.claims',
  '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.complete_profile(
       p_username => 'BOB_403', p_level => 'beginner', p_real_name => 'Erin Diaz') $$,
  '23505', null,
  'complete_profile rejects a taken username, ignoring case'
);

select throws_ok(
  $$ select public.complete_profile(
       p_username => 'Erin_403', p_level => 'pro', p_real_name => 'Erin Diaz') $$,
  '22023', 'Unknown level: pro',
  'complete_profile rejects an unknown level'
);

select throws_ok(
  $$ select public.complete_profile(
       p_username => null, p_level => 'beginner', p_real_name => 'Erin Diaz') $$,
  '22023', 'Username is required.',
  'complete_profile requires a username'
);

select throws_ok(
  $$ select public.complete_profile(p_username => 'Erin_403', p_level => 'beginner') $$,
  '22023', 'Real name is required.',
  'complete_profile requires a real name'
);

select throws_ok(
  $$ select public.complete_profile(
       p_username => 'Erin_403', p_level => 'beginner', p_real_name => '   ') $$,
  '22023', 'Real name is required.',
  'a real name of only spaces counts as missing'
);

select throws_ok(
  $$ select public.complete_profile(
       p_username => 'Erin_403', p_level => 'beginner', p_real_name => repeat('a', 51)) $$,
  '23514', null,
  'a real name longer than 50 characters is rejected'
);

select results_eq(
  $$ select username, real_name, elo, onboarded_at from public.profiles
      where user_id = '55555555-5555-5555-5555-555555555555' $$,
  $$ values (null::text, null::text, 800, null::timestamptz) $$,
  'failed calls leave the profile unchanged'
);

-- A 50-character name is the longest allowed. Run last for Erin: it finishes her sign-up.
select lives_ok(
  $$ select public.complete_profile(
       p_username => 'Erin_403', p_level => 'beginner', p_real_name => repeat('a', 50)) $$,
  'a 50-character real name is accepted'
);

-- ---------------------------------------------------------
-- Signed-out visitor (anon)
-- ---------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select is(
  public.is_username_available('Fresh_Name'),
  true,
  'signed-out user can check a free username'
);

select is(
  public.is_username_available('bob_403'),
  false,
  'username check ignores case'
);

select throws_ok(
  $$ select public.complete_profile(
       p_username => 'Anon_403', p_level => 'beginner', p_real_name => 'Anon User') $$,
  '42501', null,
  'signed-out user cannot call complete_profile'
);

select * from finish();
rollback;