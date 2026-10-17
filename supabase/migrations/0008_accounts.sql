-- Reactive App · una persona = un email, y bajas (desactivar / eliminar)
--
-- · Emails normalizados (trim + minúsculas) al guardar, en profiles y access_requests.
-- · Índice único sobre lower(email) en profiles. En access_requests ya había uno para las pendientes
--   (0005: access_requests_one_pending_per_email).
-- · access_requests.linked_profile_id: al aprobar una solicitud cuyo email ya tiene cuenta, se vincula a
--   ese usuario en vez de crear otro.
-- · Desactivar (disabled_at, 0006) y eliminar los hacen server actions con la service role
--   (app/actions/accounts.ts y team.ts). Eliminar borra el usuario de auth: el perfil cae en cascada y,
--   con él, rutinas, sesiones, checks, vistas y observaciones (FKs de 0001).

create or replace function public.normalize_email()
returns trigger
language plpgsql
as $$
begin
  if new.email is not null then
    new.email := lower(trim(new.email));
  end if;
  return new;
end;
$$;

update public.profiles set email = lower(trim(email)) where email is distinct from lower(trim(email));
update public.access_requests set email = lower(trim(email)) where email is distinct from lower(trim(email));

create trigger profiles_normalize_email before insert or update of email on public.profiles
  for each row execute function public.normalize_email();
create trigger access_requests_normalize_email before insert or update of email on public.access_requests
  for each row execute function public.normalize_email();

-- Si hubiera duplicados viejos, esto falla a propósito: hay que resolverlos a mano antes de migrar.
create unique index profiles_email_unique on public.profiles (lower(email)) where email is not null;

alter table public.access_requests
  add column linked_profile_id uuid references public.profiles (id) on delete set null;
