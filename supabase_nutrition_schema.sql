-- Coller ce SQL dans l'éditeur SQL de ton projet Supabase
-- (Settings > SQL Editor > New query) pour créer les tables Nutrition.

-- Aliments
create table if not exists aliments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kcal_100g numeric(6,1),
  proteines_100g numeric(5,1),
  glucides_100g numeric(5,1),
  lipides_100g numeric(5,1),
  coach_id uuid,
  created_at timestamptz default now()
);

-- Recettes
create table if not exists recettes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  kcal numeric(6,1),
  proteines numeric(5,1),
  glucides numeric(5,1),
  lipides numeric(5,1),
  coach_id uuid,
  created_at timestamptz default now()
);

-- Plans nutritionnels
create table if not exists nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  athlete_id uuid references athletes(id) on delete set null,
  target_kcal numeric(6,1),
  target_proteines numeric(5,1),
  coach_id uuid,
  created_at timestamptz default now()
);

alter table aliments enable row level security;
alter table recettes enable row level security;
alter table nutrition_plans enable row level security;

create policy "lecture publique aliments" on aliments for select using (true);
create policy "ecriture aliments" on aliments for all using (true);

create policy "lecture publique recettes" on recettes for select using (true);
create policy "ecriture recettes" on recettes for all using (true);

create policy "lecture publique nutrition_plans" on nutrition_plans for select using (true);
create policy "ecriture nutrition_plans" on nutrition_plans for all using (true);
