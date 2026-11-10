-- MOTION live court counts. Run as a migration AFTER check_in_functions.
-- When a check-in is created, closed, or moved, the database broadcasts the
-- court's new player count on the public Realtime topic 'court:<court_id>',
-- event 'count', payload {courtId, playerCount}.
--
-- The count is public information, and the broadcast carries no player names,
-- so anyone (even signed out) may listen. Row-level security on check_ins is
-- unaffected: nobody can read other players' rows through Realtime.

create or replace function public.broadcast_court_count(p_court_id bigint)
returns void
language plpgsql
security definer
set search_path = public, realtime
as $$
declare
  v_count integer;
begin
  select count(*)::int into v_count
    from check_ins
   where court_id = p_court_id
     and checked_out_at is null
     and expires_at > now();

  perform realtime.send(
    jsonb_build_object('courtId', p_court_id, 'playerCount', v_count),
    'count',
    'court:' || p_court_id,
    false  -- public topic
  );
end;
$$;

create or replace function public.check_ins_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  if tg_op <> 'DELETE' then
    perform broadcast_court_count(new.court_id);
  end if;
  -- A row that left a court (check-out, or a move) changes the old court too.
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.court_id is distinct from new.court_id) then
    perform broadcast_court_count(old.court_id);
  end if;
  return null;
end;
$$;

drop trigger if exists check_ins_broadcast_trg on public.check_ins;
create trigger check_ins_broadcast_trg
  after insert or update or delete on public.check_ins
  for each row execute function public.check_ins_broadcast();

-- Internal only: clients must not call these directly.
revoke all on function public.broadcast_court_count(bigint) from public, anon, authenticated;
revoke all on function public.check_ins_broadcast() from public, anon, authenticated;

-- NOTE: A count also falls when a check-in EXPIRES, but nothing changes in the
-- table at that moment. Schedule expire_check_ins() (see check_in_functions.sql)
-- with pg_cron so expired rows are closed, which fires this trigger.
