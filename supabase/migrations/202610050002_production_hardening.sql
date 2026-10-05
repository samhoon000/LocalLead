create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

alter table public.schema_migrations enable row level security;

create unique index if not exists discovery_jobs_search_unique_idx on public.discovery_jobs(search_id);
create index if not exists discovery_jobs_user_idx on public.discovery_jobs(user_id);
create index if not exists businesses_user_idx on public.businesses(user_id);
create index if not exists website_analyses_user_idx on public.website_analyses(user_id);
create index if not exists lead_scores_user_idx on public.lead_scores(user_id);
create index if not exists lead_notes_user_idx on public.lead_notes(user_id);
create index if not exists job_events_user_idx on public.job_events(user_id);

drop policy if exists "jobs_owner" on public.discovery_jobs;
create policy "jobs_owner" on public.discovery_jobs for all
using (user_id = auth.uid() and exists (select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid()))
with check (user_id = auth.uid() and exists (select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid()));

drop policy if exists "businesses_owner" on public.businesses;
create policy "businesses_owner" on public.businesses for all
using (user_id = auth.uid() and exists (select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid()))
with check (user_id = auth.uid() and exists (select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid()));

drop policy if exists "analyses_owner" on public.website_analyses;
create policy "analyses_owner" on public.website_analyses for all
using (user_id = auth.uid() and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (user_id = auth.uid() and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

drop policy if exists "scores_owner" on public.lead_scores;
create policy "scores_owner" on public.lead_scores for all
using (user_id = auth.uid() and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (user_id = auth.uid() and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

drop policy if exists "notes_owner" on public.lead_notes;
create policy "notes_owner" on public.lead_notes for all
using (user_id = auth.uid() and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
with check (user_id = auth.uid() and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

drop policy if exists "events_owner" on public.job_events;
create policy "events_owner" on public.job_events for all
using (user_id = auth.uid() and exists (select 1 from public.discovery_jobs j where j.id = job_id and j.user_id = auth.uid()))
with check (user_id = auth.uid() and exists (select 1 from public.discovery_jobs j where j.id = job_id and j.user_id = auth.uid()));

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists searches_set_updated_at on public.searches;
create trigger searches_set_updated_at before update on public.searches for each row execute function public.set_updated_at();
drop trigger if exists discovery_jobs_set_updated_at on public.discovery_jobs;
create trigger discovery_jobs_set_updated_at before update on public.discovery_jobs for each row execute function public.set_updated_at();
drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses for each row execute function public.set_updated_at();
drop trigger if exists lead_scores_set_updated_at on public.lead_scores;
create trigger lead_scores_set_updated_at before update on public.lead_scores for each row execute function public.set_updated_at();
drop trigger if exists lead_notes_set_updated_at on public.lead_notes;
create trigger lead_notes_set_updated_at before update on public.lead_notes for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
