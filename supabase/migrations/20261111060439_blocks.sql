-- MOTION blocks. Run as a migration BEFORE check_in_functions.sql
-- (get_court_players reads this table, and SQL functions check their tables
-- when they are created).
--
-- One row = "blocker blocked blocked". Blocking is one-way to do but two-way in
-- effect: neither player sees the other in court lists, and a blocked player
-- cannot challenge or view the blocker. The blocked player is never told.
--
-- Privacy rule: a player can read only the blocks THEY made. Nobody can read
-- rows where they are the blocked player, or they would learn they were blocked.
-- All writes go through block_user / unblock_user.
--
-- Errors follow the frontend's errors.ts convention:
--   not signed in  -> errcode 42501, 'Not signed in.'
--   anything else  -> errcode 22023 with a fixed sentence

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (user_id) on delete cascade,
  blocked_id uuid not null references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_pkey primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

-- "Who has blocked this player?" (used when checking visibility both ways).
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

revoke all on public.blocks from anon;
revoke insert, update, delete on public.blocks from authenticated;

drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = auth.uid());

-- ---------------------------------------------------------------
-- block_user(user_id) -> void
-- Idempotent: blocking someone twice is fine.
-- Errors: 'Player not found.', 'You cannot block yourself.'
-- ---------------------------------------------------------------
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from profiles where user_id = p_user_id) then
    raise exception 'Player not found.' using errcode = '22023';
  end if;
  if p_user_id = v_uid then
    raise exception 'You cannot block yourself.' using errcode = '22023';
  end if;

  insert into blocks (blocker_id, blocked_id)
  values (v_uid, p_user_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------
-- unblock_user(user_id) -> void
-- Idempotent: unblocking someone you haven't blocked does nothing.
-- ---------------------------------------------------------------
create or replace function public.unblock_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  delete from blocks
   where blocker_id = v_uid
     and blocked_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------
-- get_my_blocks() -> the players the caller has blocked, newest first
-- For a "Blocked players" settings list.
-- ---------------------------------------------------------------
create or replace function public.get_my_blocks()
returns table (
  user_id uuid,
  username text,
  blocked_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select b.blocked_id, p.username, b.created_at
    from blocks b
    join profiles p on p.user_id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc;
$$;

-- ---------------------------------------------------------------
-- is_blocked_between(other) -> true if EITHER player blocked the other
-- Internal helper for other functions (get_profile, create_challenge, ...)
-- so they can answer "player unavailable" without revealing who blocked whom.
-- Not callable by clients: it would let a blocked player discover the block.
-- ---------------------------------------------------------------
create or replace function public.is_blocked_between(p_other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from blocks
     where (blocker_id = auth.uid() and blocked_id = p_other)
        or (blocker_id = p_other and blocked_id = auth.uid())
  );
$$;

-- "from public" is not enough on Supabase: its default privileges also grant
-- execute directly to anon and authenticated, so revoke from anon by name.
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.get_my_blocks() from public, anon;
revoke all on function public.is_blocked_between(uuid) from public, anon, authenticated;

grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.get_my_blocks() to authenticated;
