-- =========================================================
-- check_in and check_out
-- =========================================================
-- The only writers of check_ins. A check-in stores the court and the time, never
-- the coordinate that was sent. confirm_still_here is separate and not defined here.
-- Clients cannot insert or update the table; both functions are security definer.

create function public.check_in(p_court_id bigint, p_lat double precision, p_lng double precision)
returns public.check_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_open_id bigint;
  v_expires timestamptz;
  v_row     public.check_ins;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_court_id is null or p_lat is null or p_lng is null then
    raise exception 'Court and location are required.' using errcode = '22023';
  end if;

  -- Missing and closed (or unverified) courts are the same answer: not available.
  if not exists (
    select 1 from public.courts
     where court_id = p_court_id
       and status = 'active'
  ) then
    raise exception 'Court is not available.' using errcode = '22023';
  end if;

  -- 150 m is inclusive. st_dwithin uses courts_location_gist.
  if not exists (
    select 1 from public.courts c
     where c.court_id = p_court_id
       and extensions.st_dwithin(
             c.location,
             extensions.st_point(p_lng, p_lat)::extensions.geography,
             150)
  ) then
    raise exception 'Too far from the court.' using errcode = '22023';
  end if;

  -- One open row per user. The unique index ignores expiry, so an expired row
  -- that was never checked out has to be closed before the insert below.
  select check_in_id, expires_at
    into v_open_id, v_expires
    from public.check_ins
   where user_id = v_uid
     and checked_out_at is null
     for update;

  if found then
    if v_expires > now() then
      raise exception 'Already checked in.' using errcode = '22023';
    end if;
    update public.check_ins
       set checked_out_at = expires_at
     where check_in_id = v_open_id;
  end if;

  insert into public.check_ins (user_id, court_id)
  values (v_uid, p_court_id)
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'Already checked in.' using errcode = '22023';
end;
$$;

revoke execute on function public.check_in(bigint, double precision, double precision)
  from public, anon;
grant execute on function public.check_in(bigint, double precision, double precision)
  to authenticated;


-- =========================================================
-- check_out
-- =========================================================
-- Closes the caller's open check-in, including one that has already expired.
create function public.check_out()
returns public.check_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.check_ins;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  update public.check_ins
     set checked_out_at = now()
   where user_id = v_uid
     and checked_out_at is null
  returning * into v_row;

  if not found then
    raise exception 'Not checked in.' using errcode = '22023';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.check_out() from public, anon;
grant execute on function public.check_out() to authenticated;
