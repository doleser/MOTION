-- =========================================================
-- profiles: sign-up details
-- =========================================================
-- All optional: the sign-up screens let the user skip each of these.
-- A skipped answer is NULL. Blanks are rejected so NULL is the only "not filled in"
-- value, the same as ProfileDetails, which turns blanks into no answer.
alter table public.profiles
  -- At least one non-space character.
  add column position      text
                           constraint profiles_position_check check (position ~ '\S'),
  -- Whole centimeters; same rule as the ProfileDetails screen.
  add column height_cm     integer
                           constraint profiles_height_cm_check check (height_cm > 0),
  add column tags          text[]
                           constraint profiles_tags_check check (cardinality(tags) > 0),
  -- Deleting a court clears it as a home court instead of blocking the delete.
  add column home_court_id bigint references public.courts (court_id) on delete set null,
  -- Set once by complete_profile. Not in the column grant, so users can't clear it
  -- and run sign-up again to reset their elo.
  add column onboarded_at  timestamptz;

create index profiles_home_court_id_idx on public.profiles (home_court_id);

-- Grants add up: migration 1's grant on (username, open_to_challenges) still applies.
-- elo and onboarded_at stay out, so only security definer functions can write them.
grant update (position, height_cm, tags, home_court_id) on public.profiles to authenticated;


-- =========================================================
-- complete_profile
-- =========================================================
-- Last step of sign-up: sets the handle, the profile details, and the starting elo.
-- Clients can't write elo, so this is the only way it gets set. Works once per user.
-- Errors: 22023 bad level or missing username, 23514 bad username format (or a
-- blank position / empty tag list), 23505 username taken, 55000 profile already complete.
create function public.complete_profile(
  p_username      text,
  p_level         text,
  p_position      text    default null,
  p_height_cm     integer default null,
  p_tags          text[]  default null,
  p_home_court_id bigint  default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_elo     integer;
  v_profile public.profiles;
begin
  -- The username CHECK lets NULL through, so require it here.
  if p_username is null then
    raise exception 'Username is required.' using errcode = '22023';
  end if;

  v_elo := case p_level
    when 'beginner'     then 400
    when 'intermediate' then 800
    when 'advanced'     then 1200
    when 'skipped'      then 800
  end;
  if v_elo is null then
    raise exception 'Unknown level: %', p_level using errcode = '22023';
  end if;

  -- The once-only check is in the WHERE clause, so two calls at the same time
  -- can't both succeed: the second waits for the row lock, re-checks, and matches nothing.
  update public.profiles
     set username      = p_username,
         position      = p_position,
         height_cm     = p_height_cm,
         tags          = p_tags,
         home_court_id = p_home_court_id,
         elo           = v_elo,
         onboarded_at  = now()
   where user_id = (select auth.uid())
     and onboarded_at is null
  returning * into v_profile;

  if not found then
    raise exception 'Profile is already complete.' using errcode = '55000';
  end if;

  return v_profile;
end;
$$;

-- New functions are executable by PUBLIC (and Supabase also grants anon), so revoke first.
revoke execute on function public.complete_profile(text, text, text, integer, text[], bigint)
  from public, anon;
grant execute on function public.complete_profile(text, text, text, integer, text[], bigint)
  to authenticated;


-- =========================================================
-- is_username_available
-- =========================================================
-- The ChooseHandle screen checks the username before the account exists, so this
-- must work signed out. security definer because RLS hides every profile from anon;
-- it only returns true/false, so no profile data leaks.
-- lower(username) matches profiles_username_lower_unique, so it uses that index.
create function public.is_username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(name)
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;
