-- Shows the query plan behind nearby_courts with 500 courts, to check that the
-- GiST index on courts.location is used. Everything rolls back.
--
-- EXPLAIN on a plpgsql function only shows "Function Scan", so this runs the
-- same query the function runs (supabase/migrations/20261111060503_court_functions.sql).
--
-- Run against the LOCAL database only:
--   npx supabase@2.122.0 start
--   docker exec -i supabase_db_MOTION psql -U postgres -d postgres < supabase/perf/nearby_courts_500.sql
-- The pass/fail timing check is supabase/tests/database/nearby_courts_performance.test.sql.
begin;

select setseed(0.403);

insert into public.courts (name, location, source, source_ref)
select 'Perf court ' || i,
       extensions.st_setsrid(
         extensions.st_makepoint(-122.45 + random() * 0.30, 47.50 + random() * 0.25),
         4326
       )::extensions.geography,
       'manual',
       'perf-' || i
  from generate_series(1, 500) as i;

insert into auth.users (id, email)
select gen_random_uuid(), 'perf' || i || '@test.local'
  from generate_series(1, 300) as i;

insert into public.check_ins (user_id, court_id)
select u.id, c.court_id
  from (select id, row_number() over (order by email) as rn
          from auth.users
         where email like 'perf%@test.local') as u
  join public.courts c on c.source_ref = 'perf-' || ((u.rn * 7) % 500 + 1);

analyze public.courts;
analyze public.check_ins;

-- With only ~500 rows the planner may choose a sequential scan, since reading
-- the whole table is cheap. Turning seqscan off shows that the index can serve
-- the query. Compare the two plans and timings.
\echo '--- Plan the planner picks (default search: 5 km, 10 courts)'
explain (analyze, buffers, costs off)
select c.court_id, c.name, c.status, coalesce(a.n, 0)::int,
       extensions.st_distance(c.location, p.pt)
  from courts c
  cross join (select extensions.st_setsrid(extensions.st_makepoint(-122.3035, 47.6553), 4326)::extensions.geography as pt) p
  left join lateral (
    select count(*) as n, avg(pr.elo) as avg_elo
      from check_ins ci
      join profiles pr on pr.user_id = ci.user_id
     where ci.court_id = c.court_id
       and ci.checked_out_at is null
       and ci.expires_at > now()
  ) a on true
 where extensions.st_dwithin(c.location, p.pt, 5000)
 order by extensions.st_distance(c.location, p.pt)
 limit 10;

\echo '--- Same query with sequential scans off (shows the GiST index serving it)'
set local enable_seqscan = off;
explain (analyze, buffers, costs off)
select c.court_id, c.name, c.status, coalesce(a.n, 0)::int,
       extensions.st_distance(c.location, p.pt)
  from courts c
  cross join (select extensions.st_setsrid(extensions.st_makepoint(-122.3035, 47.6553), 4326)::extensions.geography as pt) p
  left join lateral (
    select count(*) as n, avg(pr.elo) as avg_elo
      from check_ins ci
      join profiles pr on pr.user_id = ci.user_id
     where ci.court_id = c.court_id
       and ci.checked_out_at is null
       and ci.expires_at > now()
  ) a on true
 where extensions.st_dwithin(c.location, p.pt, 5000)
 order by extensions.st_distance(c.location, p.pt)
 limit 10;
reset enable_seqscan;

\echo '--- The function itself, as the app calls it'
\timing on
select count(*) from public.nearby_courts(47.6553, -122.3035, 5000, 10);
select count(*) from public.nearby_courts(47.6553, -122.3035, 50000, 200);
\timing off

rollback;
