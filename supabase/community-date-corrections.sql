-- Waseda Running Lab: community date corrections (2026 annual records)
-- Run AFTER supabase/community.sql. Safe to rerun; existing corrections are preserved.
-- Original Word/CSV records (IDs 1-176) remain unchanged.
create table if not exists public.wsd_community_date_corrections (
  id uuid primary key default gen_random_uuid(),
  record_id integer not null check (record_id between 1 and 176),
  author_id uuid not null references auth.users(id) on delete cascade,
  corrected_date date not null check (corrected_date between date '2026-01-01' and date '2026-12-31'),
  created_at timestamptz not null default now()
);
create index if not exists wsd_date_corrections_record_latest
  on public.wsd_community_date_corrections (record_id,created_at desc,id desc);
create index if not exists wsd_date_corrections_author
  on public.wsd_community_date_corrections (author_id,created_at desc);
alter table public.wsd_community_date_corrections enable row level security;
revoke all on public.wsd_community_date_corrections from public,anon,authenticated;
-- Do not expose Google user UUIDs / author_id through anonymous reads.
grant select (id,record_id,corrected_date,created_at)
  on public.wsd_community_date_corrections to anon,authenticated;
grant insert (record_id,author_id,corrected_date)
  on public.wsd_community_date_corrections to authenticated;
grant delete on public.wsd_community_date_corrections to authenticated;

drop policy if exists wsd_date_corrections_public_read on public.wsd_community_date_corrections;
create policy wsd_date_corrections_public_read
  on public.wsd_community_date_corrections for select to anon,authenticated
  using (true);
drop policy if exists wsd_date_corrections_auth_insert on public.wsd_community_date_corrections;
create policy wsd_date_corrections_auth_insert
  on public.wsd_community_date_corrections for insert to authenticated
  with check (author_id=(select auth.uid()));
drop policy if exists wsd_date_corrections_author_admin_delete
  on public.wsd_community_date_corrections;
create policy wsd_date_corrections_author_admin_delete
  on public.wsd_community_date_corrections for delete to authenticated
  using (author_id=(select auth.uid()) or (select public.wsd_is_community_admin()));

-- SECURITY DEFINER is limited to an internal trigger only. Revoke all
-- public API EXECUTE privileges, use a fixed search path, and require auth.uid().
create or replace function public.wsd_date_correction_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare n_min integer; n_hour integer; n_day integer;
begin
 if (select auth.uid()) is null then raise exception 'Sign in to correct dates'; end if;
 new.author_id:=(select auth.uid());new.created_at:=now();
 select count(*) filter(where created_at>now()-interval '1 minute'),
        count(*) filter(where created_at>now()-interval '1 hour'),
        count(*) filter(where created_at>now()-interval '1 day')
 into n_min,n_hour,n_day
 from public.wsd_community_date_corrections where author_id=new.author_id;
 if n_min>=5 or n_hour>=30 or n_day>=100 then
   raise exception 'Too many date corrections; please retry later';
 end if;
 return new;
end;
$$;
revoke all on function public.wsd_date_correction_guard() from public,anon,authenticated;
drop trigger if exists wsd_before_date_correction on public.wsd_community_date_corrections;
create trigger wsd_before_date_correction before insert
  on public.wsd_community_date_corrections
  for each row execute function public.wsd_date_correction_guard();

-- Privately return *only* the logged-in author's correction IDs for UI controls.
create or replace function public.wsd_my_date_correction_ids()
returns table (id uuid) language sql stable security definer set search_path=''
as $$
 select c.id from public.wsd_community_date_corrections c
 where c.author_id=(select auth.uid()) order by c.created_at desc limit 200;
$$;
revoke all on function public.wsd_my_date_correction_ids() from public,anon,authenticated;
grant execute on function public.wsd_my_date_correction_ids() to authenticated;

-- Do NOT add this table to the public postgres_changes publication:
-- author_id is not a public field; clients refresh sanitized records on focus.
do $$
begin
 if exists (select 1 from pg_catalog.pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
     and tablename='wsd_community_date_corrections')
 then
   alter publication supabase_realtime drop table public.wsd_community_date_corrections;
 end if;
end $$;
