-- pgTAP tests for live court counts (court_count_broadcast migration): checking
-- in, checking out, and expiring each broadcast the court's new count on the
-- private topic 'court:<id>', and clients can't send on those topics.
-- The app's subscribeToCourtCounts (src/services/courts.ts) relies on this.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local');

-- The newest count broadcast for a court. Messages are cleared before each
-- step, since now() doesn't move inside this transaction.
create function pg_temp.broadcast_count(p_court text)
returns integer language sql as $$
  select (payload->>'playerCount')::int
    from realtime.messages
   where topic = 'court:' || (select court_id from public.courts where name = p_court)
     and event = 'count'
     and extension = 'broadcast'
     and private;
$$;

-- ---------------------------------------------------------
-- Check-in
-- ---------------------------------------------------------
delete from realtime.messages;
insert into public.check_ins (user_id, court_id) values
  ('11111111-1111-1111-1111-111111111111',
   (select court_id from public.courts where name = 'Laurelhurst Half Court'));

select is(pg_temp.broadcast_count('Laurelhurst Half Court'), 1,
  'checking in broadcasts the new count on court:<id>');

select is(
  (select payload->>'courtId' from realtime.messages limit 1),
  (select court_id::text from public.courts where name = 'Laurelhurst Half Court'),
  'the broadcast says which court it is for'
);

-- ---------------------------------------------------------
-- Check-out
-- ---------------------------------------------------------
delete from realtime.messages;
update public.check_ins set checked_out_at = now()
 where user_id = '11111111-1111-1111-1111-111111111111' and checked_out_at is null;

select is(pg_temp.broadcast_count('Laurelhurst Half Court'), 0,
  'checking out broadcasts the lower count');

-- ---------------------------------------------------------
-- Expiry (pg_cron runs expire_check_ins every minute)
-- ---------------------------------------------------------
insert into public.check_ins (user_id, court_id, checked_in_at, expires_at) values
  ('22222222-2222-2222-2222-222222222222',
   (select court_id from public.courts where name = 'Green Lake Half Court'),
   now() - interval '4 hours', now() - interval '1 hour');
delete from realtime.messages;
select public.expire_check_ins();

select is(pg_temp.broadcast_count('Green Lake Half Court'), 0,
  'an expired check-in broadcasts the lower count once the sweep closes it');

select ok(
  exists (select 1 from cron.job where jobname = 'expire-check-ins'),
  'the expiry sweep is scheduled'
);

-- ---------------------------------------------------------
-- Clients can listen but not send
-- ---------------------------------------------------------
set local role anon;
select throws_ok(
  $$insert into realtime.messages (topic, extension, event, payload, private)
    values ('court:1', 'broadcast', 'count', '{"courtId": 1, "playerCount": 99}', true)$$,
  '42501',
  null,
  'anon cannot send a fake count'
);
reset role;

select * from finish();
rollback;
