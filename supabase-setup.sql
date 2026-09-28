create table if not exists public.site_owner_allowlist (
  email text primary key check (email = lower(trim(email)))
);

alter table public.site_owner_allowlist enable row level security;
revoke all on public.site_owner_allowlist from public, anon, authenticated;

insert into public.site_owner_allowlist (email)
values ('ilyessbia4@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_site_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from auth.users as user_account
    join public.site_owner_allowlist as allowed_owner
      on allowed_owner.email = lower(user_account.email)
    where user_account.id = (select auth.uid())
      and user_account.email_confirmed_at is not null
  );
$$;

revoke all on function public.is_site_owner() from public, anon;
grant execute on function public.is_site_owner() to authenticated;

create table if not exists public.anime_series (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  image_url text check (
    image_url is null
    or (char_length(image_url) <= 500 and lower(image_url) ~ '^https://')
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists anime_series_name_lower_idx
  on public.anime_series (lower(name));

create table if not exists public.rarity_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,24}$'),
  color_hex text not null default '#b496ff' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  draw_weight numeric not null default 10 check (draw_weight between 0.1 and 1000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.rarity_levels (name, slug, color_hex, draw_weight, sort_order)
values
  ('Commune', 'common', '#7edac0', 60, 1),
  ('Rare', 'rare', '#79b9ff', 28, 2),
  ('Épique', 'epic', '#d698ff', 10, 3),
  ('Légendaire', 'legendary', '#ffd27c', 2, 4)
on conflict (slug) do nothing;

create table if not exists public.character_cards (
  id uuid primary key default gen_random_uuid(),
  anime_id uuid not null references public.anime_series (id) on delete restrict,
  character_name text not null check (char_length(trim(character_name)) between 1 and 80),
  manga_artist text not null default '' check (char_length(manga_artist) <= 100),
  description text not null default '' check (char_length(description) <= 1000),
  image_url text check (
    image_url is null
    or (char_length(image_url) <= 500 and lower(image_url) ~ '^https://')
  ),
  rarity_id uuid not null references public.rarity_levels (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists character_cards_anime_character_lower_idx
  on public.character_cards (anime_id, lower(character_name));

create index if not exists character_cards_active_anime_idx
  on public.character_cards (anime_id, rarity_id)
  where is_active;

create table if not exists public.card_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_type text not null check (pack_type in ('daily', 'anime')),
  anime_name text,
  cards jsonb not null check (jsonb_typeof(cards) = 'array'),
  opened_at timestamptz not null default now(),
  check (
    (pack_type = 'daily' and anime_name is null and jsonb_array_length(cards) = 5)
    or (pack_type = 'anime' and char_length(trim(coalesce(anime_name, ''))) between 1 and 80 and jsonb_array_length(cards) = 8)
  )
);

create index if not exists card_packs_user_opened_idx
  on public.card_packs (user_id, opened_at desc);

create table if not exists public.user_collection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_id uuid not null references public.card_packs (id) on delete cascade,
  card_data jsonb not null check (jsonb_typeof(card_data) = 'object'),
  acquired_at timestamptz not null default now()
);

create index if not exists user_collection_user_acquired_idx
  on public.user_collection (user_id, acquired_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clair-card-art',
  'clair-card-art',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

drop policy if exists "Site owner uploads card artwork" on storage.objects;
create policy "Site owner uploads card artwork"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'clair-card-art'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_site_owner())
  );

drop policy if exists "Site owner updates card artwork" on storage.objects;
create policy "Site owner updates card artwork"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'clair-card-art'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_site_owner())
  )
  with check (
    bucket_id = 'clair-card-art'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_site_owner())
  );

drop policy if exists "Site owner deletes card artwork" on storage.objects;
create policy "Site owner deletes card artwork"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'clair-card-art'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_site_owner())
  );

alter table public.anime_series enable row level security;
alter table public.rarity_levels enable row level security;
alter table public.character_cards enable row level security;
alter table public.card_packs enable row level security;
alter table public.user_collection enable row level security;

grant select, insert, update, delete on public.anime_series, public.rarity_levels, public.character_cards to authenticated;
grant select on public.card_packs, public.user_collection to authenticated;

drop policy if exists "Signed-in users view anime sections" on public.anime_series;
create policy "Signed-in users view anime sections"
  on public.anime_series
  for select to authenticated
  using (true);
drop policy if exists "Site owner manages anime sections" on public.anime_series;
create policy "Site owner manages anime sections"
  on public.anime_series
  for all to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));

drop policy if exists "Signed-in users view rarity levels" on public.rarity_levels;
create policy "Signed-in users view rarity levels"
  on public.rarity_levels
  for select to authenticated
  using (true);
drop policy if exists "Site owner manages rarity levels" on public.rarity_levels;
create policy "Site owner manages rarity levels"
  on public.rarity_levels
  for all to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));

drop policy if exists "Signed-in users view active character cards" on public.character_cards;
create policy "Signed-in users view active character cards"
  on public.character_cards
  for select to authenticated
  using (is_active or (select public.is_site_owner()));
drop policy if exists "Site owner manages character cards" on public.character_cards;
create policy "Site owner manages character cards"
  on public.character_cards
  for all to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));

drop policy if exists "Users view their own card packs" on public.card_packs;
create policy "Users view their own card packs"
  on public.card_packs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users view their own collection" on public.user_collection;
create policy "Users view their own collection"
  on public.user_collection
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.open_card_pack(
  p_pack_type text,
  p_anime_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_opened_at timestamptz;
  v_day_start timestamptz;
  v_daily_count integer;
  v_last_anime_pack timestamptz;
  v_card_count integer;
  v_pack_id uuid := gen_random_uuid();
  v_cards jsonb := '[]'::jsonb;
  v_card jsonb;
  v_index integer;
begin
  if v_user_id is null then
    raise exception 'Sign in is required to open card packs.';
  end if;

  if p_pack_type is null or p_pack_type not in ('daily', 'anime') then
    raise exception 'Unknown card pack type.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  v_opened_at := clock_timestamp();

  if p_pack_type = 'daily' then
    v_day_start := date_trunc('day', timezone('UTC', v_opened_at)) at time zone 'UTC';
    select count(*)::integer
      into v_daily_count
      from public.card_packs
      where user_id = v_user_id
        and pack_type = 'daily'
        and opened_at >= v_day_start
        and opened_at < v_day_start + interval '1 day';

    if v_daily_count >= 2 then
      raise exception 'You have opened both daily packs. Try again after midnight UTC.';
    end if;
    v_card_count := 5;
  else
    if char_length(trim(coalesce(p_anime_name, ''))) not between 1 and 80 then
      raise exception 'Choose an anime for the themed pack.';
    end if;

    select max(opened_at)
      into v_last_anime_pack
      from public.card_packs
      where user_id = v_user_id and pack_type = 'anime';

    if v_last_anime_pack is not null and v_last_anime_pack + interval '72 hours' > v_opened_at then
      raise exception 'Your next themed pack unlocks after the 72-hour cooldown.';
    end if;
    v_card_count := 8;
  end if;

  if not exists (
    select 1
    from public.character_cards as character
    join public.anime_series as anime on anime.id = character.anime_id
    join public.rarity_levels as rarity on rarity.id = character.rarity_id
    where character.is_active
      and anime.is_active
      and rarity.is_active
      and (p_pack_type = 'daily' or lower(anime.name) = lower(trim(p_anime_name)))
  ) then
    raise exception 'There are no active cards available for this pack.';
  end if;

  for v_index in 1..v_card_count loop
    select jsonb_build_object(
      'catalog_id', character.id,
      'anime_id', anime.id,
      'anime_name', anime.name,
      'character_name', character.character_name,
      'manga_artist', character.manga_artist,
      'description', character.description,
      'image_url', character.image_url,
      'rarity', rarity.slug,
      'rarity_name', rarity.name,
      'rarity_color', rarity.color_hex
    )
      into v_card
      from public.character_cards as character
      join public.anime_series as anime on anime.id = character.anime_id
      join public.rarity_levels as rarity on rarity.id = character.rarity_id
      where character.is_active
        and anime.is_active
        and rarity.is_active
        and (p_pack_type = 'daily' or lower(anime.name) = lower(trim(p_anime_name)))
      order by
        -ln(greatest(random(), 0.000000000001)) / rarity.draw_weight
      limit 1;

    v_cards := v_cards || jsonb_build_array(v_card);
  end loop;

  insert into public.card_packs (id, user_id, pack_type, anime_name, cards, opened_at)
  values (
    v_pack_id,
    v_user_id,
    p_pack_type,
    case when p_pack_type = 'anime' then trim(p_anime_name) else null end,
    v_cards,
    v_opened_at
  );

  for v_card in select value from jsonb_array_elements(v_cards)
  loop
    insert into public.user_collection (user_id, pack_id, card_data, acquired_at)
    values (v_user_id, v_pack_id, v_card, v_opened_at);
  end loop;

  return jsonb_build_object(
    'pack',
    jsonb_build_object(
      'id', v_pack_id,
      'pack_type', p_pack_type,
      'anime_name', case when p_pack_type = 'anime' then trim(p_anime_name) else null end,
      'cards', v_cards,
      'opened_at', v_opened_at
    )
  );
end;
$$;

revoke all on function public.open_card_pack(text, text) from public, anon;
grant execute on function public.open_card_pack(text, text) to authenticated;
