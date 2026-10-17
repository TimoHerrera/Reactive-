-- Reactive App · gestión del equipo (profes y admins)
-- · Perfil público del profe: bio corta y foto.
-- · Estado de la cuenta: activated_at (creó su contraseña) y disabled_at (desactivado).
-- · Un usuario desactivado no lee ni escribe NADA (políticas restrictivas en todas las tablas y en Storage).
-- · Solo un admin crea, edita o desactiva profes y cambia roles; un profe nunca sube su rol ni el de otro.
-- · Códigos de invitación de un solo uso (hasheados), solo accesibles con la service role.

-- ── profiles: datos nuevos ───────────────────────────────────────
alter table public.profiles
  add column bio          text check (bio is null or length(bio) <= 280),
  add column avatar_path  text,
  add column activated_at timestamptz,
  add column disabled_at  timestamptz;

-- Los que ya existían quedan como activos.
update public.profiles set activated_at = created_at where activated_at is null;

-- ── helpers: un desactivado no es staff ni admin ─────────────────
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and disabled_at is null)
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role in ('coach', 'admin') and disabled_at is null from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role = 'admin' and disabled_at is null from public.profiles where id = auth.uid()), false)
$$;

grant execute on function public.is_active_user() to authenticated;

-- ── trigger: roles y estado solo los toca un admin ───────────────
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Llamadas con service role (server actions, script create-admin) no tienen auth.uid(): se permiten.
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Solo un admin puede cambiar roles' using errcode = '42501';
  end if;
  -- Nadie cambia su propio rol (ni un admin: evita quedarse sin admins por error).
  if tg_op = 'UPDATE' and new.role is distinct from old.role and new.id = auth.uid() then
    raise exception 'No podés cambiar tu propio rol' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and new.role in ('coach', 'admin') and not public.is_admin() then
    raise exception 'Solo un admin suma profes' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.role in ('coach', 'admin') and not public.is_admin() and new.id <> auth.uid() then
    raise exception 'Solo un admin edita profes' using errcode = '42501';
  end if;
  -- Activar/desactivar: solo admin (y nunca a sí mismo).
  if tg_op = 'UPDATE' and new.disabled_at is distinct from old.disabled_at then
    if not public.is_admin() then
      raise exception 'Solo un admin desactiva usuarios' using errcode = '42501';
    end if;
    if new.id = auth.uid() then
      raise exception 'No podés desactivarte a vos' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.activated_at is distinct from old.activated_at and not public.is_admin() then
    raise exception 'El estado de la cuenta no se edita' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and (new.disabled_at is not null or new.activated_at is not null) and not public.is_admin() then
    raise exception 'El estado de la cuenta no se edita' using errcode = '42501';
  end if;
  return new;
end;
$$;
-- (el trigger profiles_protect_role de 0002 ya apunta a esta función)

-- ── un desactivado no puede nada ─────────────────────────────────
-- Políticas RESTRICTIVAS: se suman (AND) a las permisivas que ya existen.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'coach_notes', 'exercises', 'routines', 'routine_days', 'routine_blocks',
    'routine_items', 'workout_sessions', 'item_checks', 'exercise_views', 'access_requests'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.is_active_user()) with check (public.is_active_user())',
      t || ': solo usuarios activos', t
    );
  end loop;
end;
$$;

create policy "storage: solo usuarios activos" on storage.objects as restrictive for all to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

-- ── códigos de invitación ────────────────────────────────────────
-- Se guarda solo el hash (SHA-256). Un solo uso, atado al email, vence a las 48 h.
-- RLS activo y SIN políticas: solo la service role (server actions) los lee o escribe.
create table public.invite_codes (
  id          uuid primary key default gen_random_uuid(),
  code_hash   text not null unique,
  email       text not null,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index invite_codes_profile_idx on public.invite_codes (profile_id) where used_at is null;
alter table public.invite_codes enable row level security;
revoke all on public.invite_codes from anon, authenticated;
