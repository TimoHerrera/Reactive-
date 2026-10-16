-- Reactive App · F11 · Avisos del profe
--  - notification_prefs: qué avisos quiere cada profe y cuándo (N días antes, N días después y cada M, pack con N sesiones…).
--  - notification_state: avisos que ya vio en la app (seen_at) o que ya le salieron por mail (emailed_at).
-- Los avisos en sí no se guardan: se calculan con el estado de cobro y los turnos (lib/notify/alerts.ts).
-- RLS: cada profe ve y cambia SOLO lo suyo. El mail diario (/api/cron/avisos) usa la service role.

create table public.notification_prefs (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  due_soon_enabled    boolean not null default true,
  due_soon_days       smallint not null default 3 check (due_soon_days between 1 and 60),
  overdue_enabled     boolean not null default true,
  overdue_after_days  smallint not null default 1 check (overdue_after_days between 0 and 90),
  overdue_repeat_days smallint default 7 check (overdue_repeat_days is null or overdue_repeat_days between 1 and 60),
  pack_low_enabled    boolean not null default true,
  pack_low_sessions   smallint not null default 1 check (pack_low_sessions between 0 and 10),
  reschedule_enabled  boolean not null default true,
  scope               text not null default 'mine' check (scope in ('mine', 'all')),
  email_enabled       boolean not null default false,
  updated_at          timestamptz not null default now()
);

create table public.notification_state (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  key        text not null check (length(key) <= 200),
  seen_at    timestamptz,
  emailed_at timestamptz,
  primary key (user_id, key)
);

-- «Todo el centro» es solo para admin: a un profe se le guarda siempre 'mine'.
create or replace function public.clamp_notification_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then new.scope := 'mine'; end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger notification_prefs_scope before insert or update on public.notification_prefs
  for each row execute function public.clamp_notification_scope();

alter table public.notification_prefs enable row level security;
alter table public.notification_state enable row level security;

create policy "notification_prefs: propias" on public.notification_prefs for all to authenticated
  using (user_id = auth.uid() and public.is_staff()) with check (user_id = auth.uid() and public.is_staff());
create policy "notification_state: propio" on public.notification_state for all to authenticated
  using (user_id = auth.uid() and public.is_staff()) with check (user_id = auth.uid() and public.is_staff());

do $$
declare
  t text;
begin
  foreach t in array array['notification_prefs', 'notification_state'] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.is_active_user()) with check (public.is_active_user())',
      t || ': solo usuarios activos', t
    );
  end loop;
end;
$$;

grant select, insert, update, delete on public.notification_prefs, public.notification_state to authenticated;
