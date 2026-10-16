-- Reactive App · F9 · Agenda de turnos (los carga el profe)
--  - Profe: ve y edita los turnos de SUS pacientes (can_manage_client); el admin, todos.
--  - Paciente: lee los suyos y solo puede pedir reprogramar (RPC request_reschedule).
--  - Un profe siempre agenda a su nombre (trigger); el admin puede elegir el profe.
--  - Horarios en timestamptz; la app los muestra en America/Argentina/Buenos_Aires.

create type public.appointment_type as enum ('kinesiologia', 'entrenamiento', 'evaluacion_funcional', 'sport_recovery', 'mep_sport');
create type public.appointment_status as enum ('agendado', 'reprogramacion_pedida', 'cancelado', 'asistio', 'ausente');

create table public.appointments (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid not null references public.profiles (id) on delete cascade,
  coach_id                uuid not null references public.profiles (id) on delete cascade,
  starts_at               timestamptz not null,
  duration_min            smallint not null default 60 check (duration_min between 10 and 480),
  type                    public.appointment_type not null default 'kinesiologia',
  status                  public.appointment_status not null default 'agendado',
  notes                   text check (notes is null or length(notes) <= 500),
  series_id               uuid, -- turnos creados juntos con «Repetir»
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  reschedule_reason       text check (reschedule_reason is null or length(reschedule_reason) <= 300),
  reschedule_preference   text check (reschedule_preference is null or length(reschedule_preference) <= 120),
  reschedule_requested_at timestamptz
);
create index appointments_coach_starts_idx on public.appointments (coach_id, starts_at);
create index appointments_client_starts_idx on public.appointments (client_id, starts_at);
create index appointments_series_idx on public.appointments (series_id) where series_id is not null;
create index appointments_reschedule_idx on public.appointments (status) where status = 'reprogramacion_pedida';

-- Un profe agenda a su nombre; created_by es siempre quien lo crea.
create or replace function public.stamp_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sin usuario (seed, service role): se respeta lo que viene.
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if not public.is_admin() then new.coach_id := auth.uid(); end if;
  elsif not public.is_admin() then
    new.coach_id := old.coach_id;
  end if;
  return new;
end;
$$;
create trigger appointments_stamp before insert or update on public.appointments
  for each row execute function public.stamp_appointment();

alter table public.appointments enable row level security;

create policy "appointments: leer" on public.appointments for select to authenticated
  using (client_id = auth.uid() or public.can_manage_client(client_id));
create policy "appointments: alta" on public.appointments for insert to authenticated
  with check (public.can_manage_client(client_id));
create policy "appointments: editar" on public.appointments for update to authenticated
  using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));
create policy "appointments: borrar" on public.appointments for delete to authenticated
  using (public.can_manage_client(client_id));
create policy "appointments: solo usuarios activos" on public.appointments as restrictive for all to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

grant select, insert, update, delete on public.appointments to authenticated;

-- El paciente pide reprogramar un turno suyo, agendado y que no empezó. Solo toca el estado y el pedido.
create or replace function public.request_reschedule(p_id uuid, p_reason text, p_preference text)
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
     set status = 'reprogramacion_pedida',
         reschedule_reason = nullif(left(trim(coalesce(p_reason, '')), 300), ''),
         reschedule_preference = nullif(left(trim(coalesce(p_preference, '')), 120), ''),
         reschedule_requested_at = now()
   where a.id = p_id
     and a.client_id = auth.uid()
     and a.status = 'agendado'
     and a.starts_at > now()
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Ese turno ya no se puede reprogramar' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

grant execute on function public.request_reschedule(uuid, text, text) to authenticated;
