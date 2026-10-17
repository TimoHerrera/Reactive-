-- Reactive App · F10 · Pagos y recordatorios de cobro (sin pagos online por ahora)
--  - client_plans: plan de cobro por paciente (mensual / por sesión / pack). Montos en centavos (entero).
--  - payments: pagos registrados por el profe (mes cubierto o cantidad de sesiones).
--  - app_settings: una sola fila con alias/CBU, plantillas de WhatsApp y «Mostrar estado de cuota al paciente».
-- RLS: el profe ve y registra los pagos de SUS pacientes; el admin, todos. El paciente solo ve lo suyo
-- (para calcular su estado) y solo si el admin activó «Mostrar estado de cuota al paciente».

create type public.plan_kind as enum ('mensual', 'por_sesion', 'pack');
create type public.payment_method as enum ('efectivo', 'transferencia', 'mercadopago', 'otro');

create table public.client_plans (
  client_id     uuid primary key references public.profiles (id) on delete cascade,
  kind          public.plan_kind not null default 'mensual',
  amount_cents  bigint not null check (amount_cents > 0),
  due_day       smallint check (due_day between 1 and 31),
  pack_sessions smallint check (pack_sessions between 1 and 100),
  starts_on     date not null default current_date,
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  check (kind <> 'mensual' or due_day is not null),
  check (kind <> 'pack' or pack_sessions is not null)
);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles (id) on delete cascade,
  amount_cents  bigint not null check (amount_cents > 0),
  paid_at       date not null default current_date,
  method        public.payment_method not null default 'transferencia',
  period        text check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), -- mes que cubre («YYYY-MM»)
  sessions      smallint check (sessions between 1 and 100),         -- pack / por sesión
  note          text check (note is null or length(note) <= 300),
  registered_by uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index payments_client_idx on public.payments (client_id, paid_at desc);
create index payments_paid_at_idx on public.payments (paid_at);

create table public.app_settings (
  id                     boolean primary key default true check (id), -- una sola fila
  transfer_alias         text not null default '' check (length(transfer_alias) <= 80),
  payment_template       text not null default 'Hola {nombre}, te recordamos que {concepto} ({monto}) {vence}. Podés transferir al alias {alias}. ¡Gracias!'
                           check (length(payment_template) <= 600),
  appointment_template   text not null default '¡Hola {nombre}! Te recordamos tu turno de {tipo} {cuando} a las {hora} en Reactive. ¿Nos confirmás? 💪'
                           check (length(appointment_template) <= 600),
  show_billing_to_client boolean not null default false,
  updated_at             timestamptz not null default now()
);
insert into public.app_settings (id) values (true) on conflict do nothing;

-- registered_by es siempre quien registra.
create or replace function public.stamp_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then new.registered_by := auth.uid(); end if;
  return new;
end;
$$;
create trigger payments_stamp before insert on public.payments
  for each row execute function public.stamp_payment();

-- ¿El paciente puede ver su estado de cuota?
create or replace function public.billing_visible_to_clients()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select show_billing_to_client from public.app_settings where id), false)
$$;
grant execute on function public.billing_visible_to_clients() to authenticated;

alter table public.client_plans enable row level security;
alter table public.payments enable row level security;
alter table public.app_settings enable row level security;

create policy "client_plans: leer" on public.client_plans for select to authenticated
  using (public.can_manage_client(client_id) or (client_id = auth.uid() and public.billing_visible_to_clients()));
create policy "client_plans: escribir" on public.client_plans for all to authenticated
  using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

create policy "payments: leer" on public.payments for select to authenticated
  using (public.can_manage_client(client_id) or (client_id = auth.uid() and public.billing_visible_to_clients()));
create policy "payments: registrar" on public.payments for insert to authenticated
  with check (public.can_manage_client(client_id));
create policy "payments: corregir" on public.payments for update to authenticated
  using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));
create policy "payments: borrar" on public.payments for delete to authenticated
  using (public.can_manage_client(client_id));

-- Ajustes: los lee cualquier logueado (alias para transferir); solo el admin los cambia.
create policy "app_settings: leer" on public.app_settings for select to authenticated using (true);
create policy "app_settings: admin" on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

do $$
declare
  t text;
begin
  foreach t in array array['client_plans', 'payments', 'app_settings'] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.is_active_user()) with check (public.is_active_user())',
      t || ': solo usuarios activos', t
    );
  end loop;
end;
$$;

grant select, insert, update, delete on public.client_plans, public.payments to authenticated;
grant select, insert, update on public.app_settings to authenticated;
