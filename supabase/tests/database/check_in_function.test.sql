-- pgTAP tests for check_in and check_out: the 150 m rule, closed courts,
-- closing an expired open row, and check-out. Rows the functions do not write
-- are set up as postgres. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local');

-- Azimuth 0 is north. 200 m is past the 150 m check-in radius.
-- Saved before set role, because the signed-in role does not need PostGIS.
select set_config('test.far_lat', (
  select extensions.st_y(extensions.st_project(location, 200, 0)::extensions.geometry)::text
    from public.courts where name = 'Denny Courts'), false);
select set_config('test.far_lng', (
  select extensions.st_x(extensions.st_project(location, 200, 0)::extensions.geometry)::text
    from public.courts where name = 'Denny Courts'), false);
select set_config('test.denny_lat', (
  select extensions.st_y(location::extensions.geometry)::text
    from public.courts where name = 'Denny Courts'), false);
select set_config('test.denny_lng', (
  select extensions.st_x(location::extensions.geometry)::text
    from public.courts where name = 'Denny Courts'), false);
select set_config('test.ravenna_lat', (
  select extensions.st_y(location::extensions.geometry)::text
    from public.courts where name = 'Ravenna Park'), false);
select set_config('test.ravenna_lng', (
  select extensions.st_x(location::extensions.geometry)::text
    from public.courts where name = 'Ravenna Park'), false);

select ok(
  (select extensions.st_distance(
            c.location,
            extensions.st_point(current_setting('test.far_lng')::double precision,
                                current_setting('test.far_lat')::double precision)::extensions.geography)
            between 190 and 210
     from public.courts c
    where c.name = 'Denny Courts'),
  'the rejection point is about 200 m north of Denny'
);

update public.courts set status = 'closed' where name = 'Ravenna Park';

-- Bob's visit expired an hour ago and was never checked out.
insert into public.check_ins (user_id, court_id, checked_in_at, expires_at) values
  ('22222222-2222-2222-2222-222222222222',
   (select court_id from public.courts where name = 'Denny Courts'),
   now() - interval '4 hours', now() - interval '1 hour');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.check_in(
       (select court_id from public.courts where name = 'Denny Courts'),
       current_setting('test.far_lat')::double precision,
       current_setting('test.far_lng')::double precision) $$,
  '22023',
  'Too far from the court.',
  'a check-in about 200 m from the court is rejected'
);

select throws_ok(
  $$ select public.check_in(
       (select court_id from public.courts where name = 'Ravenna Park'),
       current_setting('test.ravenna_lat')::double precision,
       current_setting('test.ravenna_lng')::double precision) $$,
  '22023',
  'Court is not available.',
  'a closed court rejects a check-in at its own coordinates'
);

select is(
  (select expires_at - checked_in_at from public.check_in(
     (select court_id from public.courts where name = 'Denny Courts'),
     current_setting('test.denny_lat')::double precision,
     current_setting('test.denny_lng')::double precision)),
  interval '3 hours',
  'a check-in at the court expires 3 hours later'
);

select ok(
  (select checked_out_at is not null from public.check_out()),
  'check_out sets checked_out_at'
);

select throws_ok(
  $$ select public.check_out() $$,
  '22023',
  'Not checked in.',
  'a second check_out fails'
);

select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is(
  (select expires_at - checked_in_at from public.check_in(
     (select court_id from public.courts where name = 'Denny Courts'),
     current_setting('test.denny_lat')::double precision,
     current_setting('test.denny_lng')::double precision)),
  interval '3 hours',
  'check_in succeeds after closing an expired open row'
);

select is(
  (select checked_out_at = expires_at from public.check_ins
    where user_id = '22222222-2222-2222-2222-222222222222'
      and checked_in_at < now() - interval '1 hour'),
  true,
  'the expired check-in is closed at expires_at'
);

select * from finish();
rollback;
