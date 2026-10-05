create extension if not exists "pgcrypto";

create type public.job_status as enum ('queued','discovering','enriching','analyzing','scoring','completed','failed','cancelled');
create type public.website_status as enum ('unknown','has_website','no_website','uncertain');
create type public.lead_status as enum ('new','contacted','interested','not_interested','converted');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  country text not null,
  state text,
  city text not null,
  category text not null,
  raw_query text not null,
  result_count integer not null check (result_count between 1 and 500),
  status public.job_status not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.search_filters (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null unique references public.searches(id) on delete cascade,
  minimum_rating numeric(2,1) check (minimum_rating between 0 and 5),
  minimum_reviews integer check (minimum_reviews >= 0),
  website_status text not null default 'any' check (website_status in ('any','no_website','has_website')),
  business_status text not null default 'open' check (business_status in ('open','any')),
  radius_km numeric check (radius_km between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.job_status not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  processed integer not null default 0 check (processed >= 0),
  total integer not null default 0 check (total >= 0),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_business_id text not null,
  name text not null,
  category text not null,
  subcategory text,
  country text not null,
  state text,
  city text not null,
  postal_code text,
  address text not null,
  latitude double precision,
  longitude double precision,
  phone text,
  email text,
  maps_url text,
  provider_url text,
  rating numeric(2,1) check (rating between 0 and 5),
  review_count integer check (review_count >= 0),
  price_level text,
  opening_hours jsonb,
  business_status text not null default 'unknown',
  website_url text,
  website_domain text,
  website_status public.website_status not null default 'unknown',
  website_checked_at timestamptz,
  website_quality_score integer check (website_quality_score between 0 and 100),
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  lead_status public.lead_status not null default 'new',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (search_id, provider, provider_business_id)
);

create table public.website_analyses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quality_score integer not null check (quality_score between 0 and 100),
  https_enabled boolean not null default false,
  mobile_friendly boolean not null default false,
  has_contact_form boolean not null default false,
  has_booking boolean not null default false,
  has_clear_cta boolean not null default false,
  has_social_links boolean not null default false,
  issues jsonb not null default '[]'::jsonb,
  raw_result jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create table public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  classification text not null,
  factors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.discovery_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage public.job_status not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index businesses_search_id_idx on public.businesses(search_id);
create index businesses_website_status_idx on public.businesses(website_status);
create index businesses_lead_score_idx on public.businesses(lead_score desc);
create index businesses_city_idx on public.businesses(city);
create index businesses_country_idx on public.businesses(country);
create index businesses_category_idx on public.businesses(category);
create index businesses_provider_id_idx on public.businesses(provider, provider_business_id);
create index searches_user_created_idx on public.searches(user_id, created_at desc);
create index discovery_jobs_search_idx on public.discovery_jobs(search_id);
create index job_events_job_created_idx on public.job_events(job_id, created_at);

alter table public.profiles enable row level security;
alter table public.searches enable row level security;
alter table public.search_filters enable row level security;
alter table public.discovery_jobs enable row level security;
alter table public.businesses enable row level security;
alter table public.website_analyses enable row level security;
alter table public.lead_scores enable row level security;
alter table public.lead_notes enable row level security;
alter table public.job_events enable row level security;

create policy "profiles_owner" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "searches_owner" on public.searches for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "filters_owner" on public.search_filters for all using (exists (select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid())) with check (exists (select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid()));
create policy "jobs_owner" on public.discovery_jobs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "businesses_owner" on public.businesses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "analyses_owner" on public.website_analyses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scores_owner" on public.lead_scores for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notes_owner" on public.lead_notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "events_owner" on public.job_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))); return new; end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
