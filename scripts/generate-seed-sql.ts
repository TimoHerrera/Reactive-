// Genera supabase/seed.sql a partir de lib/data/seed.ts (la misma fuente que usa el mock).
// Las fechas se escriben relativas a current_date / now() para que la demo no envejezca.
//   npm run db:seed-sql
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSeed, DEMO_PASSWORD } from "../lib/data/seed";
import { diffDays, todayISO } from "../lib/dates";

const NOW = new Date();
const TODAY = todayISO(NOW);
const db = buildSeed(TODAY, NOW);

const q = (v: string | null | undefined) => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
const num = (v: number | null | undefined) => (v == null ? "null" : String(v));
const bool = (v: boolean) => (v ? "true" : "false");
const arr = (v: string[]) => (v.length ? `array[${v.map(q).join(", ")}]::text[]` : "'{}'::text[]");
const date = (iso: string | null) => {
  if (!iso) return "null";
  const d = diffDays(TODAY, iso);
  return d === 0 ? "current_date" : `current_date ${d > 0 ? "+" : "-"} ${Math.abs(d)}`;
};
const ts = (iso: string | null) => {
  if (!iso) return "null";
  const secs = Math.round((NOW.getTime() - new Date(iso).getTime()) / 1000);
  return secs <= 0 ? "now()" : `now() - interval '${secs} seconds'`;
};

const out: string[] = [];
const push = (s: string) => out.push(s);

push(`-- Reactive App · datos de DEMO (generado por scripts/generate-seed-sql.ts — no editar a mano)
--
-- ⚠️  Crea usuarios de prueba con una contraseña conocida. Usalo SOLO en local o en un
--     proyecto de staging. NUNCA en producción.
--
-- Contraseña de todos los usuarios demo: la constante DEMO_PASSWORD de lib/data/seed.ts.

begin;
`);

push("-- ── Usuarios (auth) ─────────────────────────────────────────────");
for (const p of db.profiles) {
  push(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', ${q(p.id)}, 'authenticated', 'authenticated', ${q(p.email)},
  extensions.crypt(${q(DEMO_PASSWORD)}, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', ${q(p.fullName)}), now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), ${q(p.id)}, ${q(p.id)}, jsonb_build_object('sub', ${q(p.id)}, 'email', ${q(p.email)}), 'email', now(), now(), now())
on conflict do nothing;`);
}

push("\n-- ── Perfiles ────────────────────────────────────────────────────");
// Primero staff (los clientes referencian coach_id).
const ordered = [...db.profiles].sort((a, b) => (a.role === "client" ? 1 : 0) - (b.role === "client" ? 1 : 0));
for (const p of ordered) {
  push(`insert into public.profiles (id, role, full_name, email, phone, title, sport, case_type, case_detail, goal, coach_id, client_since, created_at)
values (${q(p.id)}, ${q(p.role)}, ${q(p.fullName)}, ${q(p.email)}, ${q(p.phone)}, ${q(p.title)}, ${q(p.sport)}, ${q(p.caseType)}, ${q(p.caseDetail)}, ${q(p.goal)}, ${q(p.coachId)}, ${date(p.clientSince)}, ${ts(p.createdAt)})
on conflict (id) do nothing;`);
}

push("\n-- ── Observaciones ───────────────────────────────────────────────");
for (const n of db.coachNotes) {
  push(`insert into public.coach_notes (id, client_id, author_id, body, created_at) values (${q(n.id)}, ${q(n.clientId)}, ${q(n.authorId)}, ${q(n.body)}, ${ts(n.createdAt)}) on conflict (id) do nothing;`);
}

push("\n-- ── Ejercicios ──────────────────────────────────────────────────");
push("-- Nota: video_path de demo apunta a archivos que no existen en Storage. Subí los videos desde la app.");
for (const e of db.exercises) {
  push(`insert into public.exercises (id, name, aliases, category, muscle_groups, equipment, video_path, video_poster_path, video_duration_s, youtube_url, technique_cues, common_mistakes, created_by, created_at, updated_at)
values (${q(e.id)}, ${q(e.name)}, ${arr(e.aliases)}, ${q(e.category)}, ${arr(e.muscleGroups)}, ${q(e.equipment)}, ${q(e.videoPath)}, ${q(e.videoPosterPath)}, ${num(e.videoDurationS)}, ${q(e.youtubeUrl)}, ${arr(e.techniqueCues)}, ${arr(e.commonMistakes)}, ${q(e.createdBy)}, ${ts(e.createdAt)}, ${ts(e.updatedAt)})
on conflict (id) do nothing;`);
}

push("\n-- ── Rutinas ─────────────────────────────────────────────────────");
for (const r of db.routines) {
  push(`insert into public.routines (id, name, client_id, is_template, source_template_id, starts_on, ends_on, days_per_week, client_message, created_by, published_at, created_at)
values (${q(r.id)}, ${q(r.name)}, ${q(r.clientId)}, ${bool(r.isTemplate)}, ${q(r.sourceTemplateId)}, ${date(r.startsOn)}, ${date(r.endsOn)}, ${r.daysPerWeek}, ${q(r.clientMessage)}, ${q(r.createdBy)}, ${ts(r.publishedAt)}, ${ts(r.createdAt)})
on conflict (id) do nothing;`);
}
for (const d of db.routineDays) {
  push(`insert into public.routine_days (id, routine_id, label, title, position) values (${q(d.id)}, ${q(d.routineId)}, ${q(d.label)}, ${q(d.title)}, ${d.position}) on conflict (id) do nothing;`);
}
for (const b of db.routineBlocks) {
  push(`insert into public.routine_blocks (id, day_id, name, position) values (${q(b.id)}, ${q(b.dayId)}, ${q(b.name)}, ${b.position}) on conflict (id) do nothing;`);
}
for (const i of db.routineItems) {
  push(`insert into public.routine_items (id, block_id, exercise_id, raw_name, position, sets, reps, load, rest, tempo, notes) values (${q(i.id)}, ${q(i.blockId)}, ${q(i.exerciseId)}, ${q(i.rawName)}, ${i.position}, ${num(i.sets)}, ${q(i.reps)}, ${q(i.load)}, ${q(i.rest)}, ${q(i.tempo)}, ${q(i.notes)}) on conflict (id) do nothing;`);
}

push("\n-- ── Actividad ───────────────────────────────────────────────────");
for (const s of db.workoutSessions) {
  push(`insert into public.workout_sessions (id, client_id, routine_id, day_id, started_at, completed_at) values (${q(s.id)}, ${q(s.clientId)}, ${q(s.routineId)}, ${q(s.dayId)}, ${ts(s.startedAt)}, ${ts(s.completedAt)}) on conflict (id) do nothing;`);
}
for (const c of db.itemChecks) {
  push(`insert into public.item_checks (session_id, item_id, checked_at) values (${q(c.sessionId)}, ${q(c.itemId)}, ${ts(c.checkedAt)}) on conflict do nothing;`);
}
for (const v of db.exerciseViews) {
  push(`insert into public.exercise_views (client_id, exercise_id, viewed_at) values (${q(v.clientId)}, ${q(v.exerciseId)}, ${ts(v.viewedAt)});`);
}

push("\n-- ── Solicitudes de acceso ────────────────────────────────────────");
for (const r of db.accessRequests) {
  push(`insert into public.access_requests (id, full_name, email, phone, requested_coach_id, case_type, message, status, created_at) values (${q(r.id)}, ${q(r.fullName)}, ${q(r.email)}, ${q(r.phone)}, ${q(r.requestedCoachId)}, ${q(r.caseType)}, ${q(r.message)}, ${q(r.status)}, ${ts(r.createdAt)}) on conflict (id) do nothing;`);
}

push("\ncommit;\n");

const target = resolve(__dirname, "../supabase/seed.sql");
writeFileSync(target, out.join("\n"), "utf8");
console.log(`seed.sql generado: ${db.profiles.length} perfiles, ${db.exercises.length} ejercicios, ${db.routines.length} rutinas`);
