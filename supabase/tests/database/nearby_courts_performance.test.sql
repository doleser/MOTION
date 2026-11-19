-- Performance requirement: court search answers in under 1 s with 500 courts.
-- Seeds 500 courts around Seattle and 300 open check-ins, then times
-- nearby_courts from the UW IMA. Each case keeps the slowest of 20 calls.
-- Cases: the map's default search (5 km, 10 courts) and the widest one the
-- function allows (50 km, 200 courts).
-- The timings are printed as diagnostics, so the CI log shows the real numbers.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

-- Same courts every run.
select setseed(0.403);

-- A box around Seattle, about 22 km east to west and 28 km north to south.
insert into public.courts (name, location, source, source_ref)
select 'Perf court ' || i,
       extensions.st_setsrid(
         extensions.st_makepoint(-122.45 + random() * 0.30, 47.50 + random() * 0.25),
         4326
       )::extensions.geography,
       'manual',
       'perf-' || i
  from generate_series(1, 500) as i;

-- 300 players, each checked in at one of the new courts. Their profiles come from
-- the handle_new_user trigger.
insert into auth.users (id, email)
select gen_random_uuid(), 'perf' || i || '@test.local'
  from generate_series(1, 300) as i;

insert into public.check_ins (user_id, court_id)
select u.id, c.court_id
  from (select id, row_number() over (order by email) as rn
          from auth.users
         where email like 'perf%@test.local') as u
  join public.courts c on c.source_ref = 'perf-' || ((u.rn * 7) % 500 + 1);

select ok(
  (select count(*) from public.courts) >= 500,
  'at least 500 courts are in the table'
);

select is(
  (select count(*)::int from public.check_ins
    where checked_out_at is null and expires_at > now()
      and user_id in (select id from auth.users where email like 'perf%@test.local')),
  300,
  '300 players are checked in'
);

-- The slowest of p_runs calls, in milliseconds.
create function pg_temp.slowest_nearby_ms(p_radius_m integer, p_limit integer, p_runs integer)
returns numeric
language plpgsql
as $$
declare
  v_start   timestamptz;
  v_slowest numeric := 0;
begin
  for i in 1..p_runs loop
    v_start := clock_timestamp();
    perform * from public.nearby_courts(47.6553, -122.3035, p_radius_m, p_limit);
    v_slowest := greatest(
      v_slowest,
      extract(epoch from clock_timestamp() - v_start) * 1000
    );
  end loop;
  return round(v_slowest, 2);
end;
$$;

create temp table timings as
select 'default (5 km, 10 courts)' as search_case, pg_temp.slowest_nearby_ms(5000, 10, 20) as slowest_ms
union all
select 'widest (50 km, 200 courts)', pg_temp.slowest_nearby_ms(50000, 200, 20);

select diag('nearby_courts, ' || search_case || ': slowest of 20 calls = ' || slowest_ms || ' ms')
  from timings;

select ok(
  (select slowest_ms from timings where search_case like 'default%') < 1000,
  'the default map search takes under 1 s with 500 courts'
);

select ok(
  (select slowest_ms from timings where search_case like 'widest%') < 1000,
  'the widest search takes under 1 s with 500 courts'
);

select * from finish();
rollback;
