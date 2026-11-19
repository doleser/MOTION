-- pgTAP: every security definer function in public pins search_path to ''.
-- A security definer function runs with its owner's rights, so it must use full
-- schema names instead of searching schemas a caller might add objects to.
-- If this fails, add `set search_path = ''` to the named function and prefix
-- its tables and functions (public., extensions., realtime.).
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select is_empty(
  $$
    select p.oid::regprocedure::text
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prosecdef
       and not coalesce('search_path=""' = any (p.proconfig), false)
  $$,
  'every security definer function in public sets search_path to empty'
);

-- The functions the pin migration re-created still keep their grants.
select ok(
  has_function_privilege('anon', 'public.nearby_courts(double precision, double precision, integer, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.get_court_players(bigint)', 'execute')
  and not has_function_privilege('authenticated', 'public.expire_check_ins()', 'execute')
  and not has_function_privilege('authenticated', 'public.broadcast_court_count(bigint)', 'execute'),
  're-created functions keep their grants'
);

select * from finish();
rollback;
