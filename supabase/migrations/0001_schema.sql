-- Reactive App · esquema base
-- Tablas: profiles, coach_notes, exercises, routines, routine_days, routine_blocks,
--         routine_items, workout_sessions, item_checks, exercise_views

create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ── Enums ─────────────────────────────────────────────────────────
create type public.user_role as enum ('admin', 'coach', 'client');
create type public.case_type as enum ('lesion_deportiva', 'postquirurgico', 'dolor_cronico', 'rendimiento');
create type public.exercise_category as enum ('Fuerza', 'Activación', 'Movilidad', 'Potencia', 'Agilidad', 'Core');

-- Normalización igual a lib/text.ts (minúsculas, sin acentos, sin puntuación).
create or replace function public.normalize_name(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))), '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Perfiles ──────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.user_role not null default 'client',
  full_name    text not null,
  email        text,
  phone        text,
  title        text,                         -- profes: «Kinesiólogo deportivo»
  sport        text,
  case_type    public.case_type,
  case_detail  text,                         -- «LCA Fase 3», «Lumbalgia»
  goal         text,
  coach_id     uuid references public.profiles (id) on delete set null,
  client_since date,
  created_at   timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_coach_idx on public.profiles (coach_id);

-- Observaciones del profesional: SOLO profes (ver RLS).
create table public.coach_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index coach_notes_client_idx on public.coach_notes (client_id, created_at desc);

-- ── Ejercicios ────────────────────────────────────────────────────
create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(trim(name)) > 0),
  name_normalized   text generated always as (public.normalize_name(name)) stored,
  aliases           text[] not null default '{}',
  category          public.exercise_category not null default 'Fuerza',
  muscle_groups     text[] not null default '{}',
  equipment         text,
  video_path        text,         -- archivo en el bucket exercise-videos (video PRINCIPAL)
  video_poster_path text,         -- miniatura
  video_duration_s  integer check (video_duration_s is null or video_duration_s >= 0),
  youtube_url       text,         -- opcional, complementario
  technique_cues    text[] not null default '{}',
  common_mistakes   text[] not null default '{}',
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index exercises_name_normalized_key on public.exercises (name_normalized);
create trigger exercises_touch before update on public.exercises
  for each row execute function public.touch_updated_at();

-- ── Rutinas ───────────────────────────────────────────────────────
create table public.routines (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  client_id          uuid references public.profiles (id) on delete cascade, -- null si es plantilla
  is_template        boolean not null default false,
  source_template_id uuid references public.routines (id) on delete set null,
  starts_on          date,
  ends_on            date,
  days_per_week      smallint not null default 3 check (days_per_week between 1 and 7),
  client_message     text,          -- «Nota del profe»
  created_by         uuid references public.profiles (id) on delete set null,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  constraint routines_dates_chk check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint routines_template_chk check (not is_template or client_id is null)
);
create index routines_client_idx on public.routines (client_id, starts_on desc);

create table public.routine_days (
  id         uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  label      text not null,          -- A, B, C…
  title      text not null default '',
  position   smallint not null default 0
);
create index routine_days_routine_idx on public.routine_days (routine_id, position);

create table public.routine_blocks (
  id       uuid primary key default gen_random_uuid(),
  day_id   uuid not null references public.routine_days (id) on delete cascade,
  name     text not null,            -- Entrada en calor / Bloque principal / …
  position smallint not null default 0
);
create index routine_blocks_day_idx on public.routine_blocks (day_id, position);

create table public.routine_items (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid not null references public.routine_blocks (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  raw_name    text not null,         -- nombre tal como vino del Excel / carga
  position    smallint not null default 0,
  sets        smallint check (sets is null or sets > 0),
  reps        text,                  -- «8», «45 s c/lado»
  load        text,
  rest        text,
  tempo       text,
  notes       text
);
create index routine_items_block_idx on public.routine_items (block_id, position);
create index routine_items_exercise_idx on public.routine_items (exercise_id);

-- Estado calculado (no se guarda): activa / por vencer (≤ 7 días) / vencida.
create view public.routines_with_status
with (security_invoker = true) as
select
  r.*,
  case
    when r.is_template then 'plantilla'
    when r.published_at is null then 'borrador'
    when r.ends_on is not null and r.ends_on < current_date then 'vencida'
    when r.starts_on is not null and r.starts_on > current_date then 'programada'
    when r.ends_on is not null and r.ends_on - current_date <= 7 then 'por_vencer'
    else 'activa'
  end as status
from public.routines r;

-- ── Registro de entrenamiento ─────────────────────────────────────
create table public.workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles (id) on delete cascade,
  routine_id   uuid not null references public.routines (id) on delete cascade,
  day_id       uuid not null references public.routine_days (id) on delete cascade,
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index workout_sessions_client_idx on public.workout_sessions (client_id, started_at desc);
create index workout_sessions_started_idx on public.workout_sessions (started_at desc);

create table public.item_checks (
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  item_id    uuid not null references public.routine_items (id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (session_id, item_id)
);

create table public.exercise_views (
  id          bigint generated always as identity primary key,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  viewed_at   timestamptz not null default now()
);
create index exercise_views_recent_idx on public.exercise_views (viewed_at desc);
create index exercise_views_client_idx on public.exercise_views (client_id, exercise_id);
