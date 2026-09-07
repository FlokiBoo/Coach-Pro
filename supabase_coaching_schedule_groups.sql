-- Étend coaching_schedule (voir supabase_coaching_schedule.sql) pour permettre de planifier un
-- coaching de groupe, en plus d'un coaching individuel.
-- Ce fichier n'est PAS exécuté automatiquement : à lancer une fois, à la main, dans le SQL Editor
-- du projet Supabase de prod (voir CLAUDE.md — pas de pipeline de migration dans ce repo).

alter table coaching_schedule alter column athlete_id drop not null;

alter table coaching_schedule add column if not exists group_id uuid references groups(id) on delete cascade;

alter table coaching_schedule add constraint coaching_schedule_athlete_or_group_chk
  check (
    (athlete_id is not null and group_id is null)
    or (athlete_id is null and group_id is not null)
  );

-- Remplace les policies existantes : elles ne géraient que le cas athlete_id (not null avant
-- cette migration). EXISTS sur `groups` est sûr (pas de récursion possible, contrairement à un
-- EXISTS sur `coaches` — cf. CLAUDE.md) ; owns_athlete_coach() reste utilisé pour le cas sportif.
drop policy if exists "coach reads own coaching_schedule" on coaching_schedule;
drop policy if exists "coach inserts own coaching_schedule" on coaching_schedule;
drop policy if exists "coach deletes own coaching_schedule" on coaching_schedule;

create policy "coach reads own coaching_schedule"
  on coaching_schedule for select
  using (
    (athlete_id is not null and owns_athlete_coach(athlete_id))
    or (group_id is not null and exists (select 1 from groups where groups.id = coaching_schedule.group_id and groups.coach_id = auth.uid()))
  );

create policy "coach inserts own coaching_schedule"
  on coaching_schedule for insert
  with check (
    coach_id = auth.uid()
    and (
      (athlete_id is not null and owns_athlete_coach(athlete_id))
      or (group_id is not null and exists (select 1 from groups where groups.id = coaching_schedule.group_id and groups.coach_id = auth.uid()))
    )
  );

create policy "coach deletes own coaching_schedule"
  on coaching_schedule for delete
  using (
    (athlete_id is not null and owns_athlete_coach(athlete_id))
    or (group_id is not null and exists (select 1 from groups where groups.id = coaching_schedule.group_id and groups.coach_id = auth.uid()))
  );
