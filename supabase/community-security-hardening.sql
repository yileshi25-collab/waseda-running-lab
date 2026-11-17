-- Incremental privilege hardening; no rows or storage objects are changed.
revoke truncate, references, trigger on public.wsd_event_news, public.wsd_athlete_basic_profiles from public, anon, authenticated;
revoke insert, update, delete on public.wsd_event_news from public, anon;
-- Keep ownership and archival identity immutable through the browser API.
revoke update on public.wsd_event_news from authenticated;
grant update (title, summary, published_at, category, source_url, athlete_names) on public.wsd_event_news to authenticated;
revoke execute on function public.wsd_can_upload_photo() from public, anon;
grant execute on function public.wsd_can_upload_photo() to authenticated;
