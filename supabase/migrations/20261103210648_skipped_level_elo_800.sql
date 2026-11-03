-- =========================================================
-- Skipped experience level starts at 800 Elo (was 1200)
-- =========================================================
-- Same as intermediate, so skipping is never better than answering honestly,
-- and it matches what the app's StartingElo screen shows.
--
-- Migration 2 (signup_profile) was later edited to say 800, but it had already
-- run on the hosted project, and applied migrations never run again. This
-- migration makes the change for real. Only the 'skipped' line differs.
-- "create or replace" keeps the existing grants (authenticated only).
create or replace function public.complete_profile(
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
