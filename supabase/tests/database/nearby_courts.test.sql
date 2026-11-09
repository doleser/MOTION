-- pgTAP tests for nearby_courts: radius search from the seeded courts, closest first,
-- each court's latitude and longitude, active-only player counts and average elo,
-- the 50 km cap, and anon and signed-in access.
-- Seed distances from the IMA: Denny Courts ~854 m, Laurelhurst ~1564 m, Ravenna ~2268 m.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- Alice and Bob are active at Denny. Cara checked out and Dev's check-in expired,
-- so neither counts.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'cara@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'dev@test.local');

update public.profiles set elo = 400  where user_id = '11111111-1111-1111-1111-111111111111';
update public.profiles set elo = 800  where user_id = '22222222-2222-2222-2222-222222222222';
update public.profiles set elo = 1500 where user_id = '33333333-3333-3333-3333-333333333333';
update public.profiles set elo = 2000 where user_id = '44444444-4444-4444-4444-444444444444';

insert into public.check_ins (user_id, court_id) values
  ('11111111-1111-1111-1111-111111111111', (select court_id from public.courts where name = 'Denny Courts')),
  ('22222222-2222-2222-2222-222222222222', (select court_id from public.courts where name = 'Denny Courts'));

insert into public.check_ins (user_id, court_id, checked_in_at, expires_at, checked_out_at) values
  ('33333333-3333-3333-3333-333333333333', (select court_id from public.courts where name = 'Denny Courts'),
   now() - interval '1 hour', now() + interval '2 hours', now() - interval '30 minutes'),
  ('44444444-4444-4444-4444-444444444444', (select court_id from public.courts where name = 'Denny Courts'),
   now() - interval '4 hours', now() - interval '1 hour', null);

-- ---------------------------------------------------------
-- Radius search
-- ---------------------------------------------------------
select results_eq(
  $$ select name from public.nearby_courts(47.653522, -122.301431, 1500) $$,
  $$ values ('UW IMA'::text), ('Denny Courts'::text) $$,
  'from the IMA at 1.5 km: the IMA, then Denny Courts'
);

select results_eq(
  $$ select name from public.nearby_courts(47.653522, -122.301431, 500) $$,
  $$ values ('UW IMA'::text) $$,
  'a smaller radius leaves farther courts out'
);

-- Swapping lat and lng would put the point nowhere near Seattle.
select ok(
  (select distance_m from public.nearby_courts(47.653522, -122.301431, 1500)
    where name = 'Denny Courts') between 840 and 870,
  'distance_m is in meters (Denny Courts is ~854 m from the IMA)'
);

-- Olympia is ~85 km from every seeded court.
select is_empty(
  $$ select * from public.nearby_courts(47.0379, -122.9007, 200000) $$,
  'radius is capped at 50 km'
);

-- ---------------------------------------------------------
-- Location (for the map pins)
-- ---------------------------------------------------------
-- The seed stores Denny Courts as POINT(-122.306971 47.660225), longitude first.
select results_eq(
  $$ select latitude, longitude from public.nearby_courts(47.653522, -122.301431, 1500)
      where name = 'Denny Courts' $$,
  $$ values (47.660225::double precision, -122.306971::double precision) $$,
  'latitude and longitude match the seed and are not swapped'
);

-- Each row's point must be its own court's, not the searched point or another court's.
select is(
  (select count(*)::integer
     from public.nearby_courts(47.653522, -122.301431, 5000) n
     join public.courts c on c.court_id = n.court_id
    where n.latitude  is distinct from extensions.st_y(c.location::extensions.geometry)
       or n.longitude is distinct from extensions.st_x(c.location::extensions.geometry)),
  0,
  'every court in range comes back with its own point'
);

-- ---------------------------------------------------------
-- Player count and average elo
-- ---------------------------------------------------------
select is(
  (select player_count from public.nearby_courts(47.653522, -122.301431, 1500)
    where name = 'Denny Courts'),
  2,
  'player_count counts active check-ins only (not checked-out or expired ones)'
);

select is(
  (select player_count from public.nearby_courts(47.653522, -122.301431, 1500)
    where name = 'UW IMA'),
  0,
  'a court with nobody checked in has player_count 0'
);

select is(
  (select avg_elo from public.nearby_courts(47.653522, -122.301431, 1500)
    where name = 'Denny Courts'),
  600,
  'avg_elo averages active players only'
);

select is(
  (select avg_elo from public.nearby_courts(47.653522, -122.301431, 1500)
    where name = 'UW IMA'),
  null,
  'avg_elo is null when nobody is checked in'
);

-- ---------------------------------------------------------
-- Signed-in player who isn't checked in
-- ---------------------------------------------------------
-- The location migration dropped and re-created the function, which also dropped its
-- grants, so check both roles that should be able to call it.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select is(
  (select player_count from public.nearby_courts(47.653522, -122.301431, 1500)
    where name = 'Denny Courts'),
  2,
  'a signed-in player can call nearby_courts and sees player counts'
);

reset role;

-- ---------------------------------------------------------
-- Signed-out visitor (anon)
-- ---------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

-- RLS hides every check-in from anon, so this also shows the definer rights work.
select is(
  (select player_count from public.nearby_courts(47.653522, -122.301431, 1500)
    where name = 'Denny Courts'),
  2,
  'anon can call nearby_courts and sees player counts (the map is public)'
);

select * from finish();
rollback;
