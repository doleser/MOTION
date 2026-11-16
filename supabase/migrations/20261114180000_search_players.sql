-- MOTION player search (Supabase RPC). Run as a migration.
--
-- search_players(p_query) finds finished profiles whose username starts with
-- the query. The screen searches from the first character and never sends a
-- query that cannot match a handle; this function checks the query again so
-- a stale client cannot widen the result.
--
-- The alphabet and the 16-character cap match username_format
-- (^[A-Za-z0-9_]{3,16}$). The 3-character username minimum does not apply
-- to search. Matching uses starts_with, because _ is a real username
-- character and a single-character wildcard in LIKE.
--
-- Blocks are hidden in both directions. RLS lets a player read only blocks
-- they created, so this function is security definer and does not say which
-- side blocked the other.
--
-- Errors follow errors.ts:
--   not signed in -> errcode 42501, 'Not signed in.'
-- A query that cannot match a handle returns no rows.

create or replace function public.search_players(p_query text)
returns table (
  user_id uuid,
  real_name text,
  username text,
  elo integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  -- Same alphabet and 16-character cap as username_format.
  -- The 3-character username minimum does not apply to search.
  v_query text := lower(btrim(coalesce(p_query, '')));
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  -- A query that cannot match a handle returns no rows. The checks sit in
  -- WHERE so this table function does not emit a blank row on the way out.
  return query
  select p.user_id, p.real_name, p.username, p.elo
    from public.profiles p
   where v_query <> ''
     and char_length(v_query) <= 16
     and v_query ~ '^[a-z0-9_]+$'
     and p.user_id <> v_uid
     and p.onboarded_at is not null
     and p.username is not null
     and p.real_name is not null
     and starts_with(lower(p.username), v_query)
     and not exists (
       select 1
         from public.blocks b
        where (b.blocker_id = v_uid and b.blocked_id = p.user_id)
           or (b.blocker_id = p.user_id and b.blocked_id = v_uid)
     )
   order by lower(p.username) asc
   limit 20;
end;
$$;

-- A new function is executable by PUBLIC (and Supabase also grants anon).
revoke execute on function public.search_players(text) from public, anon;
grant execute on function public.search_players(text) to authenticated;
