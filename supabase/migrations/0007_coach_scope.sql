-- Reactive App · cada profe ve solo lo suyo (cambia la regla de 0002: antes el staff veía todo)
--
-- · Profe: sus clientes (coach_id = él) y lo que cuelga de ellos: rutinas, días/bloques/ítems, sesiones,
--   checks, vistas y observaciones; y las solicitudes de acceso que lo eligieron.
-- · Compartido: ejercicios y videos (sin cambios) y plantillas (las lee cualquier profe; las edita o
--   borra su autor o el admin).
-- · Admin: todo. Es el único que reasigna clientes y el que ve las solicitudes sin profe elegido.
-- · Autor: routines.created_by lo fija la base con el usuario logueado (se ignora lo que mande el
--   cliente). Cada edición deja updated_by / updated_at → «Cargada por X · editada por Y».
-- Las mismas reglas, en TypeScript: lib/access/scope.ts (las usa el mock).

-- ── autor / editor de rutinas ────────────────────────────────────
alter table public.routines
  add column updated_by uuid references public.profiles (id) on delete set null,
  add column updated_at timestamptz;

create or replace function public.stamp_routine_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Con service role (seed, scripts) no hay auth.uid(): se respeta lo que venga.
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := null;
    new.updated_at := null;
  else
    new.created_by := old.created_by; -- el autor no se cambia nunca
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger routines_stamp_author before insert or update on public.routines
  for each row execute function public.stamp_routine_author();

-- ── helpers (security definer: sin recursión en las políticas) ───
-- ¿El usuario actual es el profe de este cliente (o admin)?
create or replace function public.can_manage_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
      or (public.is_staff() and exists (
            select 1 from public.profiles c
            where c.id = p_client_id and c.role = 'client' and c.coach_id = auth.uid()
          ))
$$;

-- Leer una rutina: admin; profe → plantillas, sus borradores y las de sus clientes; cliente → las suyas publicadas.
create or replace function public.can_read_routine(p_routine_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id
      and (
        public.is_admin()
        or (public.is_staff() and (
              r.is_template
              or (r.client_id is null and r.created_by = auth.uid())
              or public.can_manage_client(r.client_id)
            ))
        or (r.client_id = auth.uid() and r.published_at is not null)
      )
  )
$$;

-- Editar una rutina: admin; profe → sus plantillas/borradores y las rutinas de sus clientes.
create or replace function public.can_edit_routine(p_routine_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id
      and (
        public.is_admin()
        or (public.is_staff() and (
              ((r.is_template or r.client_id is null) and r.created_by = auth.uid())
              or (not r.is_template and public.can_manage_client(r.client_id))
            ))
      )
  )
$$;

create or replace function public.routine_of_day(p_day_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select routine_id from public.routine_days where id = p_day_id $$;

create or replace function public.routine_of_block(p_block_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select d.routine_id from public.routine_blocks b join public.routine_days d on d.id = b.day_id where b.id = p_block_id $$;

create or replace function public.client_of_session(p_session_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select client_id from public.workout_sessions where id = p_session_id $$;

grant execute on function public.can_manage_client(uuid), public.can_read_routine(uuid), public.can_edit_routine(uuid),
  public.routine_of_day(uuid), public.routine_of_block(uuid), public.client_of_session(uuid) to authenticated;

-- ── profiles ─────────────────────────────────────────────────────
drop policy "profiles: leer" on public.profiles;
drop policy "profiles: staff crea clientes, admin crea todo" on public.profiles;
drop policy "profiles: staff edita clientes y su propio perfil, admin todo" on public.profiles;
drop policy "profiles: staff borra clientes, admin todo" on public.profiles;

-- Perfiles de profes/admins: públicos para los logueados (el cliente ve a su profe).
create policy "profiles: leer" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or role in ('coach', 'admin')
    or public.is_admin()
    or (public.is_staff() and role = 'client' and coach_id = auth.uid())
  );
-- El profe crea clientes para sí mismo; el admin, para cualquiera.
create policy "profiles: alta" on public.profiles for insert to authenticated
  with check (public.is_admin() or (public.is_staff() and role = 'client' and coach_id = auth.uid()));
-- El profe edita su perfil y el de sus clientes (sin poder pasarlos a otro: coach_id sigue siendo él).
create policy "profiles: editar" on public.profiles for update to authenticated
  using (public.is_admin() or (public.is_staff() and (id = auth.uid() or (role = 'client' and coach_id = auth.uid()))))
  with check (public.is_admin() or (public.is_staff() and (id = auth.uid() or (role = 'client' and coach_id = auth.uid()))));
create policy "profiles: borrar" on public.profiles for delete to authenticated
  using (public.is_admin() or (public.is_staff() and role = 'client' and coach_id = auth.uid()));

-- ── coach_notes ──────────────────────────────────────────────────
drop policy "coach_notes: solo staff" on public.coach_notes;
create policy "coach_notes: profe del cliente o admin" on public.coach_notes for all to authenticated
  using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

-- ── rutinas y su árbol ───────────────────────────────────────────
drop policy "routines: staff o dueño" on public.routines;
drop policy "routines: staff escribe" on public.routines;
create policy "routines: leer" on public.routines for select to authenticated
  using (
    public.is_admin()
    or (public.is_staff() and (is_template or (client_id is null and created_by = auth.uid()) or public.can_manage_client(client_id)))
    or (client_id = auth.uid() and published_at is not null)
  );
-- Alta: plantillas y borradores de cualquier profe; rutinas solo para sus clientes.
create policy "routines: alta" on public.routines for insert to authenticated
  with check (public.is_admin() or (public.is_staff() and (client_id is null or public.can_manage_client(client_id))));
create policy "routines: editar" on public.routines for update to authenticated
  using (public.can_edit_routine(id))
  with check (public.is_admin() or (public.is_staff() and (client_id is null or public.can_manage_client(client_id))));
create policy "routines: borrar" on public.routines for delete to authenticated
  using (public.can_edit_routine(id));

drop policy "routine_days: staff o dueño" on public.routine_days;
drop policy "routine_days: staff escribe" on public.routine_days;
create policy "routine_days: leer" on public.routine_days for select to authenticated
  using (public.can_read_routine(routine_id));
create policy "routine_days: escribir" on public.routine_days for all to authenticated
  using (public.can_edit_routine(routine_id)) with check (public.can_edit_routine(routine_id));

drop policy "routine_blocks: staff o dueño" on public.routine_blocks;
drop policy "routine_blocks: staff escribe" on public.routine_blocks;
create policy "routine_blocks: leer" on public.routine_blocks for select to authenticated
  using (public.can_read_routine(public.routine_of_day(day_id)));
create policy "routine_blocks: escribir" on public.routine_blocks for all to authenticated
  using (public.can_edit_routine(public.routine_of_day(day_id))) with check (public.can_edit_routine(public.routine_of_day(day_id)));

drop policy "routine_items: staff o dueño" on public.routine_items;
drop policy "routine_items: staff escribe" on public.routine_items;
create policy "routine_items: leer" on public.routine_items for select to authenticated
  using (public.can_read_routine(public.routine_of_block(block_id)));
create policy "routine_items: escribir" on public.routine_items for all to authenticated
  using (public.can_edit_routine(public.routine_of_block(block_id))) with check (public.can_edit_routine(public.routine_of_block(block_id)));

-- ── registro de entrenamiento ────────────────────────────────────
drop policy "workout_sessions: leer" on public.workout_sessions;
drop policy "workout_sessions: borrar" on public.workout_sessions;
create policy "workout_sessions: leer" on public.workout_sessions for select to authenticated
  using (client_id = auth.uid() or public.can_manage_client(client_id));
create policy "workout_sessions: borrar" on public.workout_sessions for delete to authenticated
  using (client_id = auth.uid() or public.can_manage_client(client_id));

drop policy "item_checks: leer" on public.item_checks;
create policy "item_checks: leer" on public.item_checks for select to authenticated
  using (
    public.client_of_session(session_id) = auth.uid()
    or public.can_manage_client(public.client_of_session(session_id))
  );

drop policy "exercise_views: leer" on public.exercise_views;
create policy "exercise_views: leer" on public.exercise_views for select to authenticated
  using (client_id = auth.uid() or public.can_manage_client(client_id));

-- ── solicitudes de acceso ────────────────────────────────────────
-- El profe ve y revisa las que lo eligieron; el admin, todas (incluidas las «Todavía no tengo»).
drop policy "access_requests: staff lee" on public.access_requests;
drop policy "access_requests: staff revisa" on public.access_requests;
create policy "access_requests: leer" on public.access_requests for select to authenticated
  using (public.is_admin() or (public.is_staff() and requested_coach_id = auth.uid()));
create policy "access_requests: revisar" on public.access_requests for update to authenticated
  using (public.is_admin() or (public.is_staff() and requested_coach_id = auth.uid()))
  with check (public.is_admin() or (public.is_staff() and requested_coach_id = auth.uid()));
