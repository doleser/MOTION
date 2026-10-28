-- pgTAP tests for public.courts: the seed, feature constraints, the
-- nearby-courts index, and RLS (public read, no client writes).
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- ---------------------------------------------------------
-- Seed and schema
-- ---------------------------------------------------------
select ok(
  (select count(*) from public.courts) > 0,
  'seed loads at least one court'
);

select results_eq(
  $$ select source, manually_edited from public.courts where source_ref = 'uw-ima' $$,
  $$ values ('manual'::text, true) $$,
  'UW IMA is seeded as a manually edited court'
);

select has_index('public', 'courts', 'courts_location_gist', 'courts.location has a GiST index');

-- Same query shape nearby_courts will use: Denny Courts is ~1 km from the IMA.
select ok(
  exists (
    select 1 from public.courts
     where name = 'Denny Courts'
       and extensions.st_dwithin(
             location,
             'SRID=4326;POINT(-122.301431 47.653522)'::extensions.geography,
             1500)
  ),
  'radius search finds a court within 1.5 km of the IMA'
);

-- ---------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------
select throws_ok(
  $$ insert into public.courts (name, location, hoop_count, source, source_ref)
      values ('Bad', 'SRID=4326;POINT(-122.3 47.65)', 0, 'manual', 'test-hoops') $$,
  '23514', null,
  'hoop_count must be positive'
);

select throws_ok(
  $$ insert into public.courts (name, location, surface, source, source_ref)
      values ('Bad', 'SRID=4326;POINT(-122.3 47.65)', 'grass', 'manual', 'test-surface') $$,
  '23514', null,
  'surface must be one of the allowed values'
);

select throws_ok(
  $$ insert into public.courts (name, location, status, source, source_ref)
      values ('Bad', 'SRID=4326;POINT(-122.3 47.65)', 'open', 'manual', 'test-status') $$,
  '23514', null,
  'status must be active, closed, or unverified'
);

select throws_ok(
  $$ insert into public.courts (name, location, source, source_ref)
      values ('Dup', 'SRID=4326;POINT(-122.3 47.65)', 'osm', 'way/682188477') $$,
  '23505', null,
  'the same (source, source_ref) cannot be imported twice'
);

-- ---------------------------------------------------------
-- RLS: public read, no client writes
-- ---------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select isnt_empty(
  $$ select * from public.courts $$,
  'anon can read courts (the map is public)'
);

select throws_ok(
  $$ insert into public.courts (name, location, source, source_ref)
      values ('Fake', 'SRID=4326;POINT(-122.3 47.65)', 'manual', 'test-anon') $$,
  '42501', null,
  'anon cannot add courts'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- No update policy, so RLS filters every row and the update changes nothing.
update public.courts set name = 'Renamed' where source_ref = 'uw-ima';

select is(
  (select name from public.courts where source_ref = 'uw-ima'),
  'UW IMA',
  'signed-in users cannot edit courts'
);

select * from finish();
rollback;
