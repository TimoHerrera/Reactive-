# Prompt para Claude Code — Reactive App (MVP)

Vas a construir el MVP de **Reactive App**, una PWA mobile-first para REACTIVE – Rehabilitación y Entrenamiento, un centro de kinesiología deportiva y entrenamiento de Buenos Aires. Te paso el diseño hecho en Claude Design, ya sea como handoff o como el PDF "REACTIVE — MVP mobile" en /docs. **El diseño es la fuente de verdad visual**: replicá pantallas, textos, tokens y componentes tal cual. Si algo de este prompt contradice el diseño en lo visual, gana el diseño; en lo funcional, gana este prompt.

## Objetivo del producto
Cada cliente del gimnasio ve su rutina personalizada, cargada por su profe, y puede tocar el nombre de cualquier ejercicio para ver el video explicativo que grabó el profe. Los profes y admins cargan ejercicios con video, crean rutinas (a mano o importando un Excel) y las asignan a cada cliente. Lema: "¡Sin rutinas genéricas!".

## Stack (usalo salvo que haya un motivo fuerte para cambiarlo; si lo cambiás, avisame antes)
- **Next.js 14+ (App Router) + TypeScript + Tailwind CSS**, con los tokens del design system en `tailwind.config` (colores, fuentes y radios del PDF)
- **Fuentes:** Barlow Condensed (800 italic para display) y Barlow, con `next/font/google`
- **Supabase:** Postgres, Auth con email y contraseña, Storage para los videos y Row Level Security para los roles
- **SheetJS (`xlsx`):** leer y generar Excel/CSV en el cliente
- **`fuse.js`** o similar: matching difuso de nombres de ejercicios
- **PWA:** manifest, íconos con la "R", `theme-color` #0A0A0A y, como mínimo, cache del app shell
- **Deploy en Vercel.** Variables en `.env.local` con un `.env.example` documentado.

## Repo, deploy y estado de la infraestructura
- **Repo:** https://github.com/TimoHerrera/Reactive- (rama `main`). Trabajá en ramas por fase y abrí un PR por fase.
- **Vercel:** team `reactive4`. Hay que importar este repo como proyecto: cada PR genera un preview para probar en el celular y `main` es producción.
- **Supabase TODAVÍA NO ESTÁ CREADO.** No bloquees el avance por eso:
  - Armá una capa de datos con interfaces en `lib/data`, con una implementación **mock** en memoria basada en el seed, para desarrollar y probar toda la UI.
  - Incluí un switch por variable de entorno (`DATA_SOURCE=mock|supabase`).
  - Dejá escritas las migraciones SQL, las políticas RLS y el seed, listas para correr.
  - Cuando te pase las claves, conectás la implementación de Supabase sin tocar las pantallas.

## Roles y acceso
- Roles: `admin`, `coach` (profe) y `client`. Login compartido; según el rol se redirige a `/app` (cliente) o `/coach` (profe/admin).
- **No hay registro público.** El profe crea al cliente desde "+ Cliente": se invita por email con Supabase Admin, en un server action con la service role key, que nunca va al cliente.
- La recuperación de contraseña se hace con el flujo de Supabase.
- RLS:
  - El cliente solo lee su perfil, sus rutinas, los días, bloques e ítems de sus rutinas, y todos los ejercicios. Solo escribe sus registros de entrenamiento y vistas.
  - El cliente NUNCA ve las "Observaciones del profesional".
  - Coach y admin leen y escriben todo. Solo el admin gestiona a otros profes.

## Modelo de datos (migraciones SQL en `supabase/migrations`)
- **`profiles`:** id (= auth.users.id), role, full_name, phone, sport, case_type (`lesion_deportiva` | `postquirurgico` | `dolor_cronico` | `rendimiento`), goal, coach_id → profiles, client_since, created_at
- **`coach_notes`:** id, client_id, author_id, body, created_at (solo profes)
- **`exercises`:** id, name, aliases text[], category (Fuerza / Activación / Movilidad / Potencia / Agilidad / Core), muscle_groups text[], equipment, video_path (archivo subido al bucket `exercise-videos`; es el video PRINCIPAL), video_poster_path (miniatura), video_duration_s, youtube_url (OPCIONAL, link complementario), technique_cues text[], common_mistakes text[], created_by, timestamps
- **`routines`:** id, name, client_id (null si es plantilla), is_template, source_template_id, starts_on, ends_on, days_per_week, client_message (sale como "Nota del profe"), created_by, published_at. El estado (activa / por vencer ≤ 7 días / vencida) se calcula, no se guarda.
- **`routine_days`:** id, routine_id, label (A, B, C…), title ("Tren inferior"), position
- **`routine_blocks`:** id, day_id, name (Entrada en calor / Bloque principal / Accesorios / Core / Movilidad), position
- **`routine_items`:** id, block_id, exercise_id (nullable), raw_name (el nombre tal como vino del Excel), position, sets, reps (texto: "8", "45 s c/lado"), load, rest, tempo, notes
- **`workout_sessions`:** id, client_id, routine_id, day_id, started_at, completed_at
- **`item_checks`:** session_id, item_id, checked_at
- **`exercise_views`:** client_id, exercise_id, viewed_at (alimenta "Joaquín vio «Nordic hamstring» 3 veces")

Seed (`supabase/seed.sql`) con los datos del diseño:
- Profe: Nico R., kinesiólogo deportivo
- Clientes: Martina G., Sofía R., Tomás L., Joaquín M., Valentina P., Lucas B., Camila F. y Federico A., con sus casos
- Rutina "Readaptación – Fase 2" de Martina, con Días A/B/C
- Unos 15 ejercicios con alias (por ejemplo "Peso muerto rumano" con los alias RDL y "RDL c/ mancuernas"; "Nordic hamstring" con Nordic, Nordic curl y Curl nórdico; "Copenhagen plank" con Copenhague)

## Pantallas (todas las del diseño)
**Cliente** — tab bar: Hoy · Mi Rutina · Ejercicios · Perfil
- Splash
- Login (con error "Email o contraseña incorrectos")
- **Hoy:** saludo con fecha, sesión del día con "EMPEZAR →", progreso semanal, card del profe y nota del profe con pincel
- **Mi Rutina:**
  - Chips de días, barra "X de N hechos", bloques y cards de ejercicio
  - Check de completado: se guarda en `item_checks` con UI optimista
  - Nombre subrayado en azul con ▶ si hay video y tocable en todo su ancho (mín. 44 px); sin video, sin ▶ y no tocable
- **Detalle de ejercicio** (`/app/ejercicios/[id]?from=rutina&item=...`):
  - Video 9:16 con play/pausa, velocidad 1× / 0.5×, loop y barra de progreso
  - "Tu serie de hoy", claves técnicas, "Errores comunes / No hagas esto" y "← VOLVER A MI RUTINA"
  - **Al volver se restaura el mismo día y la misma posición de scroll**
  - Registra la vista en `exercise_views`
- **Ejercicios:** buscador (por nombre, alias o músculo, sin importar acentos), chips de filtro y grilla con duración
- **Perfil:** datos, objetivo, profe, rutinas anteriores, servicios de Reactive, botón de WhatsApp y cerrar sesión
- **Estados:** vacío ("Tu profe todavía no cargó tu rutina") y carga ("Calentando motores…")

**Profe / Admin** — tab bar: Panel · Clientes · Rutinas · Ejercicios
- **Panel:** 3 métricas, accesos rápidos y actividad reciente (sesiones completadas, parciales, rutinas que vencen, vistas repetidas de un video)
- **Clientes:** lista con buscador y filtros (Todos / Activa / Por vencer / Sin rutina), alta de cliente y ficha (tipo de caso, objetivo, observaciones solo para profes, rutina actual con progreso, Editar y Asignar rutina)
- **Rutinas:** tabs Activas / Plantillas / Vencidas, más duplicar y editar
- **Ejercicios:** lista con "SIN VIDEO" y "N alias", filtro "Ver solo sin video", y formulario de edición:
  - Nombre y alias como chips
  - Categoría, equipamiento y grupo muscular
  - Video: **"Subir video" es la acción principal**, desde la galería o la cámara del celular. Debajo, opcional, "Link de YouTube (opcional)" con validación. Preview del video subido.
  - Claves técnicas y errores comunes
  - Autoguardado con el indicador "Guardado HH:MM"
- **Nueva rutina:** elegir A) Carga manual, B) Importar Excel o partir de una plantilla
  - **Manual, 3 pasos:**
    1. Datos (nombre, cliente/s, inicio/fin con atajos de 2/4/6 semanas, días por semana, mensaje para el cliente)
    2. Días y ejercicios (tabs de días, + Día, duplicar día, bloques colapsables, reordenar con drag con `@dnd-kit`, buscador con autocompletado que muestre "▶ con video" / "sin video" y el alias que matcheó)
    3. Asignar y publicar (resumen, vigencia, "guardar también como plantilla" y aviso si reemplaza a una rutina vigente)
  - **Importar Excel:** ver la sección de abajo
  - **Pantalla de éxito:** "RUTINA PUBLICADA", "VER COMO MARTINA →" y "Volver al panel"

## Importación de Excel (lo más importante de la lógica)
1. **Plantilla descargable** generada con SheetJS. Columnas exactas: `Día | Bloque | Orden | Ejercicio | Series | Reps | Carga | Descanso | Notas`, con 2 filas de ejemplo.
2. **Lectura:** .xlsx o .csv de hasta 5 MB. Encabezados normalizados (minúsculas, sin acentos, sin espacios extra). Pantalla "Leyendo tu planilla…" con los pasos reales: columnas reconocidas, días y bloques detectados, búsqueda en la biblioteca.
3. **Errores bloqueantes y advertencias** (pantalla "No pudimos leer tu archivo"):
   - Falta una columna obligatoria. Si encontrás un sinónimo, sugerilo: "Encontramos «Nombre» en su lugar".
   - Series no numéricas: convertí "tres" → 3 si es trivial y, si no, error con el número de fila.
   - Filas sin Día: advertencia de que se asignan al Día A.
4. **Matching** contra la biblioteca, con texto normalizado (minúsculas, sin acentos, sin puntuación):
   - Igualdad exacta con el nombre o un alias → ✓ reconocido (con video o sin video)
   - Similitud alta (fuse.js, umbral configurable) → "! Revisar: ¿Quisiste decir…?", con las opciones **Vincular** (y guardar el texto original como alias nuevo del ejercicio) o **Elegir otro**
   - Sin coincidencia → "✕ No encontrado", con las opciones **Vincular a uno existente** o **Crear ejercicio nuevo** (formulario rápido; el video se sube después)
   - Se puede publicar con ítems sin vincular: quedan con `raw_name` y sin video
5. **Vista previa:** contadores (reconocidos / a revisar / no encontrados), tabs por día y tabla con scroll horizontal dentro de la card en mobile. Al final se pasa al paso 3 (Asignar y publicar).
6. La lógica de parseo y matching va en funciones puras (`lib/import/`), con **tests unitarios en Vitest**, incluidos los casos del diseño: «RDL c/ mancuernas» → Peso muerto rumano, «Copenhague» → Copenhagen plank, «Salto al cajón unipodal» → no encontrado, columna «Nombre» y Series «tres».

## Videos de ejercicios (los suben los profes directamente)
- **El método principal es subir el archivo desde la app.** Los profes graban con el celular y lo suben desde el formulario del ejercicio. YouTube es solo un complemento opcional.
- **Storage:** bucket privado `exercise-videos` en Supabase. Solo coach y admin suben y borran; cualquier usuario logueado reproduce con **URLs firmadas** de vencimiento corto. En modo mock, guardá el archivo con `URL.createObjectURL` o en `/public/mock-videos`.
- **Subida:**
  - Acepta `video/mp4`, `video/quicktime` (.mov) y `video/webm`.
  - Muestra barra de progreso y permite cancelar.
  - Usá **subida reanudable (TUS)** de Supabase, para que una mala conexión en el gimnasio no la corte.
  - Antes de subir, validá la duración (sugerido: hasta 60 s) y el tamaño. El límite se configura con la variable `MAX_VIDEO_MB`, con 50 por defecto, que es el límite por archivo del plan gratis de Supabase. Si el archivo se pasa, el mensaje explica cómo achicarlo (grabar en 1080p o 720p, recortar).
  - Generá la **miniatura** en el navegador (frame a 1 s con `<video>` + canvas) y subila como `video_poster_path`. Guardá `video_duration_s`.
  - Tip en la UI para iPhone: en Ajustes → Cámara → Formatos, elegir **"Más compatible"** (H.264), para que se vea bien también en Android.
- **Reproducción** (detalle del ejercicio):
  - `<video playsinline muted loop preload="metadata" poster=...>`, con los controles propios del diseño (play/pausa, 1× / 0.5×, loop, barra)
  - Si el ejercicio también tiene `youtube_url`, mostrá un botón secundario **"Ver en YouTube ↗"** que abre el link (app o pestaña nueva)
  - Si NO hay video subido pero sí link de YouTube, usá el embed de `youtube-nocookie` como fallback
  - "Con video" (▶ en la rutina y check en la importación) = tiene `video_path` o `youtube_url`
- **Biblioteca del profe:** "SIN VIDEO" = no tiene ninguno de los dos. Badge chico "▶ + YT" cuando tiene ambos.

## Calidad
- Mobile-first a 390 px. Que en desktop se vea centrado como un teléfono (máx. ~480 px) o con un layout razonable.
- Accesibilidad:
  - Áreas táctiles de 44 px como mínimo
  - Foco visible
  - El texto azul nunca va sobre negro (el azul va de fondo o subrayado), como dice el design system
- Sin sombras. Jerarquía bg → surface → surface-2.
- Componentes reutilizables en `components/ui`, con los mismos nombres que el design system:
  - PillButton, Stripe (franja), BrushNote, ExerciseCard, DayChip, StatusBadge, TabBar, Input, Avatar, ImportPreviewTable
  - Una página `/dev/ui` que los muestre todos
- Copy en español rioplatense, tal cual el diseño.
- Videos: ver la sección «Videos de ejercicios».

## Forma de trabajo
1. Arrancá en **modo plan**: leé el diseño completo, proponeme la estructura de carpetas, el esquema de la base de datos y el orden de las fases, y esperá mi OK.
2. Construí por fases y, al cerrar cada una, mostrame cómo probarla, corré lint, typecheck y tests, y hacé un commit:
   - **F0:** setup, tokens, fuentes, PWA y `/dev/ui`
   - **F1:** capa de datos con mock, auth simulada por rol (para probar ambas experiencias), layouts con tab bars, y las migraciones, RLS y seed de Supabase escritas (se conectan cuando haya claves)
   - **F2:** biblioteca de ejercicios (CRUD del profe con subida de video, vista del cliente y detalle con video)
   - **F3:** experiencia del cliente (Hoy, Mi Rutina con checks, flujo Rutina → Video → Volver y Perfil)
   - **F4:** carga manual de rutinas (3 pasos, plantillas y duplicar)
   - **F5:** importación de Excel con matching, vista previa, errores y tests
   - **F6:** Panel, Clientes, Rutinas, estados vacíos y de carga, y pulido
   - **F7:** prueba E2E con Playwright del flujo clave (profe importa un Excel → publica → la clienta ve la rutina → abre el video → vuelve) y deploy en Vercel
3. Si te falta algo (claves de Supabase, el logo en SVG), pedímelo puntualmente; no inventes credenciales.
4. Dejá un `README.md` con el setup local, cómo correr las migraciones y el seed, y cómo crear el primer admin.

## Agregado: flujo "Primera vez" / pedir acceso (después de la F4)
1. En el login, "¿Primera vez? Pedile tu acceso a tu profe" pasa a ser un link a `/solicitar-acceso`.
2. **`/solicitar-acceso`** (misma estética que el login):
   - Campos: nombre y apellido, email, WhatsApp, profe (selector con los profes activos + "Todavía no tengo"), tipo de caso (chips: Lesión deportiva / Postquirúrgico / Dolor crónico / Rendimiento) y mensaje opcional.
   - Botón "PEDIR ACCESO →".
   - Si ya hay una solicitud pendiente con ese email, avisarlo. Si ya existe la cuenta, mostrar: "Ya tenés cuenta: ingresá o recuperá tu contraseña".
3. **Pantalla de éxito:** "¡LISTO! Tu profe ya recibió tu pedido. Te va a llegar un mail para activar tu cuenta.", con un botón secundario "Escribinos por WhatsApp" que lleve a https://wa.link/tk8wy7 (el link de la bio de Reactive).
4. **Tabla `access_requests`:** id, full_name, email, phone, requested_coach_id, case_type, message, status (pending / approved / rejected), created_at, reviewed_by, reviewed_at, reject_reason.
   - RLS: el usuario anónimo solo puede insertar con status pending; leer y actualizar, solo coach y admin.
   - Anti-spam: campo honeypot y límite de pedidos por email/IP.
5. **Panel del profe:**
   - Card "Solicitudes de acceso (N)" en el Panel, más un filtro "Solicitudes" en Clientes.
   - **Aprobar** crea el cliente con los datos ya cargados, lo asigna al profe y envía la invitación por mail.
   - **Rechazar** pide un motivo opcional.
6. **Activación:** la invitación lleva a `/activar`, con la pantalla "CREÁ TU CONTRASEÑA" en el estilo del login. Después entra directo a Hoy, con el estado vacío si todavía no tiene rutina.
7. **En modo mock** todo funciona igual: la invitación se simula mostrándole al profe el link de activación.
8. Tests unitarios del flujo, y sumarlo al E2E de la F7.
