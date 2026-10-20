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
| `npm run test:e2e` | E2E con Playwright (build de producción en modo mock, 390 px) |
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
- **Grabar con la cámara** (PC y celular, `components/coach/CameraRecorder.tsx`): «Habilitar cámara» pide el permiso del navegador (cámara y micrófono), muestra la imagen en vivo, graba hasta el máximo de segundos con cuenta, deja cambiar entre cámara frontal y trasera, revisar la toma y «Usar este video» (sigue el mismo camino que una subida). Si el permiso está bloqueado, explica cómo habilitarlo según el dispositivo (PC, Android, iPhone) y ofrece la app de cámara del celular o elegir un video ya grabado. Necesita https (en Vercel ya está) o localhost.
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

## Quién ve qué

Las reglas están en `lib/access/scope.ts` (las usa el mock) y en RLS (`0007_coach_scope.sql`), así la demo se comporta igual que producción.

- **Profe**: ve y edita solo sus clientes (`coach_id` = él) y lo que cuelga de ellos: rutinas, sesiones, vistas y observaciones. También ve las solicitudes de acceso que lo eligieron. Panel, Clientes, Rutinas y «Ver como» se filtran igual. Si abre por URL un cliente o una rutina ajena, ve «No tenés acceso».
- **Compartido**: la biblioteca de ejercicios y videos, y las plantillas. Cualquier profe las usa o las duplica; editarlas o borrarlas, solo su autor o el admin.
- **Admin**: ve todo, con el filtro «Profe: Todos / Nico / …» en Panel, Clientes y Rutinas. Es el único que reasigna clientes (Editar datos → Profe) y el que recibe las solicitudes «Todavía no tengo» (al aprobar elige a qué profe asignarla).
- **Alta de cliente**: queda asignado al profe que lo crea; el admin elige el profe.
- **Autor**: `routines.created_by` es siempre el usuario logueado; lo fija la base con un trigger y en mock la capa de datos, nunca el formulario. Si la edita otra persona se guarda `updated_by` y la clienta ve «Cargada por X · editada por Y».

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

Opción B, a mano: en **SQL Editor**, pegá y ejecutá en orden los archivos de `supabase/migrations/` (`0001_schema.sql` → `0013_reservas.sql`).

### 3. Datos de demo (opcional, SOLO staging)

`supabase/seed.sql` crea los usuarios y datos del diseño con una contraseña conocida. **No lo corras en producción.** Para un entorno de prueba: SQL Editor → pegar `supabase/seed.sql` → Run. Si cambiás `lib/data/seed.ts`, regeneralo con `npm run db:seed-sql`.

### 4. Crear el primer admin

No hay PIN fijo ni registro público de profes. El primer admin se crea desde tu compu con la service role (en `.env.local`, con `NEXT_PUBLIC_DATA_SOURCE=supabase`):

```bash
npm run create-admin -- admin@tu-dominio.com "Nombre Apellido"
```

- Si el email ya tiene usuario, lo **promueve** a admin (y lo reactiva si estaba desactivado).
- Si no existe, le manda la **invitación por mail** (→ `/activar` → crea su contraseña → `/coach`) e imprime un **código de respaldo** de un solo uso (48 h) por si el mail no llega.
- En modo mock no toca nada: la demo ya trae un admin (`admin@reactive.test`, botón «Admin» del acceso rápido).

Desde ahí el admin suma el resto del equipo en **Equipo**, y los profes invitan clientes con «+ Cliente».

## Importar Excel

- Plantilla: columnas `Día | Bloque | Orden | Ejercicio | Series | Reps | Carga | Descanso | RPE | RIR | Observaciones` (se descarga desde la app). **RPE y RIR son opcionales**: los Excel viejos sin esas columnas se siguen aceptando. «Notas» y «Observaciones» son sinónimos.
- RPE (1–10) y RIR (0–10) aceptan un valor o un rango (`7`, `7-8`, `7 a 8`); se guardan normalizados. Si no es válido («muy duro») se avisa con la fila y se importa como texto.
- También se lee el formato **por bloques**: una hoja por día; cada bloque empieza con una fila `Bloque 1 | Repeticiones | Series | Carga | Pausa`, sigue una fila por ejercicio y una fila con la pausa («2 minutos») que se toma como descanso del bloque. El texto suelto fuera de los bloques se avisa y no se importa.
- Se aceptan `.xlsx` y `.csv` de hasta 5 MB. Los encabezados se comparan sin mayúsculas ni acentos.
- Matching contra la biblioteca: igualdad exacta con el nombre o un alias → reconocido; parecido (fuse.js, `DEFAULT_THRESHOLD` en `lib/import/match.ts`) → «¿Quisiste decir…?»; si no, no encontrado. Al vincular, el texto original se guarda como alias.
- Planillas de prueba en `docs/ejemplos/` (regenerar con `npx tsx scripts/generate-import-examples.ts`).

## Planificador: RPE, RIR y registro real (F8)

- Cada ejercicio de la rutina tiene **RPE y RIR objetivo** (`routine_items.rpe_target` / `rir_target`, texto para aceptar rangos). Las notas se muestran como «Observaciones».
- Cliente: la card muestra «RPE 8 · RIR 2» con un «?» que explica qué es cada cosa.
- **Registro real**: al marcar un ejercicio se abre «¿Cómo te fue?» (opcional): una fila por serie con reps y carga planificadas (editables), RPE real 1–10 y un comentario. «Saltear» lo marca igual. Desmarcar es directo. Tabla `set_logs` (PK `session_id, item_id, set_number`); el comentario va en la serie 1.
- Profe: pestaña **Registro** en la ficha del cliente (planificado vs. hecho, por sesión) con aviso **RPE ↑** si el RPE real supera al tope del objetivo por 2 o más. En Actividad reciente: «Martina marcó RPE 9 en Sentadilla goblet (objetivo 7)».
- RLS (`0009_planificador.sql`): escribe solo el cliente dueño de la sesión (RPC `save_set_logs`, atómico); leen él, su profe y el admin.

## Agenda de turnos (F9)

- Los carga el profe en **Agenda** (tab bar: Panel · Agenda · Clientes · Rutinas · Ejercicios). Vista **Día** (lista por horario) y **Semana**, con ‹ › y «Hoy». El admin filtra por profe.
- **+ Turno**: paciente, fecha, hora, duración, tipo (Kinesiología / Entrenamiento / Evaluación funcional / Sport Recovery / MEP Sport) y nota. **Repetir**: días de la semana + cantidad de semanas o fecha de fin (tope 120 turnos; comparten `series_id`). Al editar uno recurrente: «Solo este» o «Este y los siguientes».
- Aviso (no bloquea) si se superpone con otro turno del mismo profe. Estados: agendado / reprogramación pedida / cancelado / asistió / ausente.
- Panel: «Hoy: N turnos» con el próximo y alerta de reprogramaciones pedidas. Ficha del cliente: pestaña **Turnos** (próximos + historial con asistencias y ausencias).
- Paciente: en Hoy, «Próximo turno» con **Pedir reprogramar** (motivo + franja; pasa a «reprogramación pedida» y aparece en el Panel y la Agenda del profe) y **Agregar a mi calendario** (.ics). En Perfil, sus próximos turnos.
- **WhatsApp**: «Turnos de mañana» con un botón por paciente; el mensaje se puede editar antes de abrir `wa.me/549…` (teléfonos normalizados en `lib/phone.ts`).
- Horarios en **America/Argentina/Buenos_Aires** (UTC−3 fijo, `lib/agenda/time.ts`), sin importar la zona del navegador.
- RLS (`0010_agenda.sql`): el profe ve y edita los turnos de sus pacientes (`can_manage_client`), el admin todos; un trigger hace que el profe agende siempre a su nombre. El paciente solo lee los suyos y pide reprogramar con la RPC `request_reschedule`.

## Pagos y recordatorios de cobro (F10)

- **Plan por paciente** (`client_plans`): mensual (cuota + día de vencimiento), por sesión o pack de N sesiones; monto en ARS guardado en **centavos** (entero), fecha de inicio y activo.
- **Pagos** (`payments`): monto, fecha, medio (efectivo / transferencia / Mercado Pago / otro), mes cubierto o cantidad de sesiones, nota y quién lo registró.
- **Estado automático** (`lib/billing/status.ts`): Al día / Por vencer (5 días o menos) / Vencido (con días de atraso, desde el mes impago más viejo). Packs: «quedan N sesiones», descontando los turnos con «asistió» de la Agenda; con 0 → «Renovar pack». Por sesión: debe las asistidas sin pagar.
- Profe (sus pacientes) y admin (todos, con filtro por profe): card «Cobros: N vencidos · N por vencer» en el Panel → pantalla **Pagos** filtrable por estado; pestaña **Pagos** en la ficha con el plan, el historial y «+ Registrar pago» (precarga el monto y el mes o las sesiones a cobrar).
- **WhatsApp** en vencidos, por vencer y renovar, con el mensaje de la plantilla editable antes de mandarlo.
- **Ajustes** (solo admin, `/coach/ajustes`): alias/CBU, plantillas de WhatsApp (pago y turno) y «Mostrar estado de cuota al paciente».
- **Admin**: resumen del mes (cobrado, pendiente, vencido y total por profe) y exportar los pagos a Excel o CSV.
- **Paciente** (solo si está activado): en Perfil, «Tu cuota: al día» o cuándo vence, con el alias. Nunca ve datos de otros.
- RLS (`0011_pagos.sql`): el profe ve y registra los pagos de sus pacientes, el admin todos; el paciente solo lee su plan y sus pagos si el ajuste está activado. Sin pagos online por ahora (Mercado Pago queda para más adelante).

## Reservas online de turnos (F12)

- **Paciente — pestaña Turnos** (`/app/turnos`, tab bar: Hoy · Mi Rutina · Turnos · Ejercicios · Perfil):
  - elige tipo, día (tira deslizable con los horarios libres de cada día) y horario (mañana / tarde);
  - confirma con una nota opcional; queda **por confirmar** o **agendado**, según la regla del profe;
  - «Mis turnos»: una reserva sin confirmar se retira hasta que empiece; un turno agendado se cancela hasta N h antes;
  - en Hoy, la tarjeta de próximo turno muestra «Por confirmar» y lleva a reservar.
- **Profe — Mis horarios** (`/coach/agenda/horarios`, desde la Agenda o el menú del avatar):
  - reservas online sí/no;
  - franjas por día de la semana (varias por día, «Copiar el lunes a toda la semana»);
  - duración del turno (30/45/60/90 min) y tipos que se pueden reservar;
  - confirmación automática o manual, anticipación mínima (h), hasta cuántos días para adelante y plazo para cancelar (h);
  - días bloqueados (feriados, vacaciones) y vista previa de los horarios libres de la semana;
  - el admin elige de qué profe edita los horarios.
- **Por confirmar:** estado nuevo `pendiente`. Aparece en la Agenda («Reservas por confirmar», con Confirmar / Rechazar), en la tarjeta del turno, en el Panel y en Avisos (F11, regla «Reservas por confirmar»).
- **Horarios libres** (`lib/agenda/booking.ts`): cada franja se parte en turnos de la duración elegida; se descartan días bloqueados, los que no cumplen la anticipación o están fuera de rango, y los que se pisan con cualquier turno del profe (salvo cancelados).
- **Supabase (`0013_reservas.sql`):** `booking_settings`, `availability_rules`, `time_off` (RLS: lee el profe, sus pacientes y el admin; escribe el profe o el admin) y RPCs:
  - `book_appointment`: el paciente **no inserta turnos**; la función valida franja, alineación, reglas, día bloqueado y superposición con un candado por profe (sin dobles reservas);
  - `coach_busy`: ocupación del profe **sin datos de otros pacientes**;
  - `cancel_my_appointment` y `save_schedule` (guarda todo en una transacción y rechaza franjas que se pisan).
  - El trigger de F9 ya no pisa el profe cuando el que crea el turno es el paciente.
- Validado en PGlite: 34 chequeos (dobles reservas, franjas, feriados, plazos, tipos, permisos por rol y que el paciente no vea turnos ajenos).

## Avisos del profe (F11)

- **Mis avisos** (`/coach/avisos/configurar`, también en el menú del avatar): cada profe elige los suyos.
  - **Cuota por vencer** (mensual): avisar **N días antes** del vencimiento (1–60).
  - **Venció y no pagó** (mensual, pack o por sesión): a los **N días** de vencido (0 = el mismo día) y, si quiere, **repetir cada M días** mientras siga sin pagar.
  - **Pack por terminarse**: cuando queden **N sesiones o menos** (0 = cuando se termina).
  - **Pedidos de reprogramación** de turnos.
  - **Admin**: avisos de todo el centro o solo de sus pacientes. Un profe recibe siempre solo los suyos.
  - Vista previa: «Con esta configuración, hoy tendrías N avisos».
- **Campanita** en el Panel con los avisos nuevos → **Avisos** (`/coach/avisos`): nuevos y vistos; tocar uno lo marca como visto y lleva a la ficha (pestaña Pagos) o a la Agenda; «Marcar todos como vistos».
- Los avisos no se guardan: se calculan con el estado de cobro y los turnos (`lib/notify/alerts.ts`). Cada uno tiene una clave estable (mismo vencimiento, misma repetición), así lo visto no vuelve a aparecer como nuevo y cada repetición sí.
- **También por mail** (opcional, por profe): `/api/cron/avisos` corre todos los días a las 9:00 (Vercel Cron, `vercel.json`) y le manda a cada profe un resumen con los avisos que todavía no vio ni le llegaron. Necesita `NEXT_PUBLIC_DATA_SOURCE=supabase`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY` y `AVISOS_FROM` (remitente de un dominio verificado en Resend). En modo demo no se mandan mails.
- RLS (`0012_avisos.sql`): cada profe lee y cambia solo sus preferencias y sus avisos vistos; «todo el centro» se fuerza a «solo mis pacientes» si no es admin.

## Primera vez / pedir acceso

- En el login, «¿Primera vez? Pedile tu acceso a tu profe» lleva a `/solicitar-acceso`: nombre, email, WhatsApp, profe, tipo de caso y mensaje.
- El pedido queda en `access_requests` (status `pending`). El anónimo solo puede insertar; la lee y la revisa el profe elegido (las «Todavía no tengo», el admin). Anti-spam: honeypot, 3 pedidos por email por día y 5 por IP por hora (hash de IP, nunca en claro).
- El profe lo ve en el Panel («Solicitudes de acceso (N)») y en Clientes → «Solicitudes»: **Aprobar** crea el cliente asignado al profe y manda la invitación; **Rechazar** con motivo opcional.
- La invitación lleva a `/activar` («Creá tu contraseña») y de ahí a Hoy.
- **Modo mock:** al aprobar, el profe ve el link `/activar?token=…` (simula el mail). La contraseña creada queda guardada en ese navegador.

## Equipo (profes y admins)

- **Equipo** (`/coach/equipo`, solo admin; se entra desde el Panel o el menú del avatar): lista de profes con estado (activo / invitación pendiente / desactivado) y cantidad de clientes.
- **+ Profe**: nombre, email, título, WhatsApp y rol (profe o admin). Manda la invitación por mail → `/activar` → crea su contraseña → `/coach`.
- En la ficha de cada profe: **reenviar invitación**, **generar código** (un solo uso, atado a ese email, vence en 48 h; se guarda hasheado y se muestra una sola vez; se canjea en `/activar` → «¿Tenés un código?»), editar datos, cambiar rol y **desactivar** (pierde el acceso al instante; si tiene clientes, hay que elegir a qué profe pasarlos; el historial queda) o reactivar.
- **Mi perfil** (`/coach/perfil`): nombre, título, foto (o iniciales), WhatsApp y bio corta (280). Es lo que ve el cliente en «Tu profe → Ver perfil». Cada profe edita el suyo; el admin, el de todos.
- **Permisos (RLS, `0006_team.sql`)**: solo un admin crea, edita o desactiva profes y cambia roles; nadie cambia su propio rol; un usuario desactivado no lee ni escribe nada (políticas restrictivas en todas las tablas y en Storage, y además se le bloquea el login). Los códigos (`invite_codes`) solo los toca la service role.
- **Modo mock:** la invitación muestra el link `/activar?token=…` o el código en pantalla. Demo: Caro P. (profe activa) y Lu M. (invitación pendiente).

## Usuarios: un email por persona, desactivar y eliminar

- **Email único:** se guarda normalizado (trim + minúsculas). En la base hay un índice único sobre `lower(email)` en `profiles` y otro para las solicitudes pendientes (`0008_accounts.sql`); el mock valida lo mismo. Crear un cliente o un profe con un email que ya existe da «Ya existe un usuario con ese email» + «Ver ficha» (si podés verla) y no crea el duplicado.
- **Pedir acceso:**
  - cuenta activa → «Ya tenés cuenta: ingresá o recuperá tu contraseña»;
  - cuenta desactivada → «Tu cuenta está pausada, escribinos por WhatsApp»;
  - solicitud pendiente → se avisa y no se duplica.
  - Si al aprobar el email ya tiene cuenta, se ofrece **vincular** la solicitud a ese usuario (`linked_profile_id`) en vez de crear otro.
- **Desactivar** (admin, o el profe con sus propios clientes): bloquea el login al instante, oculta a la persona de las listas (filtro «Desactivados» en Clientes y Equipo) y conserva el historial. Se vuelve con «Reactivar». El email sigue reservado.
- **Eliminar definitivamente** (escribiendo el nombre de la persona para confirmar). El admin elimina a cualquiera menos a sí mismo; el profe, solo a sus propios clientes (los de otros profes ni le aparecen: por URL ven «No tenés acceso»):
  - Cliente: borra la cuenta de auth, el perfil, las rutinas, las sesiones, las observaciones y las solicitudes.
  - Profe: primero obliga a reasignar sus clientes. Sus ejercicios y plantillas pasan al admin.
  - En los dos casos, el email queda libre. Server action: `app/actions/accounts.ts`.
- **Sesión abierta:** si a alguien lo desactivan o lo eliminan mientras usa la app, queda deslogueado en su próxima acción: al pedir datos, al navegar o al volver a la pestaña (`onSessionRevoked`).
- **Modo mock:** «Restablecer datos de demo» (menú del avatar, solo admin) vuelve al seed y borra usuarios, contraseñas y videos de prueba de ese navegador.

## Deploy (Vercel)

- Proyecto `reactiveapp` en el team `reactive4`. Cada PR genera un preview; `main` es producción.
- Producción: **https://reactiveapp-reactive4.vercel.app** (hoy en modo mock: sin variables de entorno usa los datos de demo).
- Para pasar a Supabase: cargar en Vercel las variables de `.env.example` con `NEXT_PUBLIC_DATA_SOURCE=supabase` y seguir la sección «Supabase».
- Dominio propio (opcional): Vercel → Settings → Domains.

## Tests E2E (Playwright)

```bash
npx playwright install chromium   # la primera vez
npm run test:e2e                   # build + next start en :3200, modo mock
E2E_BASE_URL=https://<preview>.vercel.app npm run test:e2e   # contra un preview de Vercel
```

Cubren:
- **Flujo clave:** el profe importa `docs/ejemplos/readaptacion_martina_f2.xlsx`, resuelve «RDL c/ mancuernas», «Copenhague» y «Salto al cajón unipodal», publica para Martina; ella ve la rutina, abre el video de «Sentadilla goblet» y vuelve al mismo día y a la misma posición de scroll.
- **Pedir acceso:** aviso de cuenta existente, pedido nuevo, aprobación del profe, activación con el link, Hoy vacío y login con la contraseña creada.
- **Cambio de usuario:** cliente → logout → profe (el Panel carga sus datos, 3 veces seguidas) y profe → logout → cliente (ve su rutina y nada del profe).
- **Equipo:** el admin invita a un profe → el profe activa su cuenta con el link → ve el Panel; activación con código; un profe no puede entrar a «Equipo».
- **Cámara** (`e2e/camara.spec.ts`): con el permiso dado graba, revisa y usa el video; sin permiso muestra «Habilitar cámara»; bloqueada explica cómo habilitarla. Usa el Chrome instalado (perfil temporal y cámara simulada), porque el Chromium liviano de Playwright no tiene cámara.
- **Dos profes:** Nico carga una rutina → la clienta ve «Cargada por Nico R.»; Jano (nuevo) no ve los clientes de Nico ni los abre por URL, pero usa ejercicios y plantillas; el admin ve a todos y filtra por profe.
- **Reservas:** la paciente reserva un horario libre, el profe la confirma desde el Panel/Agenda y ella la ve agendada; el profe edita sus horarios (franjas que se pisan no se guardan) y, si apaga las reservas, la paciente no puede reservar.
- **Pagos** y **Avisos:** cobros, registrar un pago, WhatsApp de cobro; avisos de fábrica, marcar como vistos, cambiar los días y que se guarde por profe.
- **Usuarios:** email repetido (con otras mayúsculas) no se crea y ofrece «Ver ficha»; el profe desactiva a su cliente (no entra, se oculta, filtro «Desactivados», «Reactivar»); el admin elimina un cliente escribiendo su nombre y restablece la demo; el profe elimina a su propio cliente y Caro no ve ni puede borrar a los de Nico; eliminar a un profe con clientes exige reasignarlos.

El reporte HTML queda en `playwright-report/` (`npx playwright show-report`).

## Rutas útiles

- `/`: splash · `/login` · `/recuperar` · `/nueva-contrasena` · `/solicitar-acceso` · `/activar`
- `/app`: cliente (Hoy · Mi Rutina · Turnos · Ejercicios · Perfil)
- `/coach`: profe/admin (Panel · Clientes · Rutinas · Ejercicios) · `/coach/perfil` · `/coach/equipo` (admin)
- `/dev/ui`: catálogo de componentes del design system

## Estado por fase

- [x] **F0**: setup, tokens, fuentes, PWA y `/dev/ui`
- [x] **F1**: capa de datos (mock), auth simulada por rol, layouts, migraciones/RLS/seed de Supabase
- [x] **F2**: biblioteca de ejercicios con subida de video
- [x] **F3**: experiencia del cliente
- [x] **F4**: carga manual de rutinas (3 pasos, plantillas, duplicar y editar) + lista de Rutinas
- [x] **F5**: importación de Excel (plantilla, lectura, errores, matching con alias y vista previa)
- [x] **F6**: Panel, Clientes (ficha, alta, edición), Profes, «Primera vez / pedir acceso» y pulido
- [x] **F7**: E2E con Playwright (flujo clave, pedir acceso, cambio de usuario, equipo), gestión del equipo (Equipo, perfil del profe, `create-admin`, RLS de desactivados) y deploy en Vercel
- [x] **F8**: planificador con RPE/RIR objetivo, registro real por serie («¿Cómo te fue?») y pestaña Registro del profe
- [x] **F9**: agenda de turnos (Día/Semana, recurrentes, superposición, reprogramación, .ics y recordatorios por WhatsApp)
- [x] **F10**: pagos y recordatorios de cobro (planes, estados, packs, WhatsApp, ajustes, resumen y exportación)
- [x] **F11**: avisos del profe configurables (N días antes, N días después y cada M, pack con N sesiones, reprogramaciones), campanita y mail diario opcional
- [x] **F12**: reservas online de turnos (horarios del profe, reglas, días bloqueados, reserva y cancelación del paciente, confirmación del profe)
