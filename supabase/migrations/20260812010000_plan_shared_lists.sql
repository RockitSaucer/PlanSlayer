-- PlanSlayer: shared list invites (map-style join by 6-digit code)
-- Same Supabase project as Hunt/Reg/Plan — safe additive migration.

create table if not exists public.plan_shared_lists (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_list_id text not null,
  name text not null default 'List',
  event_id uuid null references public.plan_events(id) on delete set null,
  event_invite_code text null,
  list_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_shared_lists_code_digits check (invite_code ~ '^[0-9]{6}$'),
  constraint plan_shared_lists_client_unique unique (owner_user_id, client_list_id)
);

create index if not exists plan_shared_lists_owner_idx on public.plan_shared_lists (owner_user_id);
create index if not exists plan_shared_lists_code_idx on public.plan_shared_lists (invite_code);
create index if not exists plan_shared_lists_event_idx on public.plan_shared_lists (event_id);

create table if not exists public.plan_shared_list_members (
  list_id uuid not null references public.plan_shared_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create index if not exists plan_shared_list_members_user_idx
  on public.plan_shared_list_members (user_id);

create or replace function public.is_plan_shared_list_member(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plan_shared_list_members m
    where m.list_id = p_list_id and m.user_id = auth.uid()
  );
$$;

-- Owner publishes / refreshes a list invite + snapshot (called when Share / Invite members).
create or replace function public.publish_plan_list(
  p_invite_code text,
  p_client_list_id text,
  p_name text,
  p_list_state jsonb,
  p_event_id uuid default null,
  p_event_invite_code text default null
)
returns public.plan_shared_lists
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := regexp_replace(coalesce(p_invite_code, ''), '\D', '', 'g');
  v_client text := left(trim(coalesce(p_client_list_id, '')), 120);
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_ev_code text := nullif(regexp_replace(coalesce(p_event_invite_code, ''), '\D', '', 'g'), '');
  v_row public.plan_shared_lists;
  v_try int := 0;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_client is null or char_length(v_client) < 1 then
    raise exception 'List id required';
  end if;
  if v_name is null or char_length(v_name) < 1 then
    v_name := 'List';
  end if;
  if v_ev_code is not null and char_length(v_ev_code) <> 6 then
    v_ev_code := null;
  end if;

  -- Reuse existing row for this owner+client list
  select * into v_row
  from public.plan_shared_lists
  where owner_user_id = v_uid and client_list_id = v_client;

  if v_row.id is not null then
    -- Keep existing code unless caller supplied a different valid one that is free
    if char_length(v_code) = 6 and v_code is distinct from v_row.invite_code then
      if not exists (
        select 1 from public.plan_shared_lists s
        where s.invite_code = v_code and s.id is distinct from v_row.id
      ) then
        v_row.invite_code := v_code;
      end if;
    end if;
    update public.plan_shared_lists
    set
      invite_code = v_row.invite_code,
      name = v_name,
      list_state = coalesce(p_list_state, '{}'::jsonb),
      event_id = p_event_id,
      event_invite_code = coalesce(v_ev_code, event_invite_code),
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    if char_length(v_code) <> 6 then
      loop
        v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
        exit when not exists (
          select 1 from public.plan_shared_lists s where s.invite_code = v_code
        );
        v_try := v_try + 1;
        if v_try > 30 then raise exception 'Could not allocate invite code'; end if;
      end loop;
    end if;

    begin
      insert into public.plan_shared_lists (
        invite_code, owner_user_id, client_list_id, name,
        event_id, event_invite_code, list_state
      ) values (
        v_code, v_uid, v_client, v_name,
        p_event_id, v_ev_code, coalesce(p_list_state, '{}'::jsonb)
      )
      returning * into v_row;
    exception when unique_violation then
      -- Race on invite_code: retry with new code once
      v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
      insert into public.plan_shared_lists (
        invite_code, owner_user_id, client_list_id, name,
        event_id, event_invite_code, list_state
      ) values (
        v_code, v_uid, v_client, v_name,
        p_event_id, v_ev_code, coalesce(p_list_state, '{}'::jsonb)
      )
      returning * into v_row;
    end;
  end if;

  insert into public.plan_shared_list_members (list_id, user_id, role)
  values (v_row.id, v_uid, 'owner')
  on conflict (list_id, user_id) do update set role = excluded.role;

  return v_row;
end;
$$;

-- Join by 6-digit list invite code (like join_shared_map / join_plan_event).
-- Also grants event membership when the list is linked to a plan event.
create or replace function public.join_plan_list(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  v_row public.plan_shared_lists;
  v_ev public.plan_events;
  v_ev_code text;
  v_joined_event boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if char_length(v_code) <> 6 then raise exception 'Invalid code'; end if;

  select * into v_row from public.plan_shared_lists where invite_code = v_code;
  if v_row.id is null then raise exception 'List not found'; end if;

  insert into public.plan_shared_list_members (list_id, user_id, role)
  values (v_row.id, v_uid, 'member')
  on conflict (list_id, user_id) do nothing;

  -- Dual-grant event access when linked
  if v_row.event_id is not null then
    select * into v_ev from public.plan_events where id = v_row.event_id;
    if v_ev.id is not null then
      insert into public.plan_event_members (event_id, user_id, role)
      values (v_ev.id, v_uid, 'member')
      on conflict (event_id, user_id) do nothing;
      v_joined_event := true;
    end if;
  end if;

  if not v_joined_event then
    v_ev_code := nullif(regexp_replace(coalesce(v_row.event_invite_code, ''), '\D', '', 'g'), '');
    if v_ev_code is not null and char_length(v_ev_code) = 6 then
      select * into v_ev from public.plan_events where invite_code = v_ev_code;
      if v_ev.id is not null then
        insert into public.plan_event_members (event_id, user_id, role)
        values (v_ev.id, v_uid, 'member')
        on conflict (event_id, user_id) do nothing;
        -- backfill event_id on the list row for future joins
        update public.plan_shared_lists
        set event_id = v_ev.id, updated_at = now()
        where id = v_row.id and event_id is null;
        v_row.event_id := v_ev.id;
        v_joined_event := true;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'invite_code', v_row.invite_code,
    'owner_user_id', v_row.owner_user_id,
    'client_list_id', v_row.client_list_id,
    'name', v_row.name,
    'event_id', v_row.event_id,
    'event_invite_code', v_row.event_invite_code,
    'list_state', v_row.list_state,
    'updated_at', v_row.updated_at,
    'joined_event', v_joined_event,
    'event', case when v_joined_event and v_ev.id is not null then to_jsonb(v_ev) else null end
  );
end;
$$;

-- Lists I own or joined (for cross-device pull of shared packs).
create or replace function public.list_my_plan_shared_lists()
returns setof public.plan_shared_lists
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.plan_shared_lists s
  where s.owner_user_id = auth.uid()
     or exists (
       select 1 from public.plan_shared_list_members m
       where m.list_id = s.id and m.user_id = auth.uid()
     )
  order by s.updated_at desc;
$$;

grant select, insert, update, delete on public.plan_shared_lists to authenticated;
grant select, insert, update, delete on public.plan_shared_list_members to authenticated;
grant execute on function public.is_plan_shared_list_member(uuid) to authenticated;
grant execute on function public.publish_plan_list(text, text, text, jsonb, uuid, text) to authenticated;
grant execute on function public.join_plan_list(text) to authenticated;
grant execute on function public.list_my_plan_shared_lists() to authenticated;

alter table public.plan_shared_lists enable row level security;
alter table public.plan_shared_list_members enable row level security;

drop policy if exists plan_shared_lists_member_select on public.plan_shared_lists;
create policy plan_shared_lists_member_select on public.plan_shared_lists
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or public.is_plan_shared_list_member(id)
  );

drop policy if exists plan_shared_lists_owner_write on public.plan_shared_lists;
create policy plan_shared_lists_owner_write on public.plan_shared_lists
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists plan_shared_list_members_select on public.plan_shared_list_members;
create policy plan_shared_list_members_select on public.plan_shared_list_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_plan_shared_list_member(list_id)
  );

drop policy if exists plan_shared_list_members_insert on public.plan_shared_list_members;
create policy plan_shared_list_members_insert on public.plan_shared_list_members
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_plan_shared_list_member(list_id));
