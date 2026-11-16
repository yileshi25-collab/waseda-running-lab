-- Waseda Running Lab: photo cover selection and focal point positioning.
-- Incremental migration only. Existing photos, races, RLS and date corrections are retained.
-- First uploaded photo per athlete is used as cover unless is_primary=true is set.
alter table public.wsd_community_submissions
  add column if not exists is_primary boolean not null default false,
  add column if not exists focal_x smallint not null default 50,
  add column if not exists focal_y smallint not null default 20;

alter table public.wsd_community_submissions
  drop constraint if exists wsd_photo_focal_valid;
alter table public.wsd_community_submissions
  add constraint wsd_photo_focal_valid check
    (focal_x between 0 and 100 and focal_y between 0 and 100);

create unique index if not exists wsd_one_primary_photo_per_athlete
  on public.wsd_community_submissions (athlete_name)
  where kind='photo' and status='published' and is_primary=true;

-- These fields can be read by anonymous visitors; author_id remains private.
grant select (is_primary,focal_x,focal_y)
  on public.wsd_community_submissions to anon,authenticated;
-- No direct client updates for the new metadata. Only the guarded RPCs below.
revoke update (is_primary,focal_x,focal_y)
  on public.wsd_community_submissions from anon,authenticated;

-- Explicit ownership/admin check before modifying cropping metadata.
create or replace function public.wsd_update_photo_crop(
  p_photo_id uuid,p_x integer,p_y integer
) returns void
language plpgsql security definer set search_path=''
as $$
declare current_author uuid;
begin
 if (select auth.uid()) is null then
   raise exception 'Google sign-in required' using errcode='42501';
 end if;
 if p_x is null or p_y is null or p_x not between 0 and 100 or p_y not between 0 and 100 then
   raise exception 'Crop coordinates must be 0-100';
 end if;
 select s.author_id into current_author
 from public.wsd_community_submissions s
 where s.id=p_photo_id and s.kind='photo' and s.status='published';
 if not found then raise exception 'Photo not found'; end if;
 if current_author<>(select auth.uid())
    and not (select public.wsd_is_community_admin()) then
   raise exception 'You can only adjust your own photographs' using errcode='42501';
 end if;
 update public.wsd_community_submissions
   set focal_x=p_x::smallint,focal_y=p_y::smallint
   where id=p_photo_id and kind='photo' and status='published';
end;
$$;
revoke all on function public.wsd_update_photo_crop(uuid,integer,integer)
  from public,anon,authenticated;
grant execute on function public.wsd_update_photo_crop(uuid,integer,integer)
  to authenticated;

-- Auto-clear the former cover, then feature the chosen image.
-- The athlete advisory lock + unique index avoids simultaneous selections.
create or replace function public.wsd_set_photo_primary(p_photo_id uuid)
returns void
language plpgsql security definer set search_path=''
as $$
declare photo_author uuid;photo_athlete text;
begin
 if (select auth.uid()) is null then
   raise exception 'Google sign-in required' using errcode='42501';
 end if;
 select s.author_id,s.athlete_name into photo_author,photo_athlete
 from public.wsd_community_submissions s
 where s.id=p_photo_id and s.kind='photo' and s.status='published';
 if not found then raise exception 'Photo not found'; end if;
 if photo_author<>(select auth.uid())
    and not (select public.wsd_is_community_admin()) then
   raise exception 'You can only feature your own photographs' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('wsd-photo-cover:'||photo_athlete,77)
 );
 update public.wsd_community_submissions
   set is_primary=false
   where athlete_name=photo_athlete and kind='photo' and is_primary=true;
 update public.wsd_community_submissions
   set is_primary=true
   where id=p_photo_id and kind='photo' and status='published';
 if not found then raise exception 'Photo was removed before selecting it'; end if;
end;
$$;
revoke all on function public.wsd_set_photo_primary(uuid)
  from public,anon,authenticated;
grant execute on function public.wsd_set_photo_primary(uuid) to authenticated;

-- Existing photo files remain untouched. The display focal point is
-- applied only in CSS object-position. Visitors may open the full image.
