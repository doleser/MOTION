-- =========================================================
-- King of the Court
-- =========================================================
-- A court can run several sessions. A player is in at most one. The host name
-- is display only. The session ends when nobody is left in it.
--
-- The king is sessions.king_id and also a session_players row in state 'king',
-- so the one-active-session index covers the king. Queue JSON does not list
-- that row as waiting or on court.
--
-- Ranked Elo still goes through finalize_confirmed_game, once per confirmed
-- game. A King of the Court dispute does not count toward the ranked ban.
-- Confirm waits 5 minutes here and 24 hours for a 1v1.
--
-- Clients do not write these tables. Functions are security definer in public,
-- with search_path pinned, matching the other live-state functions.
--
-- The app calls get_court_sessions, start_kotc_session, join_kotc_session,
-- leave_kotc_session, confirm_kotc_here, and report_kotc_result. Confirming
-- and disputing stay on confirm_result and dispute_result. A session game is
-- a games row with session_id set. The kotc_* helpers are not callable.
--
-- Not signed in is 42501 'Not signed in.' A rule failure is 22023 with one
-- of these messages:
--   'Not checked in.'  'Court is not available.'  'Session not found.'
--   'Ranked play is paused.'  'Not in session.'  'Not up next.'
--   'Not playing.'  'Winner must be playing.'  'Result already reported.'
-- get_court_sessions does not raise for a signed-out or unchecked-in caller.
-- It returns [].

-- Line order. A player sent to the back takes the next value, so nobody else
-- has to be renumbered. Cleared when the player steps on court or becomes king.
create sequence public.kotc_queue_position;

-- One running King of the Court. session_number is the lowest free number
-- among rows at that court whose ended_at is still null. host_id is whoever
-- started it and does not change when they leave. king_id is the crown, null
-- when it is vacant. king_streak counts that king's confirmed wins.
-- pending_king_id is who held the crown when the open game was reported, so
-- confirm still knows after that player leaves. Null means the crown was
-- vacant at report time. last_event_kind is only 'disputed' for now.

create table public.sessions (
  session_id       bigint generated always as identity primary key,
  court_id         bigint not null references public.courts (court_id) on delete restrict,
  session_number   integer not null,
  host_id          uuid references public.profiles (user_id) on delete set null,
  ranked           boolean not null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  king_id          uuid references public.profiles (user_id) on delete set null,
  king_streak      integer not null default 0,
  -- King of the game currently waiting on confirm. Null when the crown was vacant.
  pending_king_id  uuid,
  last_event_kind  text check (last_event_kind in ('disputed')),
  last_event_at    timestamptz,
  constraint sessions_streak_nonneg check (king_streak >= 0)
);

create unique index sessions_running_number on public.sessions (court_id, session_number)
  where ended_at is null;

-- One row per player per session, including the king and players who have left.
-- waiting is the line, on_court has tapped "I'm here", king matches sessions.king_id,
-- and left is history. queue_position orders the waiting rows. here_deadline is
-- set only while a spot on court is open for that player. missed_here_count is
-- consecutive misses; a show-up resets it. left_reason is left, checked_out,
-- no_show, or switched.
create table public.session_players (
  session_id        bigint not null references public.sessions (session_id) on delete cascade,
  user_id           uuid not null references public.profiles (user_id) on delete cascade,
  state             text not null check (state in ('waiting', 'on_court', 'king', 'left')),
  queue_position    bigint,
  on_court_at       timestamptz,
  here_deadline     timestamptz,
  missed_here_count integer not null default 0,
  joined_at         timestamptz not null default now(),
  left_at           timestamptz,
  left_reason       text check (left_reason in ('left', 'checked_out', 'no_show', 'switched')),
  primary key (session_id, user_id),
  constraint session_players_misses_nonneg check (missed_here_count >= 0)
);

-- The king row is state 'king', not 'left', so this one index also stops a
-- player from being king of one session and waiting in another.
create unique index session_players_one_active on public.session_players (user_id)
  where state <> 'left';

-- Null on a 1v1. Set on a King of the Court game. The game itself stays in games.
alter table public.games
  add column session_id bigint references public.sessions (session_id);

-- The queue does not move while this row exists.
create unique index games_one_pending_per_session on public.games (session_id)
  where status = 'pending' and session_id is not null;

-- No policies below. security definer functions are the only readers and writers.
revoke all on public.sessions from anon, authenticated;
revoke all on public.session_players from anon, authenticated;
revoke all on sequence public.kotc_queue_position from public, anon, authenticated;

alter table public.sessions enable row level security;
alter table public.session_players enable row level security;


-- =========================================================
-- Internal helpers
-- =========================================================
-- None of these are granted to anon or authenticated. They assume the caller
-- already holds the session row lock, except where a function takes it itself.

-- True while profiles.ranked_banned_until is still in the future. A ban blocks
-- a new ranked start or join. It does not remove someone already in a session,
-- and it does not block a casual session.
create function public.kotc_ranked_paused(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles
     where user_id = p_user_id
       and ranked_banned_until > now()
  );
$$;

-- The player holds this session's crown, or has a session_players row here
-- that is not 'left'. A player who already left is not active, so to_back and
-- make_king leave them alone.
create function public.kotc_active(p_session_id bigint, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.sessions s
     where s.session_id = p_session_id
       and s.king_id = p_user_id
  )
  or exists (
    select 1
      from public.session_players sp
     where sp.session_id = p_session_id
       and sp.user_id = p_user_id
       and sp.state <> 'left'
  );
$$;

-- One message for the court, plus the public count broadcast so the map
-- refetches session_live and kotc_waiting. The payload has no names.
create function public.kotc_notify(p_court_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('courtId', p_court_id),
    'changed',
    'kotc:' || p_court_id,
    true
  );
  perform public.broadcast_court_count(p_court_id);
end;
$$;

-- Lock every running session this player is in, plus p_also, in session_id
-- order. Same order on every path, so two joins cannot deadlock.
create function public.kotc_lock_player_sessions(p_user_id uuid, p_also bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  for v_id in
    select s.session_id
      from public.sessions s
     where s.ended_at is null
       and (
         s.session_id = p_also
         or s.king_id = p_user_id
         or exists (
           select 1
             from public.session_players sp
            where sp.session_id = s.session_id
              and sp.user_id = p_user_id
              and sp.state <> 'left'
         )
       )
     order by s.session_id
     for update
  loop
    null;
  end loop;
end;
$$;

-- Mark one player left and, when they held it, clear the crown. Does not
-- settle the line or broadcast. leave, switch, checkout, and a second miss do.
create function public.kotc_leave_member(
  p_session_id bigint,
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sessions
     set king_id = null,
         king_streak = 0
   where session_id = p_session_id
     and king_id = p_user_id;

  update public.session_players
     set state = 'left',
         left_at = now(),
         left_reason = p_reason,
         here_deadline = null,
         queue_position = null,
         on_court_at = null
   where session_id = p_session_id
     and user_id = p_user_id
     and state <> 'left';
end;
$$;

-- Send an active player to the back by taking a new queue_position. Clears
-- the crown when they held it. Does not change missed_here_count. A player
-- who already left stays left, which is how a winner who checked out does
-- not return.
create function public.kotc_to_back(p_session_id bigint, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or not public.kotc_active(p_session_id, p_user_id) then
    return;
  end if;

  update public.sessions
     set king_id = null,
         king_streak = 0
   where session_id = p_session_id
     and king_id = p_user_id;

  insert into public.session_players (session_id, user_id, state, queue_position)
  values (
    p_session_id,
    p_user_id,
    'waiting',
    nextval('public.kotc_queue_position')
  )
  on conflict (session_id, user_id) do update
    set state = 'waiting',
        queue_position = nextval('public.kotc_queue_position'),
        on_court_at = null,
        here_deadline = null,
        left_at = null,
        left_reason = null;
end;
$$;

-- Make an active player the king and set the streak. A player who already
-- left does not take the crown; the caller leaves it vacant instead.
create function public.kotc_make_king(
  p_session_id bigint,
  p_user_id uuid,
  p_streak integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or not public.kotc_active(p_session_id, p_user_id) then
    return;
  end if;

  insert into public.session_players (session_id, user_id, state)
  values (p_session_id, p_user_id, 'king')
  on conflict (session_id, user_id) do update
    set state = 'king',
        queue_position = null,
        on_court_at = null,
        here_deadline = null,
        left_at = null,
        left_reason = null;

  update public.sessions
     set king_id = p_user_id,
         king_streak = p_streak
   where session_id = p_session_id;
end;
$$;

-- Open spots: 0 while a result is pending, otherwise 1 with a king or 2 without,
-- minus whoever is already on court. The first that many waiting players keep
-- or receive a 2-minute deadline. Everyone else loses theirs.
create function public.kotc_settle(p_session_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_king    uuid;
  v_spots   integer;
  v_on      integer;
  v_waiting integer;
  v_pending boolean;
begin
  select king_id into v_king
    from public.sessions
   where session_id = p_session_id
     and ended_at is null
   for update;

  if not found then
    return;
  end if;

  v_pending := exists (
    select 1
      from public.games
     where session_id = p_session_id
       and status = 'pending'
  );

  select count(*) into v_on
    from public.session_players
   where session_id = p_session_id
     and state = 'on_court';

  if v_pending then
    v_spots := 0;
  elsif v_king is null then
    v_spots := 2 - v_on;
  else
    v_spots := 1 - v_on;
  end if;
  if v_spots < 0 then
    v_spots := 0;
  end if;

  update public.session_players sp
     set here_deadline = case
           when r.n <= v_spots and sp.here_deadline is null
             then now() + interval '2 minutes'
           when r.n <= v_spots then sp.here_deadline
           else null
         end
    from (
      select user_id,
             row_number() over (order by queue_position, user_id) as n
        from public.session_players
       where session_id = p_session_id
         and state = 'waiting'
    ) r
   where sp.session_id = p_session_id
     and sp.user_id = r.user_id
     and sp.state = 'waiting';

  select count(*) into v_waiting
    from public.session_players
   where session_id = p_session_id
     and state = 'waiting';

  if v_king is null and v_on = 0 and v_waiting = 0 then
    update public.sessions
       set ended_at = now()
     where session_id = p_session_id
       and ended_at is null;
  end if;
end;
$$;

-- Apply "I'm here" misses for one locked session. Returns true if anyone missed.
create function public.kotc_expire_locked(p_session_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hit boolean := false;
  r     record;
begin
  for r in
    select user_id, missed_here_count
      from public.session_players
     where session_id = p_session_id
       and state = 'waiting'
       and here_deadline is not null
       and here_deadline < now()
     order by queue_position
     for update
  loop
    v_hit := true;
    if r.missed_here_count >= 1 then
      update public.session_players
         set state = 'left',
             left_reason = 'no_show',
             left_at = now(),
             missed_here_count = missed_here_count + 1,
             here_deadline = null,
             queue_position = null
       where session_id = p_session_id
         and user_id = r.user_id;
    else
      update public.session_players
         set missed_here_count = missed_here_count + 1,
             here_deadline = null,
             queue_position = nextval('public.kotc_queue_position'),
             state = 'waiting'
       where session_id = p_session_id
         and user_id = r.user_id;
    end if;
  end loop;

  return v_hit;
end;
$$;

-- A player is in at most one session. Leave every other running one with
-- left_reason 'switched', then settle and notify those courts. p_except is
-- the session they are starting or joining, and is skipped. Null means leave all.
create function public.kotc_switch_away(p_user_id uuid, p_except bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    bigint;
  v_court bigint;
begin
  for v_id, v_court in
    select s.session_id, s.court_id
      from public.sessions s
     where s.ended_at is null
       and (p_except is null or s.session_id <> p_except)
       and (
         s.king_id = p_user_id
         or exists (
           select 1
             from public.session_players sp
            where sp.session_id = s.session_id
              and sp.user_id = p_user_id
              and sp.state <> 'left'
         )
       )
     order by s.session_id
  loop
    perform public.kotc_leave_member(v_id, p_user_id, 'switched');
    perform public.kotc_settle(v_id);
    perform public.kotc_notify(v_court);
  end loop;
end;
$$;

-- user_id, username, real_name, and elo. Checked-in callers see every player
-- in a session, including someone they have blocked.
create function public.kotc_player_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', user_id,
    'username', username,
    'real_name', real_name,
    'elo', elo
  )
    from public.profiles
   where user_id = p_user_id;
$$;

-- The session object get_court_sessions returns. king is separate from
-- on_court and from queue. queue rows carry here_deadline. pending_result is
-- the open game, and confirm_by is created_at plus 5 minutes. last_event is
-- null except after a dispute.
create function public.kotc_session_json(p_session_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'session_id', s.session_id,
    'court_id', s.court_id,
    'session_number', s.session_number,
    'host_id', s.host_id,
    'host_username', h.username,
    'ranked', s.ranked,
    'started_at', s.started_at,
    'king', case
      when s.king_id is null then null
      else public.kotc_player_json(s.king_id) || jsonb_build_object('streak', s.king_streak)
    end,
    'on_court', coalesce((
      select jsonb_agg(public.kotc_player_json(sp.user_id) order by sp.on_court_at, sp.user_id)
        from public.session_players sp
       where sp.session_id = s.session_id
         and sp.state = 'on_court'
    ), '[]'::jsonb),
    'queue', coalesce((
      select jsonb_agg(
               public.kotc_player_json(sp.user_id) || jsonb_build_object('here_deadline', sp.here_deadline)
               order by sp.queue_position, sp.user_id
             )
        from public.session_players sp
       where sp.session_id = s.session_id
         and sp.state = 'waiting'
    ), '[]'::jsonb),
    'pending_result', (
      select jsonb_build_object(
               'game_id', g.game_id,
               'reported_by', g.reported_by,
               'winner_id', (
                 select gp.user_id
                   from public.game_players gp
                  where gp.game_id = g.game_id
                    and gp.side = g.winning_side
               ),
               'confirm_by', g.created_at + interval '5 minutes'
             )
        from public.games g
       where g.session_id = s.session_id
         and g.status = 'pending'
    ),
    'last_event', case
      when s.last_event_kind is null then null
      else jsonb_build_object('kind', s.last_event_kind, 'at', s.last_event_at)
    end
  )
    from public.sessions s
    left join public.profiles h on h.user_id = s.host_id
   where s.session_id = p_session_id;
$$;

-- Move the line after a session game is confirmed. Elo is already written.
-- pending_king_id null means the crown was vacant: the winner becomes king
-- at streak 1, unless they have left, and the loser goes to the back.
-- The old king winning stays king and the streak goes up by one.
-- The challenger winning sends the old king to the back, then takes the crown
-- at streak 1. A winner who has left leaves the crown vacant. Then settle.
create function public.kotc_after_result(p_game_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game    public.games;
  v_session public.sessions;
  v_winner  uuid;
  v_loser   uuid;
  v_court   bigint;
begin
  select * into v_game
    from public.games
   where game_id = p_game_id
   for update;

  if not found or v_game.session_id is null or v_game.status <> 'confirmed' then
    return;
  end if;

  select * into v_session
    from public.sessions
   where session_id = v_game.session_id
   for update;

  if not found then
    return;
  end if;

  v_court := v_session.court_id;

  select user_id into v_winner
    from public.game_players
   where game_id = p_game_id
     and side = v_game.winning_side;

  select user_id into v_loser
    from public.game_players
   where game_id = p_game_id
     and side <> v_game.winning_side;

  update public.sessions
     set pending_king_id = null,
         last_event_kind = null,
         last_event_at = null
   where session_id = v_session.session_id;

  if v_session.pending_king_id is null then
    if public.kotc_active(v_session.session_id, v_winner) then
      perform public.kotc_make_king(v_session.session_id, v_winner, 1);
    else
      update public.sessions
         set king_id = null,
             king_streak = 0
       where session_id = v_session.session_id;
    end if;
    perform public.kotc_to_back(v_session.session_id, v_loser);
  elsif v_winner = v_session.pending_king_id then
    if public.kotc_active(v_session.session_id, v_winner) then
      perform public.kotc_make_king(
        v_session.session_id, v_winner, v_session.king_streak + 1
      );
    else
      update public.sessions
         set king_id = null,
             king_streak = 0
       where session_id = v_session.session_id;
    end if;
    perform public.kotc_to_back(v_session.session_id, v_loser);
  elsif public.kotc_active(v_session.session_id, v_winner) then
    perform public.kotc_to_back(v_session.session_id, v_session.pending_king_id);
    perform public.kotc_make_king(v_session.session_id, v_winner, 1);
  else
    update public.sessions
       set king_id = null,
           king_streak = 0
     where session_id = v_session.session_id
       and king_id = v_winner;
    perform public.kotc_to_back(v_session.session_id, v_session.pending_king_id);
  end if;

  perform public.kotc_settle(v_session.session_id);
  perform public.kotc_notify(v_court);
end;
$$;

-- Both players go to the back and the crown is vacant. With a king at report
-- time, the challenger is queued first and the king second. With a vacant
-- crown, they keep the order they stepped on court. last_event becomes
-- 'disputed'. Does not write a ranked ban; dispute_result keeps session
-- games out of that count.
create function public.kotc_after_dispute(p_game_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game    public.games;
  v_session public.sessions;
  v_first   uuid;
  v_second  uuid;
begin
  select * into v_game
    from public.games
   where game_id = p_game_id;

  if not found or v_game.session_id is null then
    return;
  end if;

  select * into v_session
    from public.sessions
   where session_id = v_game.session_id
   for update;

  if not found then
    return;
  end if;

  if v_session.pending_king_id is not null then
    select user_id into v_first
      from public.game_players
     where game_id = p_game_id
       and user_id <> v_session.pending_king_id
     limit 1;
    v_second := v_session.pending_king_id;
  else
    select sp.user_id into v_first
      from public.session_players sp
      join public.game_players gp
        on gp.user_id = sp.user_id
       and gp.game_id = p_game_id
     where sp.session_id = v_session.session_id
     order by sp.on_court_at nulls last, sp.user_id
     limit 1;

    select gp.user_id into v_second
      from public.game_players gp
     where gp.game_id = p_game_id
       and gp.user_id is distinct from v_first
     limit 1;
  end if;

  perform public.kotc_to_back(v_session.session_id, v_first);
  perform public.kotc_to_back(v_session.session_id, v_second);

  update public.sessions
     set king_id = null,
         king_streak = 0,
         pending_king_id = null,
         last_event_kind = 'disputed',
         last_event_at = now()
   where session_id = v_session.session_id;

  perform public.kotc_settle(v_session.session_id);
  perform public.kotc_notify(v_session.court_id);
end;
$$;

-- Cron entry point. Lock each running session that has a past here_deadline,
-- skip one another transaction already holds, apply the miss, settle, and
-- notify. Returns how many sessions changed. get_court_sessions does the
-- same per court on read, so a late cron cannot leave a stale call up.
create function public.kotc_expire_here()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session bigint;
  v_court   bigint;
  v_count   integer := 0;
begin
  for v_session, v_court in
    select s.session_id, s.court_id
      from public.sessions s
     where s.ended_at is null
       and exists (
         select 1
           from public.session_players sp
          where sp.session_id = s.session_id
            and sp.state = 'waiting'
            and sp.here_deadline is not null
            and sp.here_deadline < now()
       )
     order by s.session_id
     for update of s skip locked
  loop
    if public.kotc_expire_locked(v_session) then
      perform public.kotc_settle(v_session);
      perform public.kotc_notify(v_court);
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Same as leave, with left_reason 'checked_out', when an open check-in closes.
-- Covers check_out, "Still here? No", and expire_check_ins. The court-count
-- trigger on this table stays; this one only removes the player from a session.
create function public.kotc_on_check_out()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if old.checked_out_at is not null or new.checked_out_at is null then
    return null;
  end if;

  for r in
    select s.session_id, s.court_id
      from public.sessions s
     where s.ended_at is null
       and (
         s.king_id = new.user_id
         or exists (
           select 1
             from public.session_players sp
            where sp.session_id = s.session_id
              and sp.user_id = new.user_id
              and sp.state <> 'left'
         )
       )
     order by s.session_id
     for update
  loop
    perform public.kotc_leave_member(r.session_id, new.user_id, 'checked_out');
    perform public.kotc_settle(r.session_id);
    perform public.kotc_notify(r.court_id);
  end loop;

  return null;
end;
$$;

drop trigger if exists kotc_check_out_trg on public.check_ins;
create trigger kotc_check_out_trg
  after update of checked_out_at on public.check_ins
  for each row
  when (old.checked_out_at is null and new.checked_out_at is not null)
  execute function public.kotc_on_check_out();


-- =========================================================
-- Reads and writes
-- =========================================================
-- Signed-in callers only. Every write locks the session, changes one thing,
-- then kotc_settle and kotc_notify.

-- Running sessions at a court, ordered by session_number. [] when the caller
-- is not checked in there, including when they are signed out. Locks each
-- running session first and applies a missed "I'm here" before building JSON.
create function public.get_court_sessions(p_court_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id      bigint;
  v_changed boolean := false;
  v_json    jsonb;
begin
  if not public.is_checked_in_at(p_court_id) then
    return '[]'::jsonb;
  end if;

  for v_id in
    select s.session_id
      from public.sessions s
     where s.court_id = p_court_id
       and s.ended_at is null
     order by s.session_id
     for update
  loop
    if public.kotc_expire_locked(v_id) then
      perform public.kotc_settle(v_id);
      v_changed := true;
    end if;
  end loop;

  if v_changed then
    perform public.kotc_notify(p_court_id);
  end if;

  select coalesce(
           jsonb_agg(public.kotc_session_json(s.session_id) order by s.session_number),
           '[]'::jsonb
         )
    into v_json
    from public.sessions s
   where s.court_id = p_court_id
     and s.ended_at is null;

  return v_json;
end;
$$;

-- The caller becomes host and king. p_ranked is fixed for the life of the
-- session. Returns session_id. The court row is locked while the lowest free
-- session_number is chosen. Someone already in another session is switched away.
-- 42501 'Not signed in.'  22023 'Court is not available.' 'Not checked in.'
-- 'Ranked play is paused.'
create function public.start_kotc_session(p_court_id bigint, p_ranked boolean)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_status  text;
  v_number  integer;
  v_session bigint;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select status into v_status
    from public.courts
   where court_id = p_court_id
   for update;

  if not found or v_status <> 'active' then
    raise exception 'Court is not available.' using errcode = '22023';
  end if;

  if not public.is_checked_in_at(p_court_id) then
    raise exception 'Not checked in.' using errcode = '22023';
  end if;

  if p_ranked and public.kotc_ranked_paused(v_uid) then
    raise exception 'Ranked play is paused.' using errcode = '22023';
  end if;

  perform public.kotc_lock_player_sessions(v_uid, null);
  perform public.kotc_switch_away(v_uid, null);

  select gs into v_number
    from generate_series(1, 10000) gs
   where not exists (
           select 1
             from public.sessions s
            where s.court_id = p_court_id
              and s.session_number = gs
              and s.ended_at is null
         )
   order by gs
   limit 1;

  insert into public.sessions (
    court_id, session_number, host_id, ranked, king_id, king_streak
  )
  values (p_court_id, v_number, v_uid, p_ranked, v_uid, 0)
  returning session_id into v_session;

  begin
    insert into public.session_players (session_id, user_id, state)
    values (v_session, v_uid, 'king');
  exception
    when unique_violation then
      perform public.kotc_switch_away(v_uid, v_session);
      insert into public.session_players (session_id, user_id, state)
      values (v_session, v_uid, 'king');
  end;

  perform public.kotc_settle(v_session);
  perform public.kotc_notify(p_court_id);
  return v_session;
end;
$$;

-- Put the caller at the back. Joining the session they are already in does
-- nothing. Joining a different one leaves the first with left_reason
-- 'switched'. A left row in this session is reused, and missed_here_count
-- starts over at 0. A unique_violation on the one-active index retries the switch.
-- 42501 'Not signed in.'  22023 'Session not found.' 'Not checked in.'
-- 'Ranked play is paused.'
create function public.join_kotc_session(p_session_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_court  bigint;
  v_ranked boolean;
  v_ended  timestamptz;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select court_id, ranked, ended_at
    into v_court, v_ranked, v_ended
    from public.sessions
   where session_id = p_session_id;

  if not found or v_ended is not null then
    raise exception 'Session not found.' using errcode = '22023';
  end if;

  if not public.is_checked_in_at(v_court) then
    raise exception 'Not checked in.' using errcode = '22023';
  end if;

  if v_ranked and public.kotc_ranked_paused(v_uid) then
    raise exception 'Ranked play is paused.' using errcode = '22023';
  end if;

  perform public.kotc_lock_player_sessions(v_uid, p_session_id);

  select ended_at into v_ended
    from public.sessions
   where session_id = p_session_id;

  if v_ended is not null then
    raise exception 'Session not found.' using errcode = '22023';
  end if;

  if public.kotc_active(p_session_id, v_uid) then
    return;
  end if;

  perform public.kotc_switch_away(v_uid, p_session_id);

  begin
    insert into public.session_players (
      session_id, user_id, state, queue_position, missed_here_count
    )
    values (
      p_session_id,
      v_uid,
      'waiting',
      nextval('public.kotc_queue_position'),
      0
    )
    on conflict (session_id, user_id) do update
      set state = 'waiting',
          queue_position = nextval('public.kotc_queue_position'),
          missed_here_count = 0,
          here_deadline = null,
          on_court_at = null,
          left_at = null,
          left_reason = null,
          joined_at = now();
  exception
    when unique_violation then
      perform public.kotc_switch_away(v_uid, p_session_id);
      insert into public.session_players (
        session_id, user_id, state, queue_position, missed_here_count
      )
      values (
        p_session_id,
        v_uid,
        'waiting',
        nextval('public.kotc_queue_position'),
        0
      )
      on conflict (session_id, user_id) do update
        set state = 'waiting',
            queue_position = nextval('public.kotc_queue_position'),
            missed_here_count = 0,
            here_deadline = null,
            on_court_at = null,
            left_at = null,
            left_reason = null,
            joined_at = now();
  end;

  perform public.kotc_settle(p_session_id);
  perform public.kotc_notify(v_court);
end;
$$;

-- The caller leaves, with left_reason 'left'. The crown is vacated when they
-- held it. kotc_settle ends the session when the king, the court, and the
-- line are all empty.
-- 42501 'Not signed in.'  22023 'Session not found.' 'Not in session.'
create function public.leave_kotc_session(p_session_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_court bigint;
  v_ended timestamptz;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select court_id, ended_at
    into v_court, v_ended
    from public.sessions
   where session_id = p_session_id
   for update;

  if not found or v_ended is not null then
    raise exception 'Session not found.' using errcode = '22023';
  end if;

  if not public.kotc_active(p_session_id, v_uid) then
    raise exception 'Not in session.' using errcode = '22023';
  end if;

  perform public.kotc_leave_member(p_session_id, v_uid, 'left');
  perform public.kotc_settle(p_session_id);
  perform public.kotc_notify(v_court);
end;
$$;

-- Step on court and reset the miss count. The caller must be waiting with a
-- deadline that has not passed. A late tap raises, and the raise rolls back,
-- so the miss is recorded by kotc_expire_here or the next get_court_sessions.
-- 42501 'Not signed in.'  22023 'Session not found.' 'Not up next.'
create function public.confirm_kotc_here(p_session_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_court    bigint;
  v_ended    timestamptz;
  v_state    text;
  v_deadline timestamptz;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select court_id, ended_at
    into v_court, v_ended
    from public.sessions
   where session_id = p_session_id
   for update;

  if not found or v_ended is not null then
    raise exception 'Session not found.' using errcode = '22023';
  end if;

  select state, here_deadline
    into v_state, v_deadline
    from public.session_players
   where session_id = p_session_id
     and user_id = v_uid
   for update;

  -- Raising rolls the call back, so a late tap must not record the miss.
  -- The cron job, or the next read, does that.
  if v_state is distinct from 'waiting' or v_deadline is null or now() > v_deadline then
    raise exception 'Not up next.' using errcode = '22023';
  end if;

  update public.session_players
     set state = 'on_court',
         on_court_at = now(),
         here_deadline = null,
         missed_here_count = 0,
         queue_position = null
   where session_id = p_session_id
     and user_id = v_uid;

  perform public.kotc_settle(p_session_id);
  perform public.kotc_notify(v_court);
end;
$$;

-- Either player on court reports the winner. Returns the new games.game_id.
-- The row is pending even when the session is casual, so the other player
-- still confirms. Side 1 is the king, or the earlier on_court player when the
-- crown is vacant. Side 2 is the other. pending_king_id stores the king at
-- report time, or null when the crown was vacant. The line does not move
-- until confirm or dispute.
-- 42501 'Not signed in.'  22023 'Session not found.' 'Not playing.'
-- 'Winner must be playing.' 'Result already reported.'
create function public.report_kotc_result(p_session_id bigint, p_winner_id uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_court   bigint;
  v_ranked  boolean;
  v_king    uuid;
  v_ended   timestamptz;
  v_on      uuid[];
  v_side_1  uuid;
  v_side_2  uuid;
  v_game_id bigint;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select court_id, ranked, king_id, ended_at
    into v_court, v_ranked, v_king, v_ended
    from public.sessions
   where session_id = p_session_id
   for update;

  if not found or v_ended is not null then
    raise exception 'Session not found.' using errcode = '22023';
  end if;

  select coalesce(array_agg(user_id order by on_court_at, user_id), '{}')
    into v_on
    from public.session_players
   where session_id = p_session_id
     and state = 'on_court';

  if v_king is not null and cardinality(v_on) = 1 then
    v_side_1 := v_king;
    v_side_2 := v_on[1];
  elsif v_king is null and cardinality(v_on) = 2 then
    v_side_1 := v_on[1];
    v_side_2 := v_on[2];
  else
    raise exception 'Not playing.' using errcode = '22023';
  end if;

  if v_uid <> v_side_1 and v_uid <> v_side_2 then
    raise exception 'Not playing.' using errcode = '22023';
  end if;

  if p_winner_id is distinct from v_side_1 and p_winner_id is distinct from v_side_2 then
    raise exception 'Winner must be playing.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.games
     where session_id = p_session_id
       and status = 'pending'
  ) then
    raise exception 'Result already reported.' using errcode = '22023';
  end if;

  insert into public.games (
    court_id, ranked, status, winning_side, reported_by, session_id
  )
  values (
    v_court,
    v_ranked,
    'pending',
    case when p_winner_id = v_side_1 then 1 else 2 end,
    v_uid,
    p_session_id
  )
  returning game_id into v_game_id;

  insert into public.game_players (game_id, user_id, side)
  values (v_game_id, v_side_1, 1),
         (v_game_id, v_side_2, 2);

  update public.sessions
     set pending_king_id = v_king
   where session_id = p_session_id;

  -- A pending result closes the spots, so waiting deadlines clear.
  perform public.kotc_settle(p_session_id);
  perform public.kotc_notify(v_court);
  return v_game_id;
end;
$$;


-- =========================================================
-- Result functions: session games only change the new path
-- =========================================================
-- confirm_result is unchanged. It already keys off game_id. finalize below
-- is what a session game adds after the row becomes confirmed.

-- Same Elo write as before. A 1v1 has a null session_id and stops there.
-- A session game locks that session before the two profiles, then
-- kotc_after_result. A casual session game confirms with no Elo and still
-- moves the line. A casual 1v1 never reaches this function.
create or replace function public.finalize_confirmed_game(p_game_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_game       public.games;
  v_side_1     integer;
  v_side_2     integer;
  v_winner_id  uuid;
  v_loser_id   uuid;
  v_winner_elo integer;
  v_loser_elo  integer;
  v_delta      integer;
begin
  select * into v_game
    from public.games
   where games.game_id = p_game_id
   for update;

  if not found or v_game.status <> 'pending' then
    return;
  end if;

  if v_game.session_id is not null then
    perform 1
      from public.sessions
     where session_id = v_game.session_id
     for update;
  end if;

  select (count(*) filter (where side = 1))::integer,
         (count(*) filter (where side = 2))::integer
    into v_side_1, v_side_2
    from public.game_players
   where game_players.game_id = p_game_id;

  if v_side_1 <> 1 or v_side_2 <> 1 or not v_game.ranked then
    update public.games
       set status = 'confirmed',
           confirmed_at = now()
     where games.game_id = p_game_id;

    if v_game.session_id is not null then
      perform public.kotc_after_result(p_game_id);
    end if;
    return;
  end if;

  select user_id into v_winner_id
    from public.game_players
   where game_players.game_id = p_game_id
     and side = v_game.winning_side;

  select user_id into v_loser_id
    from public.game_players
   where game_players.game_id = p_game_id
     and side <> v_game.winning_side;

  perform 1
    from public.profiles
   where user_id in (v_winner_id, v_loser_id)
   order by user_id
   for update;

  select elo into v_winner_elo
    from public.profiles
   where user_id = v_winner_id;

  select elo into v_loser_elo
    from public.profiles
   where user_id = v_loser_id;

  v_delta := public.elo_delta(v_winner_elo, v_loser_elo);

  update public.profiles
     set elo = elo + v_delta
   where user_id = v_winner_id;

  update public.profiles
     set elo = elo - v_delta
   where user_id = v_loser_id;

  insert into public.elo_history (user_id, game_id, elo_before, elo_after)
  values (v_winner_id, p_game_id, v_winner_elo, v_winner_elo + v_delta),
         (v_loser_id, p_game_id, v_loser_elo, v_loser_elo - v_delta);

  update public.games
     set status = 'confirmed',
         confirmed_at = now()
   where games.game_id = p_game_id;

  if v_game.session_id is not null then
    perform public.kotc_after_result(p_game_id);
  end if;
end;
$$;

-- Same void as before. The ban count only includes voided games whose
-- session_id is null, so a King of the Court dispute does not count toward
-- five in a month. A session game then runs kotc_after_dispute. A 1v1
-- dispute still counts.
create or replace function public.dispute_result(p_game_id bigint)
returns public.games
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_game public.games;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_game_id is null then
    raise exception 'Game is required.' using errcode = '22023';
  end if;

  select * into v_game
    from public.games
   where games.game_id = p_game_id
   for update;

  if not found
     or not exists (
       select 1 from public.game_players
        where game_players.game_id = p_game_id
          and game_players.user_id = v_uid
     )
  then
    raise exception 'Game not found.' using errcode = '22023';
  end if;

  if v_game.reported_by = v_uid then
    raise exception 'The other player confirms this result.' using errcode = '22023';
  end if;

  if v_game.status <> 'pending' then
    raise exception 'Result is not waiting for confirmation.' using errcode = '22023';
  end if;

  if v_game.session_id is not null then
    perform 1
      from public.sessions
     where session_id = v_game.session_id
     for update;
  end if;

  update public.games
     set status = 'voided',
         disputed_at = now()
   where games.game_id = p_game_id
  returning * into v_game;

  perform 1
    from public.profiles
   where profiles.user_id in (
           select gp.user_id
             from public.game_players gp
            where gp.game_id = p_game_id
         )
   order by profiles.user_id
   for update;

  -- King of the Court disputes stay out of the 1v1 warning count.
  update public.profiles p
     set ranked_banned_until = greatest(
           coalesce(p.ranked_banned_until, now()),
           now() + interval '7 days'
         )
   where p.user_id in (
           select gp.user_id
             from public.game_players gp
            where gp.game_id = p_game_id
         )
     and (
           select count(*)
             from public.game_players gp
             join public.games g on g.game_id = gp.game_id
            where gp.user_id = p.user_id
              and g.status = 'voided'
              and g.disputed_at > now() - interval '1 month'
              and g.session_id is null
         ) >= 5;

  if v_game.session_id is not null then
    perform public.kotc_after_dispute(p_game_id);
  end if;

  return v_game;
end;
$$;

-- The same five-minute job as before. A 1v1 confirms 24 hours after it was
-- reported. A session game confirms after 5 minutes. The run after the window
-- is what confirms it, so a session result can land a few minutes late.
create or replace function public.auto_confirm_results()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_game_id bigint;
  v_count   integer := 0;
begin
  for v_game_id in
    select games.game_id
      from public.games
     where games.status = 'pending'
       and (
         (games.session_id is null and games.created_at <= now() - interval '24 hours')
         or
         (games.session_id is not null and games.created_at <= now() - interval '5 minutes')
       )
     order by games.game_id
     for update skip locked
  loop
    perform public.finalize_confirmed_game(v_game_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


-- =========================================================
-- Who you can see, and the public session counts
-- =========================================================
-- Return type changes, so the old functions have to be dropped first.
-- The old grants do not survive a drop. They are re-granted at the bottom.

-- Who the caller can see at a court. Empty unless they are checked in there.
-- Adds real_name. Returns the caller, King of the Court participants at that
-- court, and the caller's confirmed 1v1 opponent whose match at that court
-- has not ended. A block in either direction still hides the other person.
-- Everyone else is only a count, from nearby_courts and get_court.
drop function public.get_court_players(bigint);

create function public.get_court_players(p_court_id bigint)
returns table (
  user_id uuid,
  username text,
  real_name text,
  elo integer,
  checked_in_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select p.user_id, p.username, p.real_name, p.elo, ci.checked_in_at
    from public.check_ins ci
    join public.profiles p on p.user_id = ci.user_id
   where ci.court_id = p_court_id
     and ci.checked_out_at is null
     and ci.expires_at > now()
     and public.is_checked_in_at(p_court_id)
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = (select auth.uid()) and b.blocked_id = ci.user_id)
           or (b.blocker_id = ci.user_id and b.blocked_id = (select auth.uid()))
     )
     and (
       ci.user_id = (select auth.uid())
       or exists (
         select 1
           from public.sessions s
          where s.court_id = p_court_id
            and s.ended_at is null
            and (
              s.king_id = ci.user_id
              or exists (
                select 1
                  from public.session_players sp
                 where sp.session_id = s.session_id
                   and sp.user_id = ci.user_id
                   and sp.state <> 'left'
              )
            )
       )
       or exists (
         select 1
           from public.challenges ch
          where ch.court_id = p_court_id
            and ch.status = 'confirmed'
            and now() < ch.starts_at + make_interval(mins => ch.duration_minutes)
            and (
              (ch.challenger_id = (select auth.uid()) and ch.opponent_id = ci.user_id)
              or
              (ch.opponent_id = (select auth.uid()) and ch.challenger_id = ci.user_id)
            )
       )
     )
   order by ci.checked_in_at;
$$;

-- Same nearby rows as before, plus session_live (a session is still running)
-- and kotc_waiting (players in state 'waiting', with no names). Callable
-- without an account. 'Location is invalid.' is 22023.
drop function public.nearby_courts(double precision, double precision, integer, integer);

create function public.nearby_courts(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 5000,
  p_limit integer default 10
) returns table (
  court_id bigint,
  name text,
  latitude double precision,
  longitude double precision,
  status text,
  player_count integer,
  avg_elo integer,
  distance_m double precision,
  session_live boolean,
  kotc_waiting integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_point extensions.geography;
begin
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Location is invalid.' using errcode = '22023';
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  return query
  select c.court_id,
         c.name,
         extensions.st_y(c.location::extensions.geometry),
         extensions.st_x(c.location::extensions.geometry),
         c.status,
         coalesce(a.n, 0)::int,
         case when coalesce(a.n, 0) >= 2 then round(a.avg_elo)::int end,
         extensions.st_distance(c.location, v_point),
         coalesce(k.live_n, 0) > 0,
         coalesce(k.waiting, 0)::int
    from public.courts c
    left join lateral (
      select count(*) as n, avg(p.elo) as avg_elo
        from public.check_ins ci
        join public.profiles p on p.user_id = ci.user_id
       where ci.court_id = c.court_id
         and ci.checked_out_at is null
         and ci.expires_at > now()
    ) a on true
    left join lateral (
      select count(distinct s.session_id) as live_n,
             count(sp.user_id) as waiting
        from public.sessions s
        left join public.session_players sp
          on sp.session_id = s.session_id
         and sp.state = 'waiting'
       where s.court_id = c.court_id
         and s.ended_at is null
    ) k on true
   where extensions.st_dwithin(c.location, v_point, least(greatest(p_radius_m, 1), 50000))
   order by extensions.st_distance(c.location, v_point)
   limit least(greatest(p_limit, 1), 200);
end;
$$;

-- Same court row as before, plus session_live and kotc_waiting. The waiting
-- count has no names. Callable without an account. 'Court not found.' is 22023.
drop function public.get_court(bigint);

create function public.get_court(p_court_id bigint)
returns table (
  court_id bigint,
  name text,
  latitude double precision,
  longitude double precision,
  status text,
  player_count integer,
  avg_elo integer,
  lit boolean,
  indoor boolean,
  hoop_count integer,
  net boolean,
  double_rim boolean,
  surface text,
  session_live boolean,
  kotc_waiting integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  return query
  select c.court_id,
         c.name,
         extensions.st_y(c.location::extensions.geometry),
         extensions.st_x(c.location::extensions.geometry),
         c.status,
         coalesce(a.n, 0)::int,
         case when coalesce(a.n, 0) >= 2 then round(a.avg_elo)::int end,
         c.lit, c.indoor, c.hoop_count, c.net, c.double_rim, c.surface,
         coalesce(k.live_n, 0) > 0,
         coalesce(k.waiting, 0)::int
    from public.courts c
    left join lateral (
      select count(*) as n, avg(p.elo) as avg_elo
        from public.check_ins ci
        join public.profiles p on p.user_id = ci.user_id
       where ci.court_id = c.court_id
         and ci.checked_out_at is null
         and ci.expires_at > now()
    ) a on true
    left join lateral (
      select count(distinct s.session_id) as live_n,
             count(sp.user_id) as waiting
        from public.sessions s
        left join public.session_players sp
          on sp.session_id = s.session_id
         and sp.state = 'waiting'
       where s.court_id = c.court_id
         and s.ended_at is null
    ) k on true
   where c.court_id = p_court_id;

  if not found then
    raise exception 'Court not found.' using errcode = '22023';
  end if;
end;
$$;


-- =========================================================
-- Grants
-- =========================================================
-- Helpers, the Elo write, the sweep, and the checkout trigger function are
-- not callable. The six session functions, get_court_players, and
-- dispute_result require a signed-in player. nearby_courts and get_court
-- stay open to anon as well as authenticated. confirm_result's grant is
-- unchanged from the migration that created it.

revoke all on function public.kotc_ranked_paused(uuid) from public, anon, authenticated;
revoke all on function public.kotc_active(bigint, uuid) from public, anon, authenticated;
revoke all on function public.kotc_notify(bigint) from public, anon, authenticated;
revoke all on function public.kotc_lock_player_sessions(uuid, bigint) from public, anon, authenticated;
revoke all on function public.kotc_leave_member(bigint, uuid, text) from public, anon, authenticated;
revoke all on function public.kotc_to_back(bigint, uuid) from public, anon, authenticated;
revoke all on function public.kotc_make_king(bigint, uuid, integer) from public, anon, authenticated;
revoke all on function public.kotc_settle(bigint) from public, anon, authenticated;
revoke all on function public.kotc_expire_locked(bigint) from public, anon, authenticated;
revoke all on function public.kotc_switch_away(uuid, bigint) from public, anon, authenticated;
revoke all on function public.kotc_player_json(uuid) from public, anon, authenticated;
revoke all on function public.kotc_session_json(bigint) from public, anon, authenticated;
revoke all on function public.kotc_after_result(bigint) from public, anon, authenticated;
revoke all on function public.kotc_after_dispute(bigint) from public, anon, authenticated;
revoke all on function public.kotc_expire_here() from public, anon, authenticated;
revoke all on function public.kotc_on_check_out() from public, anon, authenticated;
revoke all on function public.finalize_confirmed_game(bigint) from public, anon, authenticated;
revoke all on function public.auto_confirm_results() from public, anon, authenticated;

revoke execute on function public.get_court_sessions(bigint) from public, anon;
revoke execute on function public.start_kotc_session(bigint, boolean) from public, anon;
revoke execute on function public.join_kotc_session(bigint) from public, anon;
revoke execute on function public.leave_kotc_session(bigint) from public, anon;
revoke execute on function public.confirm_kotc_here(bigint) from public, anon;
revoke execute on function public.report_kotc_result(bigint, uuid) from public, anon;
revoke execute on function public.get_court_players(bigint) from public, anon;
revoke execute on function public.nearby_courts(double precision, double precision, integer, integer) from public, anon;
revoke execute on function public.get_court(bigint) from public, anon;
revoke execute on function public.dispute_result(bigint) from public, anon;

grant execute on function public.get_court_sessions(bigint) to authenticated;
grant execute on function public.start_kotc_session(bigint, boolean) to authenticated;
grant execute on function public.join_kotc_session(bigint) to authenticated;
grant execute on function public.leave_kotc_session(bigint) to authenticated;
grant execute on function public.confirm_kotc_here(bigint) to authenticated;
grant execute on function public.report_kotc_result(bigint, uuid) to authenticated;
grant execute on function public.get_court_players(bigint) to authenticated;
grant execute on function public.nearby_courts(double precision, double precision, integer, integer) to anon, authenticated;
grant execute on function public.get_court(bigint) to anon, authenticated;
grant execute on function public.dispute_result(bigint) to authenticated;

-- Checked-in players can hear the court. No insert policy, so clients cannot send.
drop policy if exists "Checked-in players read KOTC updates" on realtime.messages;
create policy "Checked-in players read KOTC updates" on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and realtime.topic() like 'kotc:%'
    and public.is_checked_in_at(split_part(realtime.topic(), ':', 2)::bigint)
  );

-- 15 seconds when pg_cron accepts it. Otherwise every minute. Reads also
-- apply a missed "I'm here" so a minute schedule cannot leave a stale deadline.
do $cron$
begin
  begin
    perform cron.schedule(
      'kotc-expire-here',
      '15 seconds',
      'select public.kotc_expire_here()'
    );
  exception
    when others then
      perform cron.schedule(
        'kotc-expire-here',
        '* * * * *',
        'select public.kotc_expire_here()'
      );
  end;
end
$cron$;
