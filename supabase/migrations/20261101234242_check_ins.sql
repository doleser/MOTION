-- =========================================================
-- check_ins
-- =========================================================
-- One row per visit to a court. Stores which court and when, never a coordinate.
-- Active while checked_out_at is null and expires_at hasn't passed. Player counts are
-- computed from active rows when queried (nearby_courts), never stored.
create table public.check_ins (
  check_in_id    bigint generated always as identity primary key,
  -- Deleting the account deletes its check-ins.
  user_id        uuid not null references public.profiles (user_id) on delete cascade,
  -- Check-ins are never deleted, so a court that has any can't be either.
  -- A closed court gets status = 'closed' instead.
  court_id       bigint not null references public.courts (court_id) on delete restrict,
  checked_in_at  timestamptz not null default now(),
  -- The 3 hour rule lives here. A default can't refer to checked_in_at, so a row that
  -- sets checked_in_at itself should set expires_at too.
  expires_at     timestamptz not null default now() + interval '3 hours',
  -- NULL while the check-in is open.
  checked_out_at timestamptz,
  constraint check_ins_expires_at_check check (expires_at > checked_in_at),
  constraint check_ins_checked_out_at_check check (checked_out_at >= checked_in_at)
);

-- Live count per court: only open rows, which is what nearby_courts counts.
create index check_ins_open_court_idx on public.check_ins (court_id)
  where checked_out_at is null;

-- One open check-in per user. now() can't go in an index predicate, so this ignores
-- expiry: an expired row that was never checked out still blocks the next check-in.
-- check_in has to close it first (set checked_out_at = expires_at).
create unique index check_ins_one_open_per_user on public.check_ins (user_id)
  where checked_out_at is null;

-- Clients get no direct writes. Rows are written only by the security definer
-- functions check_in, check_out, and confirm_still_here.
revoke insert, update, delete on public.check_ins from anon, authenticated;


-- =========================================================
-- is_checked_in_at
-- =========================================================
-- True if the caller has an active check-in at the court. The select policy below uses
-- it: a policy that queries its own table fails with "infinite recursion detected in
-- policy", but a security definer function reads the table without RLS.
create function public.is_checked_in_at(p_court_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.check_ins
     where user_id = (select auth.uid())
       and court_id = p_court_id
       and checked_out_at is null
       and expires_at > now()
  );
$$;

-- The policy runs as the caller, so signed-in users need execute.
revoke execute on function public.is_checked_in_at(bigint) from public, anon;
grant execute on function public.is_checked_in_at(bigint) to authenticated;


-- =========================================================
-- RLS on check_ins
-- =========================================================
alter table public.check_ins enable row level security;

-- Anyone can see player counts (nearby_courts), but only players checked in at a court
-- see who is playing there. A user always sees their own check-ins.
-- No anon policy, so signed-out visitors see no rows.
-- TODO: once the blocks table exists, hide check-ins from users who blocked the viewer
-- (or that the viewer blocked).
create policy "Players see their own check-ins and others at their court"
  on public.check_ins for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (checked_out_at is null
        and expires_at > now()
        and public.is_checked_in_at(court_id))
  );


-- =========================================================
-- Realtime
-- =========================================================
-- Postgres Changes events obey the select policy, so they reach players checked in at
-- the same court. They can't keep the map's counts live: other viewers get no events,
-- and a check-out row fails the policy for everyone but its owner. The map re-fetches
-- nearby_courts instead.
-- Default replica identity on purpose: with FULL, a DELETE event would carry user_id,
-- and RLS doesn't filter DELETE events.
alter publication supabase_realtime add table public.check_ins;
