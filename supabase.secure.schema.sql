-- Run this file in Supabase SQL Editor for the real shared version.
-- Only authenticated trip members can read or write room data.

create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  date_range text,
  center jsonb not null default '[31.2304, 121.4737]'::jsonb,
  invite_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  color text not null default '#0F766E',
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  address text,
  lat numeric not null,
  lng numeric not null,
  category text not null,
  note text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_wants (
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.route_plans (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null default '默认路线',
  place_ids uuid[] not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (trip_id)
);

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_app_admin(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.app_admins
    where user_id = target_user_id
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_app_admin(auth.uid());
$$;

create or replace function public.is_trip_member(target_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = target_trip_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_owner(target_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = target_trip_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.create_trip_room(
  p_name text,
  p_city text,
  p_date_range text default null,
  p_center jsonb default '[31.2304, 121.4737]'::jsonb,
  p_invite_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_trip_id uuid;
  invite text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  invite := coalesce(nullif(trim(p_invite_code), ''), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)));

  insert into public.trips (name, city, date_range, center, invite_code, owner_id)
  values (
    coalesce(nullif(trim(p_name), ''), '新的旅行'),
    coalesce(nullif(trim(p_city), ''), '旅行'),
    coalesce(nullif(trim(p_date_range), ''), '待定'),
    p_center,
    invite,
    auth.uid()
  )
  returning id into new_trip_id;

  insert into public.trip_members (trip_id, user_id, display_name, color, role)
  values (
    new_trip_id,
    auth.uid(),
    split_part(coalesce(auth.jwt() ->> 'email', '用户'), '@', 1),
    '#0F766E',
    'owner'
  );

  insert into public.route_plans (trip_id, name, place_ids, updated_by)
  values (new_trip_id, '默认路线', '{}', auth.uid());

  return new_trip_id;
end;
$$;

create or replace function public.join_trip_by_invite(
  p_invite_code text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_trip_id uuid;
  palette text[] := array['#0F766E', '#2563EB', '#D97706', '#7C3AED', '#BE123C', '#15803D'];
  chosen_color text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select id into target_trip_id
  from public.trips
  where upper(invite_code) = upper(trim(p_invite_code));

  if target_trip_id is null then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  chosen_color := palette[1 + floor(random() * array_length(palette, 1))::int];

  insert into public.trip_members (trip_id, user_id, display_name, color, role)
  values (
    target_trip_id,
    auth.uid(),
    coalesce(nullif(trim(p_display_name), ''), split_part(coalesce(auth.jwt() ->> 'email', '朋友'), '@', 1)),
    chosen_color,
    'member'
  )
  on conflict (trip_id, user_id) do update
  set display_name = excluded.display_name;

  return target_trip_id;
end;
$$;

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.places enable row level security;
alter table public.place_wants enable row level security;
alter table public.comments enable row level security;
alter table public.route_plans enable row level security;
alter table public.app_admins enable row level security;

drop policy if exists "members can read trips" on public.trips;
drop policy if exists "users can create owned trips" on public.trips;
drop policy if exists "owners can update trips" on public.trips;
create policy "members can read trips" on public.trips for select using (public.is_trip_member(id));
create policy "users can create owned trips" on public.trips for insert with check (auth.uid() = owner_id);
create policy "owners can update trips" on public.trips for update using (public.is_trip_owner(id)) with check (public.is_trip_owner(id));

drop policy if exists "members can read membership" on public.trip_members;
drop policy if exists "owners can add members" on public.trip_members;
drop policy if exists "users can add self as owner after creating trip" on public.trip_members;
drop policy if exists "members can update own profile" on public.trip_members;
create policy "members can read membership" on public.trip_members for select using (public.is_trip_member(trip_id));
create policy "owners can add members" on public.trip_members for insert with check (public.is_trip_owner(trip_id));
create policy "users can add self as owner after creating trip" on public.trip_members for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (select 1 from public.trips where id = trip_id and owner_id = auth.uid())
  );
create policy "members can update own profile" on public.trip_members for update
  using (user_id = auth.uid() and public.is_trip_member(trip_id))
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "members can read places" on public.places;
drop policy if exists "members can create places" on public.places;
drop policy if exists "members can update own places" on public.places;
drop policy if exists "members can delete own places" on public.places;
drop policy if exists "admins can delete member places" on public.places;
create policy "members can read places" on public.places for select using (public.is_trip_member(trip_id));
create policy "members can create places" on public.places for insert with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "members can update own places" on public.places for update
  using (public.is_trip_member(trip_id) and created_by = auth.uid())
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "members can delete own places" on public.places for delete
  using (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "admins can delete member places" on public.places for delete
  using (public.is_trip_member(trip_id) and public.is_app_admin(auth.uid()));

drop policy if exists "members can read wants" on public.place_wants;
drop policy if exists "members can want places" on public.place_wants;
drop policy if exists "members can remove own wants" on public.place_wants;
create policy "members can read wants" on public.place_wants for select
  using (exists (select 1 from public.places where id = place_id and public.is_trip_member(trip_id)));
create policy "members can want places" on public.place_wants for insert
  with check (user_id = auth.uid() and exists (select 1 from public.places where id = place_id and public.is_trip_member(trip_id)));
create policy "members can remove own wants" on public.place_wants for delete using (user_id = auth.uid());

drop policy if exists "members can read comments" on public.comments;
drop policy if exists "members can create comments" on public.comments;
create policy "members can read comments" on public.comments for select using (public.is_trip_member(trip_id));
create policy "members can create comments" on public.comments for insert with check (public.is_trip_member(trip_id) and user_id = auth.uid());

drop policy if exists "members can read routes" on public.route_plans;
drop policy if exists "members can create routes" on public.route_plans;
drop policy if exists "members can update routes" on public.route_plans;
create policy "members can read routes" on public.route_plans for select using (public.is_trip_member(trip_id));
create policy "members can create routes" on public.route_plans for insert with check (public.is_trip_member(trip_id));
create policy "members can update routes" on public.route_plans for update using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
