# Reactive App

PWA mobile-first de **REACTIVE – Rehabilitación y Entrenamiento**. Cada cliente ve su rutina personalizada y el video de cada ejercicio grabado por su profe. ¡Sin rutinas genéricas!

- Diseño (fuente de verdad visual): [`docs/REACTIVE — MVP mobile.pdf`](docs/)
- Especificación funcional: [`docs/prompt-claude-code.md`](docs/prompt-claude-code.md)

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind 3.4 (tokens del design system en `tailwind.config.ts`) · Barlow / Barlow Condensed · Supabase (Postgres, Auth, Storage, RLS) · SheetJS · fuse.js · Vitest · Playwright · Vercel.

## Setup local

Requiere Node 20.19+ (recomendado: 22 LTS).

```bash
npm install
cp .env.example .env.local   # por defecto NEXT_PUBLIC_DATA_SOURCE=mock
npm run dev                  # http://localhost:3000
```

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `start` | Build y servidor de producción (el service worker solo se registra en producción) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests unitarios (Vitest) |
| `npm run db:seed-sql` | Regenera `supabase/seed.sql` desde `lib/data/seed.ts` |

## Modo mock (sin Supabase)

Con `NEXT_PUBLIC_DATA_SOURCE=mock` la app usa datos de demo guardados en el `localStorage` del navegador (sembrados desde `lib/data/seed.ts`). Funciona igual en local y en los previews de Vercel.

- En `/login` aparece **«Modo demo · acceso rápido»**: Martina (cliente), Nico (profe) o Admin.
- También se puede ingresar con el email de cualquier usuario del seed (`*@reactive.test`) y la contraseña `DEMO_PASSWORD` de `lib/data/seed.ts`.
- Panel del profe → **«Restablecer datos demo»** vuelve al seed.
- Las fechas del seed son relativas a hoy, así que la demo no envejece.
- Los videos que sube el profe se guardan en IndexedDB del navegador. Los del seed son opcionales: ver `public/mock-videos/README.md`.

## Videos

- El método principal es **subir el archivo desde la app** (galería o cámara). YouTube es un link opcional.
- Se aceptan `.mp4`, `.mov` y `.webm`, hasta `NEXT_PUBLIC_MAX_VIDEO_MB` (50 por defecto) y `NEXT_PUBLIC_MAX_VIDEO_SECONDS` (60).
- Antes de subir se valida el archivo y se genera la miniatura en el navegador (frame a 1 s).
- En Supabase la subida es reanudable (TUS) al bucket privado `exercise-videos`, y se reproduce con URLs firmadas de 10 minutos.

## Arquitectura de datos

- `lib/data/types.ts`: tipos de dominio. `lib/data/repositories.ts`: interfaces (`DataSource`).
- `lib/data/mock`: implementación en `localStorage` (videos en IndexedDB).
- `lib/data/supabase`: implementación con supabase-js. La seguridad la da RLS; la subida de videos usa TUS (reanudable).
- `lib/data/index.ts` elige según `NEXT_PUBLIC_DATA_SOURCE`. Las pantallas solo usan `data.*`.
- Lo que necesita la service role key (invitar clientes, sumar profes) está en server actions: `app/actions/clients.ts`.
- `middleware.ts` protege `/app` (cliente; el staff también puede entrar para «Ver como») y `/coach` (solo profe/admin).

## Supabase

### 1. Crear el proyecto

1. En [supabase.com](https://supabase.com), creá un proyecto (región São Paulo, la más cercana).
2. En **Project Settings → API**, copiá la URL, la `anon key` y la `service_role key` a `.env.local` (y a Vercel):
   ```
   NEXT_PUBLIC_DATA_SOURCE=supabase
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...      # solo servidor, nunca con NEXT_PUBLIC_
   NEXT_PUBLIC_SITE_URL=https://<tu-dominio>
   ```
3. En **Authentication → URL Configuration**, agregá `<NEXT_PUBLIC_SITE_URL>/auth/callback` a las Redirect URLs (también la de localhost y la de previews de Vercel: `https://*-reactive4.vercel.app/auth/callback`).
4. En **Authentication → Providers → Email**, desactivá **«Allow new users to sign up»** (no hay registro público: los clientes se invitan).
5. En **Authentication → Email Templates**, cambiá el link de estos mails para que pasen por `/auth/confirm`:
   - **Invite user:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/activar`
   - **Reset password:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nueva-contrasena`
6. (Opcional) `ACCESS_IP_SALT`: un texto secreto para el hash de IP del límite anti-spam de «Pedir acceso».

### 2. Correr las migraciones

Opción A, con la CLI de Supabase:

```bash
npx supabase login
npx supabase init        # solo la primera vez: crea supabase/config.toml (no toca las migraciones)
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push
```

Opción B, a mano: en **SQL Editor**, pegá y ejecutá en orden los archivos de `supabase/migrations/` (`0001_schema.sql` → `0004_functions.sql`).

### 3. Datos de demo (opcional, SOLO staging)

`supabase/seed.sql` crea los usuarios y datos del diseño con una contraseña conocida. **No lo corras en producción.** Para un entorno de prueba: SQL Editor → pegar `supabase/seed.sql` → Run. Si cambiás `lib/data/seed.ts`, regeneralo con `npm run db:seed-sql`.

### 4. Crear el primer admin

1. **Authentication → Users → Add user → Create new user**: email y contraseña del admin, con «Auto Confirm User» tildado.
2. En **SQL Editor**:
   ```sql
   insert into public.profiles (id, role, full_name, email)
   select id, 'admin', 'Nombre Apellido', email
   from auth.users where email = 'admin@tu-dominio.com';
   ```
3. Ingresá a la app con ese usuario. Desde ahí el admin suma profes, y los profes invitan clientes con «+ Cliente».

## Importar Excel

- Plantilla: columnas `Día | Bloque | Orden | Ejercicio | Series | Reps | Carga | Descanso | Notas` (se descarga desde la app).
- También se lee el formato **por bloques**: una hoja por día; cada bloque empieza con una fila `Bloque 1 | Repeticiones | Series | Carga | Pausa`, sigue una fila por ejercicio y una fila con la pausa («2 minutos») que se toma como descanso del bloque. El texto suelto fuera de los bloques se avisa y no se importa.
- Se aceptan `.xlsx` y `.csv` de hasta 5 MB. Los encabezados se comparan sin mayúsculas ni acentos.
- Matching contra la biblioteca: igualdad exacta con el nombre o un alias → reconocido; parecido (fuse.js, `DEFAULT_THRESHOLD` en `lib/import/match.ts`) → «¿Quisiste decir…?»; si no, no encontrado. Al vincular, el texto original se guarda como alias.
- Planillas de prueba en `docs/ejemplos/` (regenerar con `npx tsx scripts/generate-import-examples.ts`).

## Primera vez / pedir acceso

- En el login, «¿Primera vez? Pedile tu acceso a tu profe» lleva a `/solicitar-acceso`: nombre, email, WhatsApp, profe, tipo de caso y mensaje.
- El pedido queda en `access_requests` (status `pending`). El anónimo solo puede insertar; leen y revisan coach/admin. Anti-spam: honeypot, 3 pedidos por email por día y 5 por IP por hora (hash de IP, nunca en claro).
- El profe lo ve en el Panel («Solicitudes de acceso (N)») y en Clientes → «Solicitudes»: **Aprobar** crea el cliente asignado al profe y manda la invitación; **Rechazar** con motivo opcional.
- La invitación lleva a `/activar` («Creá tu contraseña») y de ahí a Hoy.
- **Modo mock:** al aprobar, el profe ve el link `/activar?token=…` (simula el mail). La contraseña creada queda guardada en ese navegador.

## Rutas útiles

- `/`: splash · `/login` · `/recuperar` · `/nueva-contrasena` · `/solicitar-acceso` · `/activar`
- `/app`: cliente (Hoy · Mi Rutina · Ejercicios · Perfil)
- `/coach`: profe/admin (Panel · Clientes · Rutinas · Ejercicios)
- `/dev/ui`: catálogo de componentes del design system

## Estado por fase

- [x] **F0**: setup, tokens, fuentes, PWA y `/dev/ui`
- [x] **F1**: capa de datos (mock), auth simulada por rol, layouts, migraciones/RLS/seed de Supabase
- [x] **F2**: biblioteca de ejercicios con subida de video
- [x] **F3**: experiencia del cliente
- [x] **F4**: carga manual de rutinas (3 pasos, plantillas, duplicar y editar) + lista de Rutinas
- [x] **F5**: importación de Excel (plantilla, lectura, errores, matching con alias y vista previa)
- [x] **F6**: Panel, Clientes (ficha, alta, edición), Profes, «Primera vez / pedir acceso» y pulido
- [ ] F7: E2E con Playwright y deploy
