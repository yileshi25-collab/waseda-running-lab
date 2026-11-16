-- Waseda Running Lab / Instant community submissions
-- Run as the project owner in Supabase SQL Editor, once per project.
-- The browser must ONLY receive the project's publishable (anon) key.
-- Never publish service_role/secret credentials in GitHub Pages.

create extension if not exists pgcrypto;

create table if not exists public.wsd_community_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.wsd_community_admins enable row level security;
revoke all on public.wsd_community_admins from anon, authenticated;
grant select on public.wsd_community_admins to authenticated;
drop policy if exists "wsd_admin_self_read" on public.wsd_community_admins;
create policy "wsd_admin_self_read"
  on public.wsd_community_admins for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.wsd_is_community_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wsd_community_admins
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.wsd_is_community_admin() from public;
grant execute on function public.wsd_is_community_admin() to anon, authenticated;

create table if not exists public.wsd_community_submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '早稻田跑友',
  kind text not null check (kind in ('race','photo')),
  athlete_name text not null,
  event_name text,
  race_date date,
  result_time text,
  rank integer,
  notes text not null default '',
  source_url text,
  image_path text,
  image_credit text,
  image_license text,
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  constraint wsd_display_name_valid check (char_length(display_name) between 2 and 30),
  constraint wsd_athlete_name_valid check (char_length(athlete_name) between 2 and 75),
  constraint wsd_event_name_valid check (event_name is null or char_length(event_name) between 2 and 80),
  constraint wsd_notes_valid check (char_length(notes) <= 500 and notes !~* '(https?://|www\.)'),
  constraint wsd_source_https check (source_url is null or (char_length(source_url) <= 400 and source_url ~ '^https://[^[:space:]]+$')),
  constraint wsd_image_credit_valid check (image_credit is null or char_length(image_credit) <= 120),
  constraint wsd_rank_valid check (rank is null or rank between 1 and 50000),
  constraint wsd_date_valid check (race_date is null or race_date between date '2020-01-01' and current_date + interval '1 day'),
  constraint wsd_image_owner_path check (
    image_path is null or (
      image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
      and split_part(image_path,'/',1) = author_id::text
    )
  ),
-- Photo source_url is optional for every license choice; rights and image_credit remain mandatory.
  constraint wsd_kind_fields check (
     (kind = 'race'
       and event_name is not null
       and race_date is not null
       and result_time ~ '^[0-9]{1,2}(:[0-9]{2}){1,2}(\.[0-9]{1,2})?$'
       and source_url is not null
       and image_path is null and image_license is null and image_credit is null)
     or
     (kind = 'photo'
       and image_path is not null
       and image_license in ('own','permission','cc-by','public-domain')
       and image_credit is not null and char_length(trim(image_credit)) > 0
       and event_name is null and race_date is null and result_time is null and rank is null)
  )
);
create index if not exists wsd_submissions_public_idx
  on public.wsd_community_submissions (status, created_at desc);
create index if not exists wsd_submissions_author_idx
  on public.wsd_community_submissions (author_id, created_at desc);
create index if not exists wsd_submissions_athlete_idx
  on public.wsd_community_submissions (athlete_name, created_at desc);

-- Server-enforced per-account limits. Inserts are serialized per user.
create or replace function public.wsd_submission_guard()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  recent_minute integer;
  recent_hour integer;
  recent_day integer;
begin
  if (select auth.uid()) is null then
    raise exception 'You must sign in to submit';
  end if;
  new.author_id := (select auth.uid());
  new.created_at := now();
  new.status := 'published';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.author_id::text, 42));
  select
     count(*) filter (where created_at >= now() - interval '1 minute'),
     count(*) filter (where created_at >= now() - interval '1 hour'),
     count(*) filter (where created_at >= now() - interval '1 day')
    into recent_minute, recent_hour, recent_day
    from public.wsd_community_submissions where author_id = new.author_id;
  if recent_minute >= 1 or recent_hour >= 6 or recent_day >= 20 then
    raise exception 'Too many submissions. Try later (1/min, 6/hour, 20/day).';
  end if;
  return new;
end;
$$;
drop trigger if exists wsd_before_submit on public.wsd_community_submissions;
create trigger wsd_before_submit
  before insert on public.wsd_community_submissions
  for each row execute function public.wsd_submission_guard();

alter table public.wsd_community_submissions enable row level security;
revoke all on public.wsd_community_submissions from anon, authenticated;
-- Public readers can see community posts but not contributor Auth user IDs.
grant select (id, kind, athlete_name, display_name, event_name, race_date,
  result_time, rank, notes, source_url, image_path, image_credit,
  image_license, created_at, status)
  on public.wsd_community_submissions to anon, authenticated;
grant insert (author_id, display_name, kind, athlete_name, event_name,
  race_date, result_time, rank, notes, source_url, image_path,
  image_credit, image_license) on public.wsd_community_submissions to authenticated;
grant update (status) on public.wsd_community_submissions to authenticated;
-- Only authenticated authors and admins may permanently delete submissions.
grant delete on public.wsd_community_submissions to authenticated;
revoke delete on public.wsd_community_submissions from anon;
drop policy if exists "wsd_public_read_posted" on public.wsd_community_submissions;
create policy "wsd_public_read_posted" on public.wsd_community_submissions
  for select to anon, authenticated
  using (status = 'published' or (select public.wsd_is_community_admin()));
drop policy if exists "wsd_auth_insert_own_published" on public.wsd_community_submissions;
create policy "wsd_auth_insert_own_published" on public.wsd_community_submissions
  for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'published');
drop policy if exists "wsd_only_admin_hide" on public.wsd_community_submissions;
create policy "wsd_only_admin_hide" on public.wsd_community_submissions
  for update to authenticated
  using ((select public.wsd_is_community_admin()))
  with check ((select public.wsd_is_community_admin()));

drop policy if exists "wsd_owner_or_admin_delete" on public.wsd_community_submissions;
create policy "wsd_owner_or_admin_delete" on public.wsd_community_submissions
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or (select public.wsd_is_community_admin())
  );

-- Owner-only lookup for delete buttons without exposing author IDs in the public feed.
create or replace function public.wsd_my_submission_ids()
returns setof uuid language sql stable security definer
set search_path = ''
as $
  select s.id
  from public.wsd_community_submissions s
  where s.author_id = (select auth.uid())
    and s.status = 'published';
$;
revoke all on function public.wsd_my_submission_ids() from public, anon;
grant execute on function public.wsd_my_submission_ids() to authenticated;

create table if not exists public.wsd_community_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.wsd_community_submissions(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('wrong-result','copyright','privacy','abuse','other')),
  created_at timestamptz not null default now(),
  unique (submission_id, reporter_id)
);
alter table public.wsd_community_reports enable row level security;
revoke all on public.wsd_community_reports from anon, authenticated;
grant select on public.wsd_community_reports to authenticated;
grant insert (submission_id, reporter_id, reason) on public.wsd_community_reports to authenticated;
drop policy if exists "wsd_report_own_or_admin" on public.wsd_community_reports;
create policy "wsd_report_own_or_admin" on public.wsd_community_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.wsd_is_community_admin()));
drop policy if exists "wsd_report_new" on public.wsd_community_reports;
create policy "wsd_report_new" on public.wsd_community_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- Public images must be specifically JPEG and no larger than 2MB.
-- Files go into the authenticated account's UUID folder.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('wsd-community-photos','wsd-community-photos',true,2097152,array['image/jpeg'])
on conflict (id) do update
  set public=true,file_size_limit=2097152,allowed_mime_types=array['image/jpeg'];

-- Rate-limit orphaned uploads as well as photos eventually used in a post.
create or replace function public.wsd_can_upload_photo()
returns boolean language sql security definer stable
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select count(*) from storage.objects
         where bucket_id = 'wsd-community-photos'
           and owner_id = (select auth.uid())::text
           and created_at >= now() - interval '1 hour') < 4
    and (select count(*) from storage.objects
         where bucket_id = 'wsd-community-photos'
           and owner_id = (select auth.uid())::text
           and created_at >= now() - interval '1 day') < 12;
$$;
revoke all on function public.wsd_can_upload_photo() from public;
grant execute on function public.wsd_can_upload_photo() to authenticated;

drop policy if exists "wsd_upload_own_jpeg_rate_limited" on storage.objects;
create policy "wsd_upload_own_jpeg_rate_limited" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wsd-community-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
    and (select public.wsd_can_upload_photo())
  );
drop policy if exists "wsd_delete_unused_or_admin_photo" on storage.objects;
create policy "wsd_delete_unused_or_admin_photo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'wsd-community-photos'
    and (
      (select public.wsd_is_community_admin())
      or (
        owner_id = (select auth.uid())::text
        and not exists (
          select 1 from public.wsd_community_submissions s
          where s.image_path = name and s.kind = 'photo'
        )
      )
    )
  );
-- Storage.remove also requires read access to find the object. This
-- lets owners clean up failed uploads and admins remove reported photos.
drop policy if exists "wsd_storage_owner_admin_read" on storage.objects;
create policy "wsd_storage_owner_admin_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'wsd-community-photos'
    and (owner_id = (select auth.uid())::text
         or (select public.wsd_is_community_admin()))
  );

-- Realtime: append the public submissions table once.
do $$
begin
  if not exists (
     select 1 from pg_catalog.pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'wsd_community_submissions'
  ) then
     alter publication supabase_realtime add table public.wsd_community_submissions;
  end if;
end $$;

-- AFTER YOUR OWN FIRST EMAIL LOGIN:
-- In Supabase > Authentication > Users copy YOUR User UID (not your email).
-- Then run in the SQL Editor with the real UUID:
-- insert into public.wsd_community_admins (user_id)
-- values ('YOUR-USER-UUID-HERE') on conflict do nothing;
--
-- Authors may delete their own posts; admins may delete any post.
-- After deleting a photo's submission DB row, use Storage.remove() to
-- delete its public object. If cleanup fails, remove the orphaned
-- image manually in Supabase Storage; deleting a row alone does not
-- revoke a previously shared image URL.
