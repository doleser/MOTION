-- =========================================================
-- profiles.real_name
-- =========================================================
-- The player's real name, entered during sign-up. Required for new accounts.
--
-- Nullable on purpose: profile rows are created empty by handle_new_user before
-- sign-up finishes, and accounts made before this migration have no name yet.
-- complete_profile is what requires it.
--
-- Visible to every signed-in user, the same as the rest of the profile (the
-- profiles select policy is `using (true)`).
--
-- No character rule: real names include spaces, hyphens, apostrophes, and
-- accents (e.g. "Nguyễn", "O'Neil", "Mary-Kate"). Only the shape is checked:
-- no leading or trailing spaces, not blank, at most 50 characters.
alter table public.profiles
  add column real_name text
                       constraint profiles_real_name_check check (
                         real_name = btrim(real_name)
                         and real_name <> ''
                         and char_length(real_name) <= 50
                       );

-- A finished profile must have a real name, whichever way it was finished.
-- Unfinished rows (onboarded_at is null) may still be empty mid-sign-up.
alter table public.profiles
  add constraint profiles_real_name_required check (
    onboarded_at is null or real_name is not null
  );

-- Grants add up: the earlier column grants still apply. Users can edit their
-- own name later (e.g. from an Edit Profile screen); the CHECK above still applies.
grant update (real_name) on public.profiles to authenticated;


-- =========================================================
-- complete_profile: now takes p_real_name
-- =========================================================
-- Adding a parameter makes a NEW function in Postgres (functions are identified
-- by their argument types), and t old one would stay callable. Drop the old
-- signature first so there is exactly one complete_profile.
drop function public.complete_profile(text, text, text, integer, text[], bigint);

-- Same as before (elo 400 / 800 / 1200 / skipped 800), plus the real name.
-- p_real_name has a default only so a missing name gets the clear 22023 error
-- below instead of "function does not exist".
-- Errors: 22023 bad level, missing username, or missing real name; 23514 bad
-- username format, a real name over 50 characters (or a blank position / empty
-- tag list); 23505 username taken; 55000 profile already complete.
create function public.complete_profile(
  p_username      text,
  p_level         text,
  p_position      text    default null,
  p_height_cm     integer default null,
  p_tags          text[]  default null,
  p_home_court_id bigint  default null,
  p_real_name     text    default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_elo       integer;
  v_real_name text;
  v_profile   public.profiles;
begin
  -- The username CHECK lets NULL through, so require it here.
  if p_username is null then
    raise exception 'Username is required.' using errcode = '22023';
  end if;

  -- Trim surrounding spaces; a blank name counts as missing.
  v_real_name := nullif(btrim(p_real_name), '');
  if v_real_name is null then
    raise exception 'Real name is required.' using errcode = '22023';
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
         real_name     = v_real_name,
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

-- A new function is executable by PUBLIC (and Supabase also grants anon), so revoke
-- first. The drop above removed the old grants along with the old function.
revoke execute on function public.complete_profile(text, text, text, integer, text[], bigint, text)
  from public, anon;
grant execute on function public.complete_profile(text, text, text, integer, text[], bigint, text)
  to authenticated;
