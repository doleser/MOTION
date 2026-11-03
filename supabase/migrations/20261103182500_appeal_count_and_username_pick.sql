-- =========================================================
-- Default elo 800, appeal_count, first_available_username
-- =========================================================

-- Default elo is 800 (same as intermediate). complete_profile still sets the real
-- starting elo from the chosen level, so this only applies before onboarding.
alter table public.profiles
  alter column elo set default 800;

-- appeal_count: not in any column grant, so clients can't write it directly.
-- It only changes through increment_appeal_count() below.
alter table public.profiles
  add column appeal_count integer not null default 0
                          constraint profiles_appeal_count_check check (appeal_count >= 0);


-- =========================================================
-- increment_appeal_count
-- =========================================================
-- Adds 1 to the signed-in user's own appeal_count and returns the new value.
-- One atomic UPDATE, so two calls at once can't lose an increment.
-- Errors: P0002 the user has no profile.
create function public.increment_appeal_count()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.profiles
     set appeal_count = appeal_count + 1
   where user_id = (select auth.uid())
  returning appeal_count into v_count;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  return v_count;
end;
$$;

revoke execute on function public.increment_appeal_count() from public, anon;
grant execute on function public.increment_appeal_count() to authenticated;


-- =========================================================
-- first_available_username
-- =========================================================
-- Takes candidate usernames (best first) and returns the first one that follows the
-- format rule and that nobody has (case-insensitive), or NULL if none qualify.
-- Works signed out, like is_username_available. security definer because RLS hides
-- every profile from anon; it only returns one name from the caller's own list.
-- lower(username) matches profiles_username_lower_unique, so it uses that index.
create function public.first_available_username(p_names text[])
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select n.name
    from unnest(p_names) with ordinality as n(name, ord)
   where n.name ~ '^[A-Za-z0-9_]{3,16}$'
     and not exists (
       select 1 from public.profiles p where lower(p.username) = lower(n.name)
     )
   order by n.ord
   limit 1;
$$;

revoke execute on function public.first_available_username(text[]) from public;
grant execute on function public.first_available_username(text[]) to anon, authenticated;