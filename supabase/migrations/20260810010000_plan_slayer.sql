-- PlanSlayer tables (same Supabase project as Hunt/Reg — shared auth)
-- Safe to apply: new tables only; does not alter hunt map tables.

create table if not exists public.plan_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  event_type text not null default 'general',
  start_at timestamptz,
  end_at timestamptz,
  location_label text,
  lat double precision,
  lng double precision,
  invite_code text unique,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plan_events_owner_idx on public.plan_events (owner_user_id);
create index if not exists plan_events_start_idx on public.plan_events (start_at);
create index if not exists plan_events_type_idx on public.plan_events (event_type);

create table if not exists public.plan_event_members (
  event_id uuid not null references public.plan_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- owner | member
  arrow_color text default '#e11d1d',
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists plan_event_members_user_idx on public.plan_event_members (user_id);

create table if not exists public.plan_saved_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  event_type text,
  list_kind text not null, -- todo | buy | bring
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_personal_boards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Member check helper
create or replace function public.is_plan_event_member(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plan_event_members m
    where m.event_id = p_event_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.create_plan_event(
  p_name text,
  p_event_type text default 'general',
  p_start_at timestamptz default null
)
returns public.plan_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_row public.plan_events;
  v_try int := 0;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  loop
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    begin
      insert into public.plan_events (owner_user_id, name, event_type, start_at, invite_code, state)
      values (
        v_uid,
        coalesce(nullif(trim(p_name), ''), 'Untitled event'),
        coalesce(nullif(trim(p_event_type), ''), 'general'),
        p_start_at,
        v_code,
        jsonb_build_object(
          'lists', jsonb_build_object(
            'todo', jsonb_build_object('group', '[]'::jsonb, 'personal', '{}'::jsonb),
            'buy', jsonb_build_object('group', '[]'::jsonb, 'personal', '{}'::jsonb),
            'bring', jsonb_build_object('group', '[]'::jsonb, 'personal', '{}'::jsonb)
          ),
          'expenses', '[]'::jsonb
        )
      )
      returning * into v_row;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 20 then raise exception 'Could not allocate invite code'; end if;
    end;
  end loop;
  insert into public.plan_event_members (event_id, user_id, role, arrow_color)
  values (v_row.id, v_uid, 'owner', '#e11d1d');
  return v_row;
end;
$$;

create or replace function public.join_plan_event(p_code text)
returns public.plan_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.plan_events;
  v_code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if length(v_code) <> 6 then raise exception 'Invalid code'; end if;
  select * into v_row from public.plan_events where invite_code = v_code;
  if v_row.id is null then raise exception 'Event not found'; end if;
  insert into public.plan_event_members (event_id, user_id, role)
  values (v_row.id, v_uid, 'member')
  on conflict (event_id, user_id) do nothing;
  return v_row;
end;
$$;

create or replace function public.list_my_plan_events()
returns setof public.plan_events
language sql
stable
security definer
set search_path = public
as $$
  select e.*
  from public.plan_events e
  where e.owner_user_id = auth.uid()
     or exists (
       select 1 from public.plan_event_members m
       where m.event_id = e.id and m.user_id = auth.uid()
     )
  order by e.start_at nulls last, e.updated_at desc;
$$;

grant select, insert, update, delete on public.plan_events to authenticated;
grant select, insert, update, delete on public.plan_event_members to authenticated;
grant select, insert, update, delete on public.plan_saved_lists to authenticated;
grant select, insert, update, delete on public.plan_personal_boards to authenticated;
grant execute on function public.is_plan_event_member(uuid) to authenticated;
grant execute on function public.create_plan_event(text, text, timestamptz) to authenticated;
grant execute on function public.join_plan_event(text) to authenticated;
grant execute on function public.list_my_plan_events() to authenticated;

alter table public.plan_events enable row level security;
alter table public.plan_event_members enable row level security;
alter table public.plan_saved_lists enable row level security;
alter table public.plan_personal_boards enable row level security;

drop policy if exists plan_events_member_select on public.plan_events;
create policy plan_events_member_select on public.plan_events
  for select to authenticated
  using (public.is_plan_event_member(id) or owner_user_id = auth.uid());

drop policy if exists plan_events_member_update on public.plan_events;
create policy plan_events_member_update on public.plan_events
  for update to authenticated
  using (public.is_plan_event_member(id))
  with check (public.is_plan_event_member(id));

drop policy if exists plan_events_owner_insert on public.plan_events;
create policy plan_events_owner_insert on public.plan_events
  for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists plan_events_owner_delete on public.plan_events;
create policy plan_events_owner_delete on public.plan_events
  for delete to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists plan_members_select on public.plan_event_members;
create policy plan_members_select on public.plan_event_members
  for select to authenticated
  using (public.is_plan_event_member(event_id) or user_id = auth.uid());

drop policy if exists plan_members_insert on public.plan_event_members;
create policy plan_members_insert on public.plan_event_members
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_plan_event_member(event_id));

drop policy if exists plan_saved_own on public.plan_saved_lists;
create policy plan_saved_own on public.plan_saved_lists
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists plan_personal_own on public.plan_personal_boards;
create policy plan_personal_own on public.plan_personal_boards
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
