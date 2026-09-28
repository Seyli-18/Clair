create table if not exists public.card_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  anime_name text not null check (char_length(trim(anime_name)) between 1 and 80),
  character_name text not null check (char_length(trim(character_name)) between 1 and 80),
  image_url text check (
    image_url is null
    or (char_length(image_url) <= 500 and lower(image_url) ~ '^https://')
  ),
  rarity text not null default 'common'
    check (rarity in ('common', 'rare', 'epic', 'legendary')),
  created_at timestamptz not null default now(),
  unique (user_id, anime_name, character_name)
);

create index if not exists card_catalog_user_anime_idx
  on public.card_catalog (user_id, anime_name);

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

alter table public.card_catalog enable row level security;
alter table public.card_packs enable row level security;
alter table public.user_collection enable row level security;

grant select, insert, update, delete on public.card_catalog to authenticated;
grant select on public.card_packs, public.user_collection to authenticated;

drop policy if exists "Users manage their own card catalog" on public.card_catalog;
create policy "Users manage their own card catalog"
  on public.card_catalog
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users view their own card packs" on public.card_packs;
create policy "Users view their own card packs"
  on public.card_packs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users view their own collection" on public.user_collection;
create policy "Users view their own collection"
  on public.user_collection
  for select
  to authenticated
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
    from public.card_catalog
    where user_id = v_user_id
      and (p_pack_type = 'daily' or lower(anime_name) = lower(trim(p_anime_name)))
  ) then
    raise exception 'Add at least one character to this anime in your catalog before opening a pack.';
  end if;

  for v_index in 1..v_card_count loop
    select jsonb_build_object(
      'catalog_id', card.id,
      'anime_name', card.anime_name,
      'character_name', card.character_name,
      'image_url', card.image_url,
      'rarity', card.rarity
    )
      into v_card
      from public.card_catalog as card
      where card.user_id = v_user_id
        and (p_pack_type = 'daily' or lower(card.anime_name) = lower(trim(p_anime_name)))
      order by
        -ln(greatest(random(), 0.000000000001)) /
        case card.rarity
          when 'common' then 60.0
          when 'rare' then 28.0
          when 'epic' then 10.0
          when 'legendary' then 2.0
        end
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
