-- Reactive App · solicitudes de acceso («¿Primera vez? Pedile tu acceso a tu profe»)
-- El anónimo solo inserta pedidos con status «pending»; leer y actualizar, solo coach/admin.
-- Los chequeos de duplicados y el límite por email/IP los hace el server action (app/actions/access.ts).

create type public.access_request_status as enum ('pending', 'approved', 'rejected');

create table public.access_requests (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null check (length(trim(full_name)) between 3 and 120),
  email              text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(email) <= 254),
  phone              text check (phone is null or length(phone) <= 30),
  requested_coach_id uuid references public.profiles (id) on delete set null, -- null = «Todavía no tengo»
  case_type          public.case_type,
  message            text check (message is null or length(message) <= 500),
  status             public.access_request_status not null default 'pending',
  created_at         timestamptz not null default now(),
  reviewed_by        uuid references public.profiles (id) on delete set null,
  reviewed_at        timestamptz,
  reject_reason      text check (reject_reason is null or length(reject_reason) <= 500),
  ip_hash            text -- hash de la IP (nunca la IP en claro), para el límite anti-spam
);
create index access_requests_status_idx on public.access_requests (status, created_at desc);
create index access_requests_email_idx on public.access_requests (lower(email), created_at desc);
create index access_requests_ip_idx on public.access_requests (ip_hash, created_at desc);
-- Una sola solicitud pendiente por email.
create unique index access_requests_one_pending_per_email on public.access_requests (lower(email)) where status = 'pending';

alter table public.access_requests enable row level security;

create policy "access_requests: anónimo pide acceso" on public.access_requests for insert to anon, authenticated
  with check (status = 'pending' and reviewed_by is null and reviewed_at is null and reject_reason is null);

create policy "access_requests: staff lee" on public.access_requests for select to authenticated
  using (public.is_staff());

create policy "access_requests: staff revisa" on public.access_requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

grant insert on public.access_requests to anon;
grant select, insert, update on public.access_requests to authenticated;
