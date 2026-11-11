-- MOTION check-in extras (Supabase RPC). Run as a migration.
--
-- check_in and check_out already exist in the backend and are NOT touched here.
-- This adds the functions around them:
--   confirm_still_here, get_my_check_in, get_court_players, expire_check_ins
--
-- Errors follow the frontend's fromCheckInError (errors.ts):
--   not signed in  -> errcode 42501
--   everything else -> errcode 22023 with a fixed sentence ('Not checked in.')
-- Row-level security on check_ins is not changed here. These functions are
-- security definer, so they work whatever the policies are.

-- ---------------------------------------------------------------
-- confirm_still_here(check_in_id, answer) -> check_ins row
-- yes: extends expires_at to now() + 3h (DESIGN CHOICE, see note below)
-- no:  checks the player out
-- Errors: 'Not checked in.' (no open check-in with that id for the caller)
-- ---------------------------------------------------------------
create or replace function public.confirm_still_here(
  p_check_in_id bigint,
  p_answer boolean
) returns public.check_ins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.check_ins;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_answer then
    update check_ins
       set expires_at = now() + interval '3 hours'
     where check_in_id = p_check_in_id
       and user_id = v_uid
       and checked_out_at is null
       and expires_at > now()
     returning * into v_row;
  else
    update check_ins
       set checked_out_at = least(now(), expires_at)
     where check_in_id = p_check_in_id
       and user_id = v_uid
       and checked_out_at is null
     returning * into v_row;
  end if;

  if not found then
    raise exception 'Not checked in.' using errcode = '22023';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------
-- get_my_check_in() -> the caller's open, unexpired check-in, or no row
-- Call on app open to restore state / trigger the "Still here?" prompt.
-- ---------------------------------------------------------------
create or replace function public.get_my_check_in()
returns setof public.check_ins
language sql
security definer
stable
set search_path = public
as $$
  select * from check_ins
   where user_id = auth.uid()
     and checked_out_at is null
     and expires_at > now();
$$;

-- ---------------------------------------------------------------
-- get_court_players(court_id) -> who is here
-- Only returns rows if the caller is checked in at that court (open and
-- unexpired). Leaves out anyone who blocked the caller or whom the caller
-- blocked.
-- ---------------------------------------------------------------
create or replace function public.get_court_players(p_court_id bigint)
returns table (
  user_id uuid,
  username text,
  elo integer,
  checked_in_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select p.user_id, p.username, p.elo, ci.checked_in_at
    from check_ins ci
    join profiles p on p.user_id = ci.user_id
   where ci.court_id = p_court_id
     and ci.checked_out_at is null
     and ci.expires_at > now()
     -- caller must be checked in at this same court
     and exists (
       select 1 from check_ins me
        where me.user_id = auth.uid()
          and me.court_id = p_court_id
          and me.checked_out_at is null
          and me.expires_at > now()
     )
     and not exists (
       select 1 from blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = ci.user_id)
           or (b.blocker_id = ci.user_id and b.blocked_id = auth.uid())
     )
   order by ci.checked_in_at;
$$;

-- ---------------------------------------------------------------
-- expire_check_ins() -> number of check-ins closed
-- Closes check-ins whose 3 hours are up, so an expired visit never blocks a
-- new check-in and live counts drop. Internal: run on a schedule, not by clients.
-- ---------------------------------------------------------------
create or replace function public.expire_check_ins()
returns integer
language sql
security definer
set search_path = public
as $$
  with closed as (
    update check_ins
       set checked_out_at = expires_at
     where checked_out_at is null and expires_at <= now()
     returning 1
  )
  select count(*)::int from closed;
$$;

-- Needs the pg_cron extension (Database > Extensions in the dashboard):
-- select cron.schedule('expire-check-ins', '*/5 * * * *', 'select public.expire_check_ins()');

-- ---------------------------------------------------------------
-- Grants: clients may call the RPCs; the sweep is internal only.
-- ---------------------------------------------------------------
-- "from public" is not enough on Supabase: its default privileges also grant
-- execute directly to anon and authenticated, so revoke from them by name.
revoke all on function public.confirm_still_here(bigint, boolean) from public, anon;
revoke all on function public.get_my_check_in() from public, anon;
revoke all on function public.get_court_players(bigint) from public, anon;
revoke all on function public.expire_check_ins() from public, anon, authenticated;

grant execute on function public.confirm_still_here(bigint, boolean) to authenticated;
grant execute on function public.get_my_check_in() to authenticated;
grant execute on function public.get_court_players(bigint) to authenticated;
