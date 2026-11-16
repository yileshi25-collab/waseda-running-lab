-- Waseda Running Lab - incremental school-years / university career history.
-- SAFE for existing installations: does not recreate the submissions,
-- date-correction, photo, or administrator tables and retains all records.
alter table public.wsd_community_submissions
  add column if not exists career_stage text not null default 'university',
  add column if not exists school_name text,
  add column if not exists meet_name text;

alter table public.wsd_community_submissions
  drop constraint if exists wsd_race_career_stage_check;
alter table public.wsd_community_submissions
  add constraint wsd_race_career_stage_check check
   (career_stage in ('university','high_school','junior_high','elementary','other'));

alter table public.wsd_community_submissions
  drop constraint if exists wsd_race_school_name_check;
alter table public.wsd_community_submissions
  add constraint wsd_race_school_name_check check
   (school_name is null or
    (length(trim(school_name)) between 2 and 100 and
     school_name !~* '(https?://|www\.)'));

alter table public.wsd_community_submissions
  drop constraint if exists wsd_race_meet_name_check;
alter table public.wsd_community_submissions
  add constraint wsd_race_meet_name_check check
   (meet_name is null or
    (length(trim(meet_name)) between 2 and 120 and
     meet_name !~* '(https?://|www\.)'));

-- Old 2020 floor was too recent for school results of some older athletes.
alter table public.wsd_community_submissions
  drop constraint if exists wsd_date_valid;
alter table public.wsd_community_submissions
  add constraint wsd_date_valid check
   (race_date is null or
    race_date between date '1990-01-01' and current_date+interval '1 day');

-- Public can see the event metadata but cannot see author_id or edit
-- someone else's records. Existing insert/delete RLS policies continue.
grant select (career_stage,school_name,meet_name)
 on public.wsd_community_submissions to anon,authenticated;
grant insert (career_stage,school_name,meet_name)
 on public.wsd_community_submissions to authenticated;

-- Add new historical records using the existing community form:
-- choose career_stage, race_date, event_name, optional meet_name and
-- school_name, result_time and required HTTPS source_url.
-- Authors can DELETE their own submissions; administrators can DELETE any.
-- The baseline 2025 archive and 2026 Word/CSV are not overwritten.
