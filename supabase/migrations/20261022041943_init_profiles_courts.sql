-- =========================================================
-- Extensions
-- =========================================================
-- Supabase convention: install extensions into the "extensions" schema.
create extension if not exists postgis with schema extensions;


-- =========================================================
-- profiles
-- =========================================================
create table public.profiles (
  -- Deleting the auth user deletes their profile (no orphaned profiles).
  user_id            uuid primary key references auth.users (id) on delete cascade,
  -- 3–16 chars; letters, digits, underscore only.
  -- NULL until set during onboarding; the app sends users without one to the handle screen.
  username           text
                     constraint username_format check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  elo                integer not null default 1200,
  open_to_challenges boolean not null default true,
  created_at         timestamptz not null default now()
);

-- Case-insensitive usernames; they're stored the way the user typed it 
-- but there can't be "John" and "john"
create unique index profiles_username_lower_unique on public.profiles (lower(username));

-- RLS on profiles
alter table public.profiles enable row level security;

-- Any signed-in user can view profiles (needed to find opponents / see ratings).
-- TODO (migration 2): once the blocks table exists, exclude profiles that have
-- blocked the viewer (or that the viewer blocked) from this policy.
create policy "Profiles are readable by signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

-- No insert policy: profile rows are created by the on_auth_user_created trigger below.

-- A user can update only their own profile row.
create policy "Users can update only their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- *** PROTECTS ELO FROM BEING EDITED BY USERS
-- RLS controls rows, not columns. Without this, a user could set their own elo.
-- Clients may only write these columns; elo is changed only by security definer functions like confirm_result.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, open_to_challenges) on public.profiles to authenticated;

-- Create an empty profile whenever a new auth user signs up.
-- security definer: runs as the function owner, since the signing-up user can't insert.
-- search_path = '': forces fully qualified names so nobody can hijack lookups.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =========================================================
-- courts
-- =========================================================
create table public.courts (
  court_id        bigint generated always as identity primary key,
  name            text not null,
  -- PostGIS points are (longitude, latitude).
  location        extensions.geography(Point, 4326) not null,
  -- TODO: multi-court locations. If a row represents a location (e.g. the IMA),
  -- add court_count so it can host more than one session at a time.
  -- Features: NULL means unknown (the source didn't say).
  lit             boolean,
  indoor          boolean,
  hoop_count      integer
                  constraint courts_hoop_count_check check (hoop_count > 0),
  net             boolean,
  double_rim      boolean,
  surface         text
                  constraint courts_surface_check check (surface in ('asphalt', 'concrete', 'sport_court', 'wood', 'other')),
  status          text not null default 'active'
                  constraint courts_status_check check (status in ('active', 'closed', 'unverified')),
  -- Where the row came from ('osm', 'seattle_parks', 'manual') and its id in that source.
  source          text not null,
  source_ref      text not null,
  -- True once a human has edited the row, so an import won't overwrite it.
  manually_edited boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint courts_source_unique unique (source, source_ref),
  constraint courts_source_check check (source in ('osm', 'seattle_parks', 'manual'))
);

create index courts_location_gist on public.courts using gist (location);
alter table public.courts enable row level security;

-- The map is public: logged-out visitors (anon) can browse courts too.
-- No insert/update/delete policies, so only the service role can write.
create policy "Courts are readable by everyone"
  on public.courts for select
  to anon, authenticated
  using (true);
