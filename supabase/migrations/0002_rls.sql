-- Reactive App · Row Level Security
-- Cliente: lee su perfil, sus rutinas publicadas (con días, bloques e ítems) y todos los ejercicios;
--          escribe solo sus sesiones, checks y vistas. NUNCA ve coach_notes.
-- Coach y admin: leen y escriben todo. Solo el admin gestiona profes/admins.

-- ── Helpers (security definer para evitar recursión en las políticas) ──
create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role in ('coach', 'admin') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- ¿El usuario actual (cliente) puede leer esta rutina?
create or replace function public.client_owns_routine(p_routine_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id and r.client_id = auth.uid() and r.published_at is not null
  )
$$;

create or replace function public.client_owns_day(p_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.routine_days d
    join public.routines r on r.id = d.routine_id
    where d.id = p_day_id and r.client_id = auth.uid() and r.published_at is not null
  )
$$;

create or replace function public.client_owns_block(p_block_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.routine_blocks b
    join public.routine_days d on d.id = b.day_id
    join public.routines r on r.id = d.routine_id
    where b.id = p_block_id and r.client_id = auth.uid() and r.published_at is not null
  )
$$;

-- Solo un admin puede cambiar roles o crear/editar profes y admins.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Llamadas con service role (server actions) no tienen auth.uid(): se permiten.
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Solo un admin puede cambiar roles' using errcode = '42501';
  end if;
  if new.role in ('coach', 'admin') and not public.is_admin() and new.id <> auth.uid() then
    raise exception 'Solo un admin gestiona profes' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_role before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

alter table public.profiles         enable row level security;
alter table public.coach_notes      enable row level security;
alter table public.exercises        enable row level security;
alter table public.routines         enable row level security;
alter table public.routine_days     enable row level security;
alter table public.routine_blocks   enable row level security;
alter table public.routine_items    enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.item_checks      enable row level security;
alter table public.exercise_views   enable row level security;

-- ── profiles ─────────────────────────────────────────────────────
-- El cliente lee su fila y las de profes/admins (para mostrar «Nico R. · Kinesiólogo»).
create policy "profiles: leer" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff() or role in ('coach', 'admin'));
create policy "profiles: staff crea clientes, admin crea todo" on public.profiles for insert to authenticated
  with check (public.is_admin() or (public.is_staff() and role = 'client'));
create policy "profiles: staff edita clientes y su propio perfil, admin todo" on public.profiles for update to authenticated
  using (public.is_admin() or (public.is_staff() and (role = 'client' or id = auth.uid())))
  with check (public.is_admin() or (public.is_staff() and (role = 'client' or id = auth.uid())));
create policy "profiles: staff borra clientes, admin todo" on public.profiles for delete to authenticated
  using (public.is_admin() or (public.is_staff() and role = 'client'));

-- ── coach_notes (solo profes) ────────────────────────────────────
create policy "coach_notes: solo staff" on public.coach_notes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── exercises ────────────────────────────────────────────────────
create policy "exercises: leer logueados" on public.exercises for select to authenticated using (true);
create policy "exercises: staff crea" on public.exercises for insert to authenticated with check (public.is_staff());
create policy "exercises: staff edita" on public.exercises for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "exercises: staff borra" on public.exercises for delete to authenticated using (public.is_staff());

-- ── rutinas y su árbol ───────────────────────────────────────────
create policy "routines: staff o dueño" on public.routines for select to authenticated
  using (public.is_staff() or (client_id = auth.uid() and published_at is not null));
create policy "routines: staff escribe" on public.routines for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "routine_days: staff o dueño" on public.routine_days for select to authenticated
  using (public.is_staff() or public.client_owns_routine(routine_id));
create policy "routine_days: staff escribe" on public.routine_days for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "routine_blocks: staff o dueño" on public.routine_blocks for select to authenticated
  using (public.is_staff() or public.client_owns_day(day_id));
create policy "routine_blocks: staff escribe" on public.routine_blocks for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "routine_items: staff o dueño" on public.routine_items for select to authenticated
  using (public.is_staff() or public.client_owns_block(block_id));
create policy "routine_items: staff escribe" on public.routine_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── registro de entrenamiento (el cliente escribe lo suyo) ───────
create policy "workout_sessions: leer" on public.workout_sessions for select to authenticated
  using (public.is_staff() or client_id = auth.uid());
create policy "workout_sessions: cliente crea" on public.workout_sessions for insert to authenticated
  with check (client_id = auth.uid() and public.client_owns_routine(routine_id));
create policy "workout_sessions: cliente actualiza" on public.workout_sessions for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "workout_sessions: borrar" on public.workout_sessions for delete to authenticated
  using (public.is_staff() or client_id = auth.uid());

create policy "item_checks: leer" on public.item_checks for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.workout_sessions s where s.id = session_id and s.client_id = auth.uid())
  );
create policy "item_checks: cliente marca" on public.item_checks for insert to authenticated
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.client_id = auth.uid()));
create policy "item_checks: cliente actualiza" on public.item_checks for update to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.client_id = auth.uid()));
create policy "item_checks: cliente desmarca" on public.item_checks for delete to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.client_id = auth.uid()));

create policy "exercise_views: leer" on public.exercise_views for select to authenticated
  using (public.is_staff() or client_id = auth.uid());
create policy "exercise_views: cliente registra" on public.exercise_views for insert to authenticated
  with check (client_id = auth.uid());
