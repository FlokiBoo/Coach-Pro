-- Coller ce SQL dans l'éditeur SQL de ton projet Supabase

-- Sportifs
create table athletes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token text unique not null default encode(gen_random_bytes(12), 'hex'),
  email text,
  notes text,
  created_at timestamptz default now()
);

-- Séances (programme d'un jour pour un sportif)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) on delete cascade not null,
  date date not null,
  title text,
  coach_notes text,
  created_at timestamptz default now(),
  unique(athlete_id, date)
);

-- Exercices dans une séance
create table exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  order_index integer not null default 0,
  name text not null,
  sets integer,
  reps text,
  kg numeric(6,2),
  note text
);

-- Accès public en lecture sur les séances/exercices via token
alter table athletes enable row level security;
alter table sessions enable row level security;
alter table exercises enable row level security;

-- Tout le monde peut lire (coach + sportif via lien)
create policy "lecture publique athletes" on athletes for select using (true);
create policy "lecture publique sessions" on sessions for select using (true);
create policy "lecture publique exercises" on exercises for select using (true);

-- Seul le service role peut écrire (via les API routes Next.js)
-- Pour simplifier en dev : on autorise tout en écriture aussi
create policy "ecriture athletes" on athletes for all using (true);
create policy "ecriture sessions" on sessions for all using (true);
create policy "ecriture exercises" on exercises for all using (true);
