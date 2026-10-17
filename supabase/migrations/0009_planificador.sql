-- Reactive App · F8 · Planificador: RPE y RIR objetivo + registro real por serie
--  - routine_items.rpe_target / rir_target: texto para aceptar rangos («7», «7-8», «1-2»).
--  - set_logs: lo que hizo el cliente en cada serie (reps, carga, RPE real 1–10 y comentario).
--    Lo escribe solo el cliente dueño de la sesión; lo leen él, su profe y el admin.

-- ── Objetivos por ejercicio ──────────────────────────────────────
alter table public.routine_items
  add column if not exists rpe_target text check (rpe_target is null or length(rpe_target) <= 20),
  add column if not exists rir_target text check (rir_target is null or length(rir_target) <= 20);

-- save_routine_tree: igual que en 0004, ahora guarda rpe_target y rir_target.
-- Guarda una rutina completa (RoutineTree en JSON, camelCase) de forma atómica.
-- Upsert por id de días/bloques/ítems para conservar el historial de sesiones y checks;
-- lo que ya no viene en el árbol se borra.
create or replace function public.save_routine_tree(p_tree jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id        uuid := coalesce(nullif(p_tree ->> 'id', '')::uuid, gen_random_uuid());
  v_day       jsonb;
  v_block     jsonb;
  v_item      jsonb;
  v_day_id    uuid;
  v_block_id  uuid;
  v_day_ids   uuid[] := '{}';
  v_block_ids uuid[] := '{}';
  v_item_ids  uuid[] := '{}';
  d_pos int := 0;
  b_pos int;
  i_pos int;
begin
  if not public.is_staff() then
    raise exception 'Solo profes pueden guardar rutinas' using errcode = '42501';
  end if;

  insert into public.routines as r (
    id, name, client_id, is_template, source_template_id, starts_on, ends_on,
    days_per_week, client_message, created_by, published_at
  ) values (
    v_id,
    p_tree ->> 'name',
    nullif(p_tree ->> 'clientId', '')::uuid,
    coalesce((p_tree ->> 'isTemplate')::boolean, false),
    nullif(p_tree ->> 'sourceTemplateId', '')::uuid,
    nullif(p_tree ->> 'startsOn', '')::date,
    nullif(p_tree ->> 'endsOn', '')::date,
    greatest(1, least(7, coalesce(nullif(jsonb_array_length(coalesce(p_tree -> 'days', '[]'::jsonb)), 0), (p_tree ->> 'daysPerWeek')::int, 1))),
    nullif(p_tree ->> 'clientMessage', ''),
    coalesce(nullif(p_tree ->> 'createdBy', '')::uuid, auth.uid()),
    nullif(p_tree ->> 'publishedAt', '')::timestamptz
  )
  on conflict (id) do update set
    name = excluded.name,
    client_id = excluded.client_id,
    is_template = excluded.is_template,
    source_template_id = excluded.source_template_id,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    days_per_week = excluded.days_per_week,
    client_message = excluded.client_message,
    published_at = excluded.published_at;

  for v_day in select * from jsonb_array_elements(coalesce(p_tree -> 'days', '[]'::jsonb)) loop
    v_day_id := coalesce(nullif(v_day ->> 'id', '')::uuid, gen_random_uuid());
    v_day_ids := v_day_ids || v_day_id;
    insert into public.routine_days (id, routine_id, label, title, position)
    values (v_day_id, v_id, v_day ->> 'label', coalesce(v_day ->> 'title', ''), d_pos)
    on conflict (id) do update set label = excluded.label, title = excluded.title, position = excluded.position;
    d_pos := d_pos + 1;

    b_pos := 0;
    for v_block in select * from jsonb_array_elements(coalesce(v_day -> 'blocks', '[]'::jsonb)) loop
      v_block_id := coalesce(nullif(v_block ->> 'id', '')::uuid, gen_random_uuid());
      v_block_ids := v_block_ids || v_block_id;
      insert into public.routine_blocks (id, day_id, name, position)
      values (v_block_id, v_day_id, v_block ->> 'name', b_pos)
      on conflict (id) do update set day_id = excluded.day_id, name = excluded.name, position = excluded.position;
      b_pos := b_pos + 1;

      i_pos := 0;
      for v_item in select * from jsonb_array_elements(coalesce(v_block -> 'items', '[]'::jsonb)) loop
        declare
          v_item_id uuid := coalesce(nullif(v_item ->> 'id', '')::uuid, gen_random_uuid());
        begin
          v_item_ids := v_item_ids || v_item_id;
          insert into public.routine_items (id, block_id, exercise_id, raw_name, position, sets, reps, load, rest, tempo, rpe_target, rir_target, notes)
          values (
            v_item_id, v_block_id,
            nullif(v_item ->> 'exerciseId', '')::uuid,
            coalesce(v_item ->> 'rawName', ''),
            i_pos,
            nullif(v_item ->> 'sets', '')::smallint,
            nullif(v_item ->> 'reps', ''),
            nullif(v_item ->> 'load', ''),
            nullif(v_item ->> 'rest', ''),
            nullif(v_item ->> 'tempo', ''),
            nullif(v_item ->> 'rpeTarget', ''),
            nullif(v_item ->> 'rirTarget', ''),
            nullif(v_item ->> 'notes', '')
          )
          on conflict (id) do update set
            block_id = excluded.block_id, exercise_id = excluded.exercise_id, raw_name = excluded.raw_name,
            position = excluded.position, sets = excluded.sets, reps = excluded.reps, load = excluded.load,
            rest = excluded.rest, tempo = excluded.tempo, rpe_target = excluded.rpe_target, rir_target = excluded.rir_target,
            notes = excluded.notes;
          i_pos := i_pos + 1;
        end;
      end loop;
    end loop;
  end loop;

  -- Borrar lo que ya no está en el árbol.
  delete from public.routine_items i
   using public.routine_blocks b, public.routine_days d
   where i.block_id = b.id and b.day_id = d.id and d.routine_id = v_id
     and not (i.id = any (v_item_ids));
  delete from public.routine_blocks b
   using public.routine_days d
   where b.day_id = d.id and d.routine_id = v_id
     and not (b.id = any (v_block_ids));
  delete from public.routine_days d
   where d.routine_id = v_id and not (d.id = any (v_day_ids));

  return v_id;
end;
$$;

-- ── Registro real por serie ──────────────────────────────────────
create table public.set_logs (
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  item_id    uuid not null references public.routine_items (id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 12),
  reps       text check (reps is null or length(reps) <= 20),
  load       text check (load is null or length(load) <= 30),
  rpe        smallint check (rpe is null or rpe between 1 and 10),
  note       text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  primary key (session_id, item_id, set_number)
);
create index set_logs_item_idx on public.set_logs (item_id);

alter table public.set_logs enable row level security;

-- Leer: el cliente lo suyo; el profe, lo de sus clientes; el admin, todo (mismo criterio que item_checks en 0007).
create policy "set_logs: leer" on public.set_logs for select to authenticated
  using (
    public.client_of_session(session_id) = auth.uid()
    or public.can_manage_client(public.client_of_session(session_id))
  );
-- Escribir: solo el cliente dueño de la sesión (el «Ver como» del profe es de solo lectura).
create policy "set_logs: cliente registra" on public.set_logs for insert to authenticated
  with check (public.client_of_session(session_id) = auth.uid());
create policy "set_logs: cliente corrige" on public.set_logs for update to authenticated
  using (public.client_of_session(session_id) = auth.uid())
  with check (public.client_of_session(session_id) = auth.uid());
create policy "set_logs: cliente borra" on public.set_logs for delete to authenticated
  using (public.client_of_session(session_id) = auth.uid());
-- Un desactivado no puede nada (como el resto de las tablas en 0006_team.sql).
create policy "set_logs: solo usuarios activos" on public.set_logs as restrictive for all to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

grant select, insert, update, delete on public.set_logs to authenticated;

-- Reemplaza el registro de un ejercicio en una sesión (borra y vuelve a cargar, atómico).
-- security invoker: aplican las políticas de arriba, así que solo funciona para el dueño de la sesión.
create or replace function public.save_set_logs(p_session_id uuid, p_item_id uuid, p_logs jsonb)
returns setof public.set_logs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.client_of_session(p_session_id) is distinct from auth.uid() then
    raise exception 'Solo el cliente registra su entrenamiento' using errcode = '42501';
  end if;

  delete from public.set_logs where session_id = p_session_id and item_id = p_item_id;

  return query
  insert into public.set_logs (session_id, item_id, set_number, reps, load, rpe, note)
  select p_session_id, p_item_id,
         (l ->> 'set_number')::smallint,
         nullif(l ->> 'reps', ''),
         nullif(l ->> 'load', ''),
         nullif(l ->> 'rpe', '')::smallint,
         nullif(l ->> 'note', '')
    from jsonb_array_elements(coalesce(p_logs, '[]'::jsonb)) as l
  returning *;
end;
$$;

grant execute on function public.save_set_logs(uuid, uuid, jsonb) to authenticated;
