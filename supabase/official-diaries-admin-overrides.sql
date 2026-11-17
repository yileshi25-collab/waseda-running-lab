-- Waseda Running Lab: official diary metadata overrides.
-- Already deployed to Supabase on 2026-11-17.
-- Safe, additive setup for a fresh database. Original JSON stays unchanged.
create table if not exists public.wsd_official_diary_overrides (
  diary_id text primary key
    check (diary_id ~ '^official-diary-[0-9]{1,8}$'),
  author text not null check (char_length(trim(author)) between 2 and 80),
  title text not null check (char_length(trim(title)) between 2 and 200),
  published_at date not null
    check (published_at between date '2026-01-01' and current_date + 1),
  source_url text not null
    check (source_url ~ '^https://waseda-ac\.jp/diary/detail/[0-9]+$'
      and char_length(source_url) <= 150),
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint wsd_diary_override_url_matches_id
    check (source_url = 'https://waseda-ac.jp/diary/detail/' ||
      substring(diary_id from '^official-diary-([0-9]{1,8})$'))
);
create or replace function public.wsd_touch_official_diary_override()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.wsd_touch_official_diary_override() from public, anon, authenticated;
drop trigger if exists wsd_touch_official_diary_override on public.wsd_official_diary_overrides;
create trigger wsd_touch_official_diary_override
  before insert or update on public.wsd_official_diary_overrides
  for each row execute function public.wsd_touch_official_diary_override();

alter table public.wsd_official_diary_overrides enable row level security;
revoke all on public.wsd_official_diary_overrides from public, anon, authenticated;
grant select (diary_id,author,title,published_at,source_url,hidden,updated_at)
  on public.wsd_official_diary_overrides to anon, authenticated;
grant insert (diary_id,author,title,published_at,source_url,hidden)
  on public.wsd_official_diary_overrides to authenticated;
grant update (author,title,published_at,source_url,hidden)
  on public.wsd_official_diary_overrides to authenticated;

drop policy if exists wsd_diary_override_public_read on public.wsd_official_diary_overrides;
create policy wsd_diary_override_public_read
  on public.wsd_official_diary_overrides for select to anon, authenticated using (true);
drop policy if exists wsd_diary_override_admin_insert on public.wsd_official_diary_overrides;
create policy wsd_diary_override_admin_insert
  on public.wsd_official_diary_overrides for insert to authenticated
  with check ((select public.wsd_is_community_admin()));
drop policy if exists wsd_diary_override_admin_update on public.wsd_official_diary_overrides;
create policy wsd_diary_override_admin_update
  on public.wsd_official_diary_overrides for update to authenticated
  using ((select public.wsd_is_community_admin()))
  with check ((select public.wsd_is_community_admin()));
