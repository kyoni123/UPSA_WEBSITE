-- UPSA Supabase draft RLS policies
-- Review only. Do not execute against a live database.

alter table public.user_profiles enable row level security;
alter table public.athletes enable row level security;
alter table public.athlete_name_variants enable row level security;
alter table public.athlete_source_identities enable row level security;
alter table public.athlete_photos enable row level security;
alter table public.seasons enable row level security;
alter table public.divisions enable row level security;
alter table public.ranking_source_records enable row level security;
alter table public.ranking_entries enable row level security;
alter table public.ranking_leg_points enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_results enable row level security;
alter table public.events enable row level security;
alter table public.news_articles enable row level security;
alter table public.athlete_achievements enable row level security;
alter table public.athlete_profile_claims enable row level security;
alter table public.athlete_identity_reviews enable row level security;
alter table public.admin_activity_logs enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.user_athlete_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select athlete_id
  from public.user_profiles
  where id = auth.uid()
    and account_status = 'active';
$$;

revoke execute on function public.user_athlete_id() from public;
grant execute on function public.user_athlete_id() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, role, account_status)
  values (new.id, 'player', 'active')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.prevent_user_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and (
    new.role is distinct from 'player'
    or new.account_status is distinct from 'active'
    or new.athlete_id is distinct from old.athlete_id
  ) then
    raise exception 'Unauthorized profile field change';
  end if;
  return new;
end;
$$;

create trigger prevent_user_profile_escalation
  before update on public.user_profiles
  for each row execute function public.prevent_user_profile_role_escalation();

create or replace function public.assign_admin(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an active administrator can assign an administrator';
  end if;

  update public.user_profiles
  set role = 'admin', updated_at = timezone('utc', now())
  where id = target_profile_id;

  insert into public.admin_activity_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    changes
  )
  values (
    auth.uid(),
    'assign_admin',
    'user_profile',
    target_profile_id,
    jsonb_build_object('role', 'admin')
  );
end;
$$;

revoke execute on function public.assign_admin(uuid) from public;
grant execute on function public.assign_admin(uuid) to authenticated;

-- PUBLIC READ POLICIES
create policy "Public profiles are readable"
  on public.athletes for select
  to anon, authenticated
  using (is_public = true);

create policy "Public name variants are readable"
  on public.athlete_name_variants for select
  to anon, authenticated
  using (exists (
    select 1 from public.athletes
    where athletes.id = athlete_name_variants.athlete_id
      and athletes.is_public = true
  ));

create policy "Public athlete source identities are readable"
  on public.athlete_source_identities for select
  to anon, authenticated
  using (athlete_id is null or exists (
    select 1 from public.athletes
    where athletes.id = athlete_source_identities.athlete_id
      and athletes.is_public = true
  ));

create policy "Public athlete photos are readable"
  on public.athlete_photos for select
  to anon, authenticated
  using (is_verified = true and exists (
    select 1 from public.athletes
    where athletes.id = athlete_photos.athlete_id
      and athletes.is_public = true
  ));

create policy "Public seasons are readable"
  on public.seasons for select
  to anon, authenticated
  using (is_public = true);

create policy "Public divisions are readable"
  on public.divisions for select
  to anon, authenticated
  using (exists (
    select 1 from public.seasons
    where seasons.id = divisions.season_id
      and seasons.is_public = true
  ));

create policy "Public ranking entries are readable"
  on public.ranking_entries for select
  to anon, authenticated
  using (exists (
    select 1 from public.seasons
    where seasons.id = ranking_entries.season_id
      and seasons.is_public = true
  ));

create policy "Public leg points are readable"
  on public.ranking_leg_points for select
  to anon, authenticated
  using (exists (
    select 1 from public.ranking_entries
    join public.seasons on seasons.id = ranking_entries.season_id
    where ranking_entries.id = ranking_leg_points.ranking_entry_id
      and seasons.is_public = true
  ));

create policy "Public achievements are readable"
  on public.athlete_achievements for select
  to anon, authenticated
  using (is_public = true);

create policy "Public competition results are readable"
  on public.competition_results for select
  to anon, authenticated
  using (exists (
    select 1 from public.competitions
    where competitions.id = competition_results.competition_id
      and competitions.publication_status = 'published'
  ));

create policy "Published events are readable"
  on public.events for select
  to anon, authenticated
  using (publication_status = 'published');

create policy "Published news is readable"
  on public.news_articles for select
  to anon, authenticated
  using (publication_status = 'published');

create policy "Public competition records are readable"
  on public.competitions for select
  to anon, authenticated
  using (publication_status = 'published');

create policy "Public source records are readable"
  on public.ranking_source_records for select
  to anon, authenticated
  using (exists (
    select 1 from public.seasons
    where seasons.id = ranking_source_records.season_id
      and seasons.is_public = true
  ));

-- OWN ACCOUNT AND CLAIM POLICIES
create policy "Players can view own profile"
  on public.user_profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Players cannot directly insert profiles"
  on public.user_profiles for insert
  to authenticated
  with check (false);

create policy "Players can update display name"
  on public.user_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'player');

create policy "Players can submit profile claims"
  on public.athlete_profile_claims for insert
  to authenticated
  with check (claimant_user_id = auth.uid());

create policy "Players can view own profile claims"
  on public.athlete_profile_claims for select
  to authenticated
  using (claimant_user_id = auth.uid());

create policy "Players can update own pending profile claims"
  on public.athlete_profile_claims for update
  to authenticated
  using (claimant_user_id = auth.uid() and status = 'pending')
  with check (claimant_user_id = auth.uid() and status = 'pending');

create policy "Players can update permitted own athlete fields"
  on public.athletes for update
  to authenticated
  using (id = public.user_athlete_id())
  with check (id = public.user_athlete_id());

revoke update on public.athletes from authenticated;
grant update (
  profile_photo_path,
  cover_photo_path,
  biography,
  surf_club,
  hometown,
  nationality
) on public.athletes to authenticated;

-- ADMIN POLICIES
create policy "Admins manage user profiles"
  on public.user_profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage athletes"
  on public.athletes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage athlete names"
  on public.athlete_name_variants for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage source identities"
  on public.athlete_source_identities for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage athlete photos"
  on public.athlete_photos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage seasons"
  on public.seasons for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage divisions"
  on public.divisions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage source records"
  on public.ranking_source_records for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage ranking entries"
  on public.ranking_entries for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage leg points"
  on public.ranking_leg_points for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage competitions"
  on public.competitions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage competition results"
  on public.competition_results for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage events"
  on public.events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage news"
  on public.news_articles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage achievements"
  on public.athlete_achievements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins review profile claims"
  on public.athlete_profile_claims for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins review identity records"
  on public.athlete_identity_reviews for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins read activity logs"
  on public.admin_activity_logs for select
  to authenticated
  using (public.is_admin());

create policy "Admins insert activity logs"
  on public.admin_activity_logs for insert
  to authenticated
  with check (public.is_admin());
