-- Waseda Running Lab: shared athlete biographies and event interviews/summaries.
-- This is an additive migration. It does NOT rebuild submissions, photos,
-- date corrections, admins, storage, or historical race records.
create table if not exists public.wsd_community_editorial (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id) on delete cascade,
 athlete_name text not null check (char_length(trim(athlete_name)) between 2 and 75),
 scope text not null check (scope in ('bio','race')),
 race_ref text,
 category text not null check (category in ('bio','interview','summary','article','analysis','other')),
 title text not null check (char_length(trim(title)) between 2 and 100),
 body text not null default '' check (char_length(body)<=4000),
 source_url text check (source_url is null or
   (char_length(source_url)<=400 and source_url ~ '^https://[^[:space:]]+$')),
 display_name text not null check (char_length(trim(display_name)) between 2 and 30),
 created_at timestamptz not null default now(),
 constraint wsd_editorial_content_required check
  (char_length(trim(body))>0 or source_url is not null),
 constraint wsd_editorial_scope_valid check (
   (scope='bio' and race_ref is null and category='bio') or
   (scope='race' and race_ref ~
     '^(2026-[1-9][0-9]{0,4}|2025-[0-9]{1,5}|community-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
    and category<>'bio')
 )
);
create index if not exists wsd_editorial_athlete_idx
 on public.wsd_community_editorial(athlete_name,scope,created_at desc);
create index if not exists wsd_editorial_race_idx
 on public.wsd_community_editorial(race_ref,created_at desc) where scope='race';
create index if not exists wsd_editorial_author_idx
 on public.wsd_community_editorial(author_id,created_at desc);

alter table public.wsd_community_editorial enable row level security;
revoke all on public.wsd_community_editorial from public,anon,authenticated;
-- Public display never includes the Google user's UUID/email.
grant select (id,athlete_name,scope,race_ref,category,title,body,source_url,display_name,created_at)
 on public.wsd_community_editorial to anon,authenticated;
grant insert (author_id,athlete_name,scope,race_ref,category,title,body,source_url,display_name)
 on public.wsd_community_editorial to authenticated;
grant delete on public.wsd_community_editorial to authenticated;
drop policy if exists wsd_editorial_public_read on public.wsd_community_editorial;
create policy wsd_editorial_public_read
 on public.wsd_community_editorial for select to anon,authenticated using(true);
drop policy if exists wsd_editorial_author_insert on public.wsd_community_editorial;
create policy wsd_editorial_author_insert
 on public.wsd_community_editorial for insert to authenticated
 with check(author_id=(select auth.uid()));
drop policy if exists wsd_editorial_owner_or_admin_delete on public.wsd_community_editorial;
create policy wsd_editorial_owner_or_admin_delete
 on public.wsd_community_editorial for delete to authenticated
 using(author_id=(select auth.uid()) or (select public.wsd_is_community_admin()));

-- Return only the current author's editorial post IDs for private delete buttons.
create or replace function public.wsd_my_editorial_ids()
returns table(id uuid) language sql stable security definer set search_path=''
as $$
 select p.id from public.wsd_community_editorial p
 where p.author_id=(select auth.uid()) order by p.created_at desc limit 2000
$$;
revoke all on function public.wsd_my_editorial_ids() from public,anon,authenticated;
grant execute on function public.wsd_my_editorial_ids() to authenticated;

-- Do not add to Supabase public Realtime publication because it would expose
-- the private author_id in row events. Front-end refreshes on focus/visibility
-- and periodically; the author sees their own new post immediately.
