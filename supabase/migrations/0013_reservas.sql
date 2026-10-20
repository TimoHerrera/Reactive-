-- Reactive App · F12 · Reservas online de turnos
--  - booking_settings: reglas de reserva por profe (activado, confirmación automática o manual, duración,
--    anticipación mínima, días para adelante, plazo para cancelar y tipos reservables).
--  - availability_rules: franjas de atención por día de la semana (hora de Buenos Aires).
--  - time_off: días bloqueados (feriados, vacaciones).
--  - Estado nuevo «pendiente» (por confirmar) para las reservas que confirma el profe.
--  - El paciente NO inserta turnos: reserva con la RPC book_appointment, que valida todo y evita dobles reservas
--    (candado por profe). Ve la ocupación de su profe con coach_busy (solo horarios, sin datos de otros pacientes)
--    y cancela con cancel_my_appointment dentro del plazo.
-- Ojo: el valor nuevo del enum no se puede usar en DDL de esta misma migración; solo dentro de funciones plpgsql.

alter type public.appointment_status add value if not exists 'pendiente' before 'agendado';

create table public.booking_settings (
  coach_id         uuid primary key references public.profiles (id) on delete cascade,
  enabled          boolean not null default false,
  auto_confirm     boolean not null default false,
  slot_minutes     smallint not null default 60 check (slot_minutes in (30, 45, 60, 90)),
  min_notice_hours smallint not null default 12 check (min_notice_hours between 0 and 72),
  max_days_ahead   smallint not null default 30 check (max_days_ahead between 1 and 90),
  cancel_hours     smallint not null default 24 check (cancel_hours between 0 and 72),
  types            public.appointment_type[] not null default '{kinesiologia,entrenamiento}' check (cardinality(types) > 0),
  updated_at       timestamptz not null default now()
);

create table public.availability_rules (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time   time not null,
  check (start_time < end_time)
);
create index availability_rules_coach_idx on public.availability_rules (coach_id, weekday);

create table public.time_off (
  id       uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  date     date not null,
  reason   text check (reason is null or length(reason) <= 120),
  unique (coach_id, date)
);

-- Un profe agenda a su nombre (F9). Ahora también reserva el paciente (vía RPC): a él no se le pisa el profe.
create or replace function public.stamp_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if public.is_staff() and not public.is_admin() then new.coach_id := auth.uid(); end if;
  elsif not public.is_admin() then
    new.coach_id := old.coach_id;
  end if;
  return new;
end;
$$;

-- Profe del paciente logueado.
create or replace function public.my_coach_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coach_id from public.profiles where id = auth.uid() and role = 'client' and disabled_at is null
$$;

-- Leer horarios: el admin, el propio profe o sus pacientes. Escribir: el admin o el propio profe.
create or replace function public.can_read_schedule(p_coach uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or (public.is_staff() and p_coach = auth.uid()) or public.my_coach_id() = p_coach
$$;

create or replace function public.can_write_schedule(p_coach uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or (public.is_staff() and p_coach = auth.uid())
$$;

alter table public.booking_settings enable row level security;
alter table public.availability_rules enable row level security;
alter table public.time_off enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['booking_settings', 'availability_rules', 'time_off'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.can_read_schedule(coach_id))', t || ': leer', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_schedule(coach_id))', t || ': alta', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write_schedule(coach_id)) with check (public.can_write_schedule(coach_id))', t || ': editar', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write_schedule(coach_id))', t || ': borrar', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.is_active_user()) with check (public.is_active_user())',
      t || ': solo usuarios activos', t
    );
  end loop;
end;
$$;

grant select, insert, update, delete on public.booking_settings, public.availability_rules, public.time_off to authenticated;

-- Guardar horarios de una vez (reglas + franjas + días bloqueados), validando franjas que se pisan.
create or replace function public.save_schedule(p_coach uuid, p_settings jsonb, p_rules jsonb, p_time_off jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot smallint := (p_settings ->> 'slot_minutes')::smallint;
begin
  if not public.is_active_user() or not public.can_write_schedule(p_coach) then
    raise exception 'No tenés acceso a esos horarios' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_coach and role in ('coach', 'admin') and disabled_at is null) then
    raise exception 'Ese profe no está activo' using errcode = 'P0001';
  end if;

  insert into public.booking_settings (coach_id, enabled, auto_confirm, slot_minutes, min_notice_hours, max_days_ahead, cancel_hours, types, updated_at)
  values (
    p_coach,
    coalesce((p_settings ->> 'enabled')::boolean, false),
    coalesce((p_settings ->> 'auto_confirm')::boolean, false),
    v_slot,
    (p_settings ->> 'min_notice_hours')::smallint,
    (p_settings ->> 'max_days_ahead')::smallint,
    (p_settings ->> 'cancel_hours')::smallint,
    array(select jsonb_array_elements_text(p_settings -> 'types'))::public.appointment_type[],
    now()
  )
  on conflict (coach_id) do update set
    enabled = excluded.enabled, auto_confirm = excluded.auto_confirm, slot_minutes = excluded.slot_minutes,
    min_notice_hours = excluded.min_notice_hours, max_days_ahead = excluded.max_days_ahead,
    cancel_hours = excluded.cancel_hours, types = excluded.types, updated_at = now();

  delete from public.availability_rules where coach_id = p_coach;
  insert into public.availability_rules (coach_id, weekday, start_time, end_time)
  select p_coach, (r ->> 'weekday')::smallint, (r ->> 'start_time')::time, (r ->> 'end_time')::time
  from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) r;

  if exists (
    select 1 from public.availability_rules a join public.availability_rules b
      on a.coach_id = b.coach_id and a.weekday = b.weekday and a.id < b.id
     and a.start_time < b.end_time and b.start_time < a.end_time
    where a.coach_id = p_coach
  ) then
    raise exception 'Hay franjas que se pisan' using errcode = '23P01';
  end if;
  if exists (select 1 from public.availability_rules where coach_id = p_coach and end_time - start_time < make_interval(mins => v_slot)) then
    raise exception 'Hay una franja más corta que un turno' using errcode = '23514';
  end if;

  delete from public.time_off where coach_id = p_coach;
  insert into public.time_off (coach_id, date, reason)
  select p_coach, (t ->> 'date')::date, nullif(left(trim(coalesce(t ->> 'reason', '')), 120), '')
  from jsonb_array_elements(coalesce(p_time_off, '[]'::jsonb)) t
  on conflict (coach_id, date) do nothing;
end;
$$;

-- Ocupación de un profe entre dos fechas (Buenos Aires, inclusive): solo inicio y duración.
create or replace function public.coach_busy(p_coach uuid, p_from date, p_to date)
returns table (starts_at timestamptz, duration_min smallint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_user() or not public.can_read_schedule(p_coach) then
    raise exception 'No tenés acceso a esos horarios' using errcode = '42501';
  end if;
  return query
    select a.starts_at, a.duration_min
    from public.appointments a
    where a.coach_id = p_coach
      and a.status <> 'cancelado'
      and a.starts_at >= (p_from::timestamp at time zone 'America/Argentina/Buenos_Aires')
      and a.starts_at < ((p_to + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
    order by a.starts_at;
end;
$$;

-- Reserva del paciente con SU profe. Valida reglas, franja, alineación, días bloqueados y superposición.
create or replace function public.book_appointment(p_starts_at timestamptz, p_type public.appointment_type, p_notes text default null)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := auth.uid();
  v_coach uuid := public.my_coach_id();
  v_s     public.booking_settings;
  v_local timestamp := p_starts_at at time zone 'America/Argentina/Buenos_Aires';
  v_time  time := v_local::time;
  v_row   public.appointments;
begin
  if v_me is null or v_coach is null or not public.is_active_user() then
    raise exception 'Solo un paciente con profe asignado puede reservar' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_coach and role in ('coach', 'admin') and disabled_at is null) then
    raise exception 'Tu profe no está disponible' using errcode = 'P0001';
  end if;
  select * into v_s from public.booking_settings where coach_id = v_coach;
  if v_s.coach_id is null or not v_s.enabled then
    raise exception 'Tu profe todavía no habilitó las reservas online' using errcode = 'P0001';
  end if;
  if not (p_type = any (v_s.types)) then
    raise exception 'Ese tipo de turno no se puede reservar online' using errcode = 'P0001';
  end if;

  -- Una reserva a la vez por profe: dos pacientes no pueden tomar el mismo horario.
  perform pg_advisory_xact_lock(hashtext('reserva:' || v_coach::text));

  if p_starts_at < now() + make_interval(hours => v_s.min_notice_hours)
     or v_local::date > (now() at time zone 'America/Argentina/Buenos_Aires')::date + v_s.max_days_ahead
     or extract(second from v_time) <> 0
     or exists (select 1 from public.time_off where coach_id = v_coach and date = v_local::date)
     or not exists (
       select 1 from public.availability_rules r
       where r.coach_id = v_coach
         and r.weekday = extract(dow from v_local)::smallint
         and r.start_time <= v_time
         and v_time + make_interval(mins => v_s.slot_minutes) > v_time -- no pasa de medianoche
         and v_time + make_interval(mins => v_s.slot_minutes) <= r.end_time
         and (extract(epoch from (v_time - r.start_time))::int / 60) % v_s.slot_minutes = 0
     )
     or exists (
       select 1 from public.appointments a
       where a.coach_id = v_coach
         and a.status <> 'cancelado'
         and a.starts_at < p_starts_at + make_interval(mins => v_s.slot_minutes)
         and p_starts_at < a.starts_at + make_interval(mins => a.duration_min)
     ) then
    raise exception 'Ese horario ya no está disponible. Elegí otro.' using errcode = 'P0001';
  end if;

  insert into public.appointments (client_id, coach_id, starts_at, duration_min, type, status, notes, created_by)
  values (
    v_me, v_coach, p_starts_at, v_s.slot_minutes, p_type,
    (case when v_s.auto_confirm then 'agendado' else 'pendiente' end)::public.appointment_status,
    nullif(left(trim(coalesce(p_notes, '')), 300), ''),
    v_me
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- El paciente cancela un turno suyo: una reserva por confirmar, hasta que empiece; uno agendado, antes del plazo del profe.
create or replace function public.cancel_my_appointment(p_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
begin
  if not public.is_active_user() then
    raise exception 'Cuenta desactivada' using errcode = '42501';
  end if;
  update public.appointments a
     set status = 'cancelado'
   where a.id = p_id
     and a.client_id = auth.uid()
     and (
       (a.status = 'pendiente' and a.starts_at > now())
       or (a.status = 'agendado'
           and a.starts_at - now() >= make_interval(hours => coalesce((select s.cancel_hours from public.booking_settings s where s.coach_id = a.coach_id), 24)))
     )
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Ese turno ya no se puede cancelar desde la app. Escribile a tu profe.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

grant execute on function public.my_coach_id() to authenticated;
grant execute on function public.can_read_schedule(uuid) to authenticated;
grant execute on function public.can_write_schedule(uuid) to authenticated;
grant execute on function public.save_schedule(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.coach_busy(uuid, date, date) to authenticated;
grant execute on function public.book_appointment(timestamptz, public.appointment_type, text) to authenticated;
grant execute on function public.cancel_my_appointment(uuid) to authenticated;

-- Avisos (F11): reservas por confirmar.
alter table public.notification_prefs add column if not exists booking_enabled boolean not null default true;
