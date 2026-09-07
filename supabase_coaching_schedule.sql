-- Planification du "coaching de demain" (Dashboard).
-- Ce fichier n'est PAS exécuté automatiquement : il n'y a pas d'environnement
-- de staging ni de pipeline de migration dans ce repo (voir CLAUDE.md). À lancer
-- une fois, à la main, dans le SQL Editor du projet Supabase de prod.

create table if not exists coaching_schedule (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  program_session_id uuid not null references program_sessions(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now()
);

create index if not exists coaching_schedule_coach_date_idx on coaching_schedule (coach_id, date);

alter table coaching_schedule enable row level security;

-- owns_athlete_coach(athlete_id) est la fonction SECURITY DEFINER partagée du projet
-- (cf. CLAUDE.md) : ne pas inliner de sous-requête EXISTS sur coaches ici, ça
-- redéclencherait sa propre RLS et pourrait provoquer une récursion infinie.
create policy "coach reads own coaching_schedule"
  on coaching_schedule for select
  using (owns_athlete_coach(athlete_id));

create policy "coach inserts own coaching_schedule"
  on coaching_schedule for insert
  with check (owns_athlete_coach(athlete_id) and coach_id = auth.uid());

create policy "coach deletes own coaching_schedule"
  on coaching_schedule for delete
  using (owns_athlete_coach(athlete_id));
