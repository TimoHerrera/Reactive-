-- Reactive App · funciones RPC (security invoker: aplican las políticas RLS del que llama)

-- Agrega un alias si no existe (vincular desde la importación de Excel).
create or replace function public.add_exercise_alias(p_exercise_id uuid, p_alias text)
returns public.exercises
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.exercises;
begin
  update public.exercises e
     set aliases = case
       when public.normalize_name(p_alias) = '' then e.aliases
       when public.normalize_name(p_alias) = e.name_normalized then e.aliases
       when exists (select 1 from unnest(e.aliases) a where public.normalize_name(a) = public.normalize_name(p_alias)) then e.aliases
       else array_append(e.aliases, trim(p_alias))
     end
   where e.id = p_exercise_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Ejercicio no encontrado' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

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
          insert into public.routine_items (id, block_id, exercise_id, raw_name, position, sets, reps, load, rest, tempo, notes)
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
            nullif(v_item ->> 'notes', '')
          )
          on conflict (id) do update set
            block_id = excluded.block_id, exercise_id = excluded.exercise_id, raw_name = excluded.raw_name,
            position = excluded.position, sets = excluded.sets, reps = excluded.reps, load = excluded.load,
            rest = excluded.rest, tempo = excluded.tempo, notes = excluded.notes;
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

grant execute on function public.add_exercise_alias(uuid, text) to authenticated;
grant execute on function public.save_routine_tree(jsonb) to authenticated;
