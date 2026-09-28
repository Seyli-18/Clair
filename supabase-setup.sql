create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  priority text not null default 'normale' check (priority in ('basse', 'normale', 'haute')),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_created_at_idx
  on public.tasks (user_id, created_at desc);

alter table public.tasks enable row level security;
grant select, insert, update, delete on table public.tasks to authenticated;

drop policy if exists "Users manage their own tasks" on public.tasks;
create policy "Users manage their own tasks"
  on public.tasks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.mind_maps (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  nodes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  event_date date not null,
  start_time time not null,
  end_time time not null,
  notes text not null default '' check (char_length(notes) <= 500),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.timetable_slots (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  location text not null default '' check (char_length(location) <= 120),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.timetable_pdfs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists mind_maps_user_updated_idx on public.mind_maps (user_id, updated_at desc);
create index if not exists calendar_events_user_date_idx on public.calendar_events (user_id, event_date, start_time);
create index if not exists timetable_slots_user_day_idx on public.timetable_slots (user_id, weekday, start_time);

alter table public.mind_maps enable row level security;
alter table public.calendar_events enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.timetable_pdfs enable row level security;

grant select, insert, update, delete on public.mind_maps, public.calendar_events, public.timetable_slots, public.timetable_pdfs to authenticated;

drop policy if exists "Users manage their own mind maps" on public.mind_maps;
create policy "Users manage their own mind maps" on public.mind_maps
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own calendar events" on public.calendar_events;
create policy "Users manage their own calendar events" on public.calendar_events
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own timetable slots" on public.timetable_slots;
create policy "Users manage their own timetable slots" on public.timetable_slots
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own timetable PDFs" on public.timetable_pdfs;
create policy "Users manage their own timetable PDFs" on public.timetable_pdfs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clair-timetable-pdfs', 'clair-timetable-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

drop policy if exists "Users view their own timetable PDFs" on storage.objects;
create policy "Users view their own timetable PDFs" on storage.objects
  for select to authenticated
  using (bucket_id = 'clair-timetable-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users upload their own timetable PDFs" on storage.objects;
create policy "Users upload their own timetable PDFs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'clair-timetable-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete their own timetable PDFs" on storage.objects;
create policy "Users delete their own timetable PDFs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'clair-timetable-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['tasks', 'mind_maps', 'calendar_events', 'timetable_slots', 'timetable_pdfs']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;
