-- UPSA Supabase draft migration
-- Review only. Do not execute against a live database.

create type public.app_role as enum ('player', 'admin');
create type public.account_status as enum ('active', 'disabled', 'pending');
create type public.profile_verification_status as enum ('unverified', 'provisional', 'verified');
create type public.identity_review_status as enum ('pending', 'approved', 'rejected', 'needs_evidence');
create type public.claim_status as enum ('pending', 'approved', 'rejected');
create type public.publication_status as enum ('draft', 'published', 'archived');

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'player',
  account_status public.account_status not null default 'active',
  athlete_id uuid,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  source_athlete_id text,
  official_name text not null,
  profile_photo_path text,
  cover_photo_path text,
  biography text,
  surf_club text,
  hometown text,
  nationality text,
  verification_status public.profile_verification_status not null default 'unverified',
  is_public boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_profiles
  add constraint user_profiles_athlete_fk
  foreign key (athlete_id) references public.athletes(id) on delete set null;

create unique index athletes_source_athlete_id_uidx
  on public.athletes(source_athlete_id)
  where source_athlete_id is not null;

create table public.athlete_name_variants (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  source_year integer,
  is_official boolean not null default false,
  verification_status public.profile_verification_status not null default 'unverified',
  created_at timestamptz not null default timezone('utc', now()),
  unique (athlete_id, normalized_name)
);

create table public.athlete_source_identities (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete set null,
  source_type text not null default 'ranking',
  source_athlete_id text,
  source_name text not null,
  normalized_source_name text not null,
  season_year integer,
  division_source_title text,
  source_row_index integer,
  match_status text not null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.user_profiles(id),
  review_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  check (match_status in (
    'source-id',
    'exact-name',
    'exact-name-provisional',
    'conflicting-id',
    'duplicate-name',
    'name-only',
    'manual-review'
  ))
);

create table public.athlete_photos (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  photo_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  is_verified boolean not null default false,
  alt_text text,
  source_url text,
  created_at timestamptz not null default timezone('utc', now()),
  check (photo_type in ('profile', 'cover', 'gallery')),
  unique (athlete_id, photo_type, storage_path)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  title text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  source_title text not null,
  normalized_key text not null,
  display_name text not null,
  sort_order integer,
  created_at timestamptz not null default timezone('utc', now()),
  unique (season_id, normalized_key)
);

create table public.ranking_source_records (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id),
  division_id uuid not null references public.divisions(id),
  source_year integer not null,
  source_category_title text not null,
  source_category_index integer not null,
  source_row_index integer not null,
  source_headers jsonb not null,
  source_row jsonb not null,
  source_hash text not null,
  imported_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (season_id, division_id, source_row_index),
  unique (source_hash)
);

create table public.ranking_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete set null,
  season_id uuid not null references public.seasons(id),
  division_id uuid not null references public.divisions(id),
  source_record_id uuid not null references public.ranking_source_records(id) on delete cascade,
  source_name text not null,
  source_athlete_id text,
  rank_value numeric,
  rank_label text,
  total_points numeric,
  total_points_label text,
  carryover_points numeric,
  identity_match_status text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (source_record_id)
);

create table public.ranking_leg_points (
  id uuid primary key default gen_random_uuid(),
  ranking_entry_id uuid not null references public.ranking_entries(id) on delete cascade,
  leg_label text not null,
  leg_number integer,
  points numeric,
  source_value text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (ranking_entry_id, leg_label)
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id),
  name text not null,
  description text,
  location text,
  start_date date,
  end_date date,
  category text,
  featured_image_path text,
  publication_status public.publication_status not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.competition_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  division_id uuid references public.divisions(id),
  placement integer,
  points numeric,
  result_date date,
  source_url text,
  source_note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  location text,
  start_date date,
  end_date date,
  category text,
  featured_image_path text,
  publication_status public.publication_status not null default 'draft',
  external_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  content text,
  featured_image_path text,
  category text,
  author_profile_id uuid references public.user_profiles(id),
  author_name text,
  published_at timestamptz,
  publication_status public.publication_status not null default 'draft',
  external_source_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.athlete_achievements (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  achievement_type text not null,
  title text not null,
  description text,
  ranking_entry_id uuid references public.ranking_entries(id),
  competition_result_id uuid references public.competition_results(id),
  season_year integer,
  source_note text,
  is_public boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  check (ranking_entry_id is not null or competition_result_id is not null)
);

create table public.athlete_profile_claims (
  id uuid primary key default gen_random_uuid(),
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  status public.claim_status not null default 'pending',
  requested_name text,
  evidence text,
  reviewed_by uuid references public.user_profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.athlete_identity_reviews (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete set null,
  source_identity_id uuid references public.athlete_source_identities(id) on delete set null,
  status public.identity_review_status not null default 'pending',
  reason text,
  evidence text,
  reviewed_by uuid references public.user_profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.user_profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  changes jsonb,
  ip_address inet,
  created_at timestamptz not null default timezone('utc', now())
);

create index ranking_entries_season_idx on public.ranking_entries(season_id);
create index ranking_entries_athlete_idx on public.ranking_entries(athlete_id);
create index ranking_entries_division_idx on public.ranking_entries(division_id);
create index source_identities_source_id_idx on public.athlete_source_identities(source_athlete_id);
create index source_identities_normalized_name_idx on public.athlete_source_identities(normalized_source_name);
create index events_publication_idx on public.events(publication_status, start_date);
create index news_publication_idx on public.news_articles(publication_status, published_at);
