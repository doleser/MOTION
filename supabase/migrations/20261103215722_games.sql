-- =========================================================
-- games
-- =========================================================
-- One row per played game. The row is created when a result is reported, so the winner
-- is always known; it stays 'pending' until the other side confirms. A disputed result
-- becomes 'voided' and keeps its row: games are never deleted.
-- A player's W/L, streak, and recent form are computed from these rows (player_record),
-- never stored on profiles.
-- TODO: add session_id (KOC) and challenge_id (UNIQUE) with foreign keys once the
-- sessions and challenges tables exist.
create table public.games (
  game_id      bigint generated always as identity primary key,
  -- Same rule as check_ins: a court with games is closed, not deleted.
  court_id     bigint not null references public.courts (court_id) on delete restrict,
  -- Casual games are stored but don't count toward a player's record.
  ranked       boolean not null,
  status       text not null default 'pending'
               constraint games_status_check check (status in ('pending', 'confirmed', 'voided')),
  -- Compare with game_players.side: the players on this side won.
  winning_side smallint not null
               constraint games_winning_side_check check (winning_side in (1, 2)),
  -- Nullable only so a deleted account leaves the game in place.
  reported_by  uuid references public.profiles (user_id) on delete set null,
  -- When the result was reported.
  created_at   timestamptz not null default now(),
  -- When the other side confirmed. Orders a player's history.
  confirmed_at timestamptz,
  constraint games_confirmed_at_check check (status <> 'confirmed' or confirmed_at is not null),
  constraint games_confirmed_after_created_check check (confirmed_at >= created_at)
);


-- =========================================================
-- game_players
-- =========================================================
-- Who played in each game and on which side. A side column covers 1v1 now and team
-- games later; Elo stays per player.
create table public.game_players (
  game_id bigint not null references public.games (game_id) on delete cascade,
  -- Deleting an account removes the player from their games. The opponent's row stays,
  -- so the opponent's record doesn't change.
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  side    smallint not null
          constraint game_players_side_check check (side in (1, 2)),
  primary key (game_id, user_id)
);

-- A player's games (player_record, match history). The primary key starts with
-- game_id, so it can't serve this lookup.
create index game_players_user_id_idx on public.game_players (user_id);


-- =========================================================
-- elo_history
-- =========================================================
-- Each rating change and the game that caused it. confirm_result writes this row and
-- profiles.elo in one transaction.
-- TODO: add session_id once the sessions table exists (a KOC change points to its session).
create table public.elo_history (
  history_id bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (user_id) on delete cascade,
  -- NULL for a change that isn't from a single game.
  game_id    bigint references public.games (game_id) on delete restrict,
  elo_before integer not null,
  elo_after  integer not null,
  created_at timestamptz not null default now(),
  -- At most one Elo change per player for a game. NULLs are distinct, so changes that
  -- aren't from a game aren't limited. Also serves a player's own history lookup.
  constraint elo_history_user_game_unique unique (user_id, game_id)
);


-- =========================================================
-- No client writes
-- =========================================================
-- Rows are written only by the security definer result functions (report and confirm).
revoke insert, update, delete on public.games        from anon, authenticated;
revoke insert, update, delete on public.game_players from anon, authenticated;
revoke insert, update, delete on public.elo_history  from anon, authenticated;


-- =========================================================
-- played_in
-- =========================================================
-- True if the caller played in the game. The game_players policy below uses it: a policy
-- that queries its own table fails with "infinite recursion detected in policy", but a
-- security definer function reads the table without RLS (same as is_checked_in_at).
create function public.played_in(p_game_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_players
     where game_id = p_game_id
       and user_id = (select auth.uid())
  );
$$;

-- The policies run as the caller, so signed-in users need execute.
revoke execute on function public.played_in(bigint) from public, anon;
grant execute on function public.played_in(bigint) to authenticated;


-- =========================================================
-- RLS
-- =========================================================
-- A player sees the games they played in, with both sides' game_players rows, and their
-- own Elo changes. Another player's record is available only as totals (player_record).
-- No anon policies, so signed-out visitors see no rows.
-- TODO: once the blocks table exists, decide whether a block hides shared games.
alter table public.games        enable row level security;
alter table public.game_players enable row level security;
alter table public.elo_history  enable row level security;

create policy "Players see the games they played in"
  on public.games for select
  to authenticated
  using (public.played_in(game_id));

create policy "Players see everyone in the games they played in"
  on public.game_players for select
  to authenticated
  using (public.played_in(game_id));

create policy "Players see their own Elo history"
  on public.elo_history for select
  to authenticated
  using ((select auth.uid()) = user_id);


-- =========================================================
-- player_record
-- =========================================================
-- What the Player Profile screen shows under the Elo: wins, losses, streak, and recent
-- form. Counts confirmed ranked games only; pending, voided, and casual games don't count.
-- streak is signed: 2 means W2, -3 means L3, 0 means no games.
-- recent is the last 5 results as 'W'/'L', oldest first (the screen's left-to-right order).
-- The client computes win rate as wins / (wins + losses).
-- security definer because RLS hides other players' games. It returns totals only,
-- never opponents, courts, or dates. Any signed-in user can see any player's record,
-- the same as profiles.elo.
create function public.player_record(p_user_id uuid)
returns table (
  wins    integer,
  losses  integer,
  streak  integer,
  recent  text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  -- rn = 1 is the newest game. Uses game_players_user_id_idx.
  with results as (
    select g.winning_side = gp.side as won,
           row_number() over (order by g.confirmed_at desc, g.game_id desc) as rn
      from public.game_players gp
      join public.games g on g.game_id = gp.game_id
     where gp.user_id = p_user_id
       and g.status = 'confirmed'
       and g.ranked
  ),
  newest as (
    select won from results where rn = 1
  )
  select
    (select count(*) from results where won)::integer,
    (select count(*) from results where not won)::integer,
    -- The streak is the run of games before the first result unlike the newest one,
    -- or every game if they all match.
    coalesce(
      (select case when n.won then 1 else -1 end
              * coalesce((select min(r.rn) - 1 from results r where r.won <> n.won),
                         (select count(*) from results))
         from newest n),
      0)::integer,
    coalesce(
      (select array_agg(case when won then 'W' else 'L' end order by rn desc)
         from results
        where rn <= 5),
      '{}');
$$;

revoke execute on function public.player_record(uuid) from public, anon;
grant execute on function public.player_record(uuid) to authenticated;
