-- Add a canonical source date to community-authored diary metadata.
-- Prerequisite: public.wsd_community_editorial and public.wsd_is_community_admin() exist.
-- Existing published posts and official JSON index remain unchanged.
alter table public.wsd_community_editorial add column if not exists published_at date;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid='public.wsd_community_editorial'::regclass
      and conname='wsd_editorial_published_at_valid'
  ) then
    alter table public.wsd_community_editorial add constraint wsd_editorial_published_at_valid
    check (published_at is null or (published_at between date '2020-01-01' and current_date + 1));
  end if;
end $$;
grant select (published_at) on public.wsd_community_editorial to anon, authenticated;
grant insert (published_at) on public.wsd_community_editorial to authenticated;
grant update (athlete_name,related_athletes,category,title,body,source_url,display_name,published_at)
  on public.wsd_community_editorial to authenticated;
-- Immutable in the browser: author_id, created_at, id, scope, race_ref.
alter table public.wsd_community_editorial enable row level security;
drop policy if exists wsd_editorial_owner_update on public.wsd_community_editorial;
create policy wsd_editorial_owner_update
  on public.wsd_community_editorial for update to authenticated
  using(author_id=(select auth.uid()))
  with check(author_id=(select auth.uid()));
drop policy if exists wsd_editorial_admin_update on public.wsd_community_editorial;
create policy wsd_editorial_admin_update
  on public.wsd_community_editorial for update to authenticated
  using((select public.wsd_is_community_admin()))
  with check((select public.wsd_is_community_admin()));
