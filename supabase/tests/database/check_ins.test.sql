-- pgTAP tests for public.check_ins: one open check-in per user, foreign keys and
-- checks, no client writes, RLS (only players checked in at a court see who is
-- there), and Realtime. Rows are set up as postgres, since check_in is Jace's.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- Alice and Bob at Denny, Cara at Ravenna, Dev nowhere, Erin's Denny check-in has
-- expired, Finn for the check-out case.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'cara@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'dev@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'erin@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'finn@test.local');

insert into public.check_ins (user_id, court_id) values
  ('11111111-1111-1111-1111-111111111111', (select court_id from public.courts where name = 'Denny Courts')),
  ('22222222-2222-2222-2222-222222222222', (select court_id from public.courts where name = 'Denny Courts')),
  ('33333333-3333-3333-3333-333333333333', (select court_id from public.courts where name = 'Ravenna Park'));

-- Alice's visit yesterday (checked out), and Erin's, which expired an hour ago
-- without a check-out.
insert into public.check_ins (user_id, court_id, checked_in_at, expires_at, checked_out_at) values
  ('11111111-1111-1111-1111-111111111111', (select court_id from public.courts where name = 'Denny Courts'),
   now() - interval '1 day', now() - interval '21 hours', now() - interval '23 hours'),
  ('55555555-5555-5555-5555-555555555555', (select court_id from public.courts where name = 'Denny Courts'),
   now() - interval '4 hours', now() - interval '1 hour', null);

-- ---------------------------------------------------------
-- Schema and Realtime
-- ---------------------------------------------------------
select has_index('public', 'check_ins', 'check_ins_open_court_idx',
  'check_ins has a partial index on court_id for live counts');

select has_index('public', 'check_ins', 'check_ins_one_open_per_user',
  'check_ins has a unique partial index on user_id');

select ok(
  exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'check_ins'
  ),
  'check_ins is in the supabase_realtime publication'
);

select is(
  (select expires_at - checked_in_at from public.check_ins
    where user_id = '22222222-2222-2222-2222-222222222222'),
  interval '3 hours',
  'expires_at defaults to 3 hours after check-in'
);

-- ---------------------------------------------------------
-- One open check-in per user
-- ---------------------------------------------------------
select throws_ok(
  $$ insert into public.check_ins (user_id, court_id)
      values ('22222222-2222-2222-2222-222222222222',
              (select court_id from public.courts where name = 'Ravenna Park')) $$,
  '23505', null,
  'a user cannot have two open check-ins'
);

-- The unique index ignores expiry, so check_in must close the old row first.
select throws_ok(
  $$ insert into public.check_ins (user_id, court_id)
      values ('55555555-5555-5555-5555-555555555555',
              (select court_id from public.courts where name = 'Ravenna Park')) $$,
  '23505', null,
  'an expired check-in that was never checked out still blocks the next one'
);

insert into public.check_ins (user_id, court_id)
  values ('66666666-6666-6666-6666-666666666666',
          (select court_id from public.courts where name = 'Laurelhurst Half Court'));
update public.check_ins set checked_out_at = now()
  where user_id = '66666666-6666-6666-6666-666666666666';

select lives_ok(
  $$ insert into public.check_ins (user_id, court_id)
      values ('66666666-6666-6666-6666-666666666666',
              (select court_id from public.courts where name = 'Laurelhurst Half Court')) $$,
  'after checking out, the user can check in again'
);

-- ---------------------------------------------------------
-- Foreign keys and checks
-- ---------------------------------------------------------
select throws_ok(
  $$ insert into public.check_ins (user_id, court_id)
      values ('44444444-4444-4444-4444-444444444444', -1) $$,
  '23503', null,
  'check-in must be at a real court'
);

select throws_ok(
  $$ delete from public.courts where name = 'Denny Courts' $$,
  '23503', null,
  'a court with check-ins cannot be deleted (on delete restrict)'
);

select throws_ok(
  $$ insert into public.check_ins (user_id, court_id, expires_at)
      values ('44444444-4444-4444-4444-444444444444',
              (select court_id from public.courts where name = 'Ravenna Park'),
              now() - interval '1 hour') $$,
  '23514', null,
  'expires_at must be after checked_in_at'
);

select throws_ok(
  $$ insert into public.check_ins (user_id, court_id, checked_out_at)
      values ('44444444-4444-4444-4444-444444444444',
              (select court_id from public.courts where name = 'Ravenna Park'),
              now() - interval '1 hour') $$,
  '23514', null,
  'checked_out_at cannot be before checked_in_at'
);

-- ---------------------------------------------------------
-- No client writes (as Alice)
-- ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ insert into public.check_ins (user_id, court_id)
      values ('11111111-1111-1111-1111-111111111111',
              (select court_id from public.courts where name = 'Ravenna Park')) $$,
  '42501', null,
  'user cannot insert check-ins directly'
);

select throws_ok(
  $$ update public.check_ins set checked_out_at = now()
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'user cannot update check-ins directly'
);

select throws_ok(
  $$ delete from public.check_ins
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'user cannot delete check-ins'
);

-- ---------------------------------------------------------
-- RLS: who sees which check-ins
-- ---------------------------------------------------------
select bag_eq(
  $$ select user_id, checked_out_at is null from public.check_ins
      where court_id = (select court_id from public.courts where name = 'Denny Courts') $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, true),
            ('11111111-1111-1111-1111-111111111111'::uuid, false),
            ('22222222-2222-2222-2222-222222222222'::uuid, true) $$,
  'checked in at Denny: sees own check-ins and the other active ones there, not expired ones'
);

select is_empty(
  $$ select * from public.check_ins
      where court_id = (select court_id from public.courts where name = 'Ravenna Park') $$,
  'checked in at Denny: sees no one at Ravenna'
);

select set_config('request.jwt.claims',
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select is_empty(
  $$ select * from public.check_ins
      where court_id = (select court_id from public.courts where name = 'Denny Courts') $$,
  'checked in at Ravenna: sees no one at Denny'
);

select set_config('request.jwt.claims',
  '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);

select is_empty(
  $$ select * from public.check_ins $$,
  'not checked in anywhere: sees no check-ins'
);

select set_config('request.jwt.claims',
  '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}', true);

select results_eq(
  $$ select user_id from public.check_ins $$,
  $$ values ('55555555-5555-5555-5555-555555555555'::uuid) $$,
  'an expired check-in gives no visibility: sees only own row'
);

set local role anon;
select set_config('request.jwt.claims', '', true);

select is_empty(
  $$ select * from public.check_ins $$,
  'anon cannot read any check-ins'
);

-- ---------------------------------------------------------
-- Cascade delete
-- ---------------------------------------------------------
reset role;
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';

select is_empty(
  $$ select * from public.check_ins
      where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'deleting the auth user deletes their check-ins'
);

select * from finish();
rollback;
