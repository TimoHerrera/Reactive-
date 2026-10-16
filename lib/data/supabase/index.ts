// Implementación Supabase de la capa de datos. Corre en el navegador con la anon key:
// la seguridad la garantiza RLS (supabase/migrations/0002_rls.sql).
import * as tus from "tus-js-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { SUPABASE_URL, VIDEO_BUCKET } from "@/lib/supabase/env";
import { inviteClient } from "@/app/actions/clients";
import {
  createInviteCode,
  deactivateStaff,
  inviteStaff,
  markActivated,
  reactivateStaff,
  redeemInviteCode,
  resendInvite,
  setStaffRole,
} from "@/app/actions/team";
import { approveAccessRequest, listPublicCoaches, submitAccessRequest } from "@/app/actions/access";
import { deleteUser, setClientActive } from "@/app/actions/accounts";
import { emitSessionRevoked } from "@/lib/auth/session-events";
import { DuplicateEmailError, type ExistingUser } from "../errors";
import type { DataSource, SetLogInput } from "../repositories";
import { cleanSetLogs } from "@/lib/routine/setlogs";
import { applyPatch, buildAppointments } from "@/lib/agenda/series";
import { addDays } from "@/lib/dates";
import { baStartOfDay } from "@/lib/agenda/time";
import { DEFAULT_APPOINTMENT_TEMPLATE } from "@/lib/agenda/agenda";
import { DEFAULT_PAYMENT_TEMPLATE } from "@/lib/billing/status";
import { validatePayment, validatePlan } from "@/lib/billing/validate";
import { defaultPrefs, validatePrefs } from "@/lib/notify/alerts";

/** Errores de server actions → excepción (con «Ver ficha» si el email ya existe). */
function fail(res: { error: string; existing?: ExistingUser | null }): never {
  if (res.existing !== undefined) throw new DuplicateEmailError(res.existing);
  throw new Error(res.error);
}
import { accountStatus } from "../types";
import type {
  AccessRequest,
  CoachNote,
  Exercise,
  ExerciseView,
  Appointment,
  AppSettings,
  ItemCheck,
  SetLog,
  Profile,
  Routine,
  RoutineTree,
  SessionUser,
  WorkoutSession,
} from "../types";

import { fromPrefs, toAppointment, toPayment, toPlan, toPrefs, toProfile, type Row } from "./rows";

const sb = (): SupabaseClient => getBrowserSupabase();

function check({ data, error }: { data: unknown; error: { message: string } | null }): unknown {
  if (error) throw new Error(error.message);
  return data;
}

// ── Mapeos fila ↔ dominio ─────────────────────────────────────────

const fromProfilePatch = (p: Partial<Profile>): Row => {
  const map: Record<string, string> = {
    fullName: "full_name",
    email: "email",
    phone: "phone",
    title: "title",
    sport: "sport",
    caseType: "case_type",
    caseDetail: "case_detail",
    goal: "goal",
    coachId: "coach_id",
    clientSince: "client_since",
    bio: "bio",
    avatarPath: "avatar_path",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(p)) if (map[k]) out[map[k]!] = v;
  return out;
};

const toExercise = (r: Row): Exercise => ({
  id: r.id as string,
  name: r.name as string,
  aliases: (r.aliases as string[]) ?? [],
  category: r.category as Exercise["category"],
  muscleGroups: (r.muscle_groups as string[]) ?? [],
  equipment: (r.equipment as string) ?? null,
  videoPath: (r.video_path as string) ?? null,
  videoPosterPath: (r.video_poster_path as string) ?? null,
  videoDurationS: (r.video_duration_s as number) ?? null,
  youtubeUrl: (r.youtube_url as string) ?? null,
  techniqueCues: (r.technique_cues as string[]) ?? [],
  commonMistakes: (r.common_mistakes as string[]) ?? [],
  createdBy: (r.created_by as string) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const fromExercise = (e: Partial<Exercise>): Row => {
  const map: Record<string, string> = {
    name: "name",
    aliases: "aliases",
    category: "category",
    muscleGroups: "muscle_groups",
    equipment: "equipment",
    videoPath: "video_path",
    videoPosterPath: "video_poster_path",
    videoDurationS: "video_duration_s",
    youtubeUrl: "youtube_url",
    techniqueCues: "technique_cues",
    commonMistakes: "common_mistakes",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(e)) if (map[k]) out[map[k]!] = v;
  return out;
};

const toRoutine = (r: Row): Routine => ({
  id: r.id as string,
  name: r.name as string,
  clientId: (r.client_id as string) ?? null,
  isTemplate: !!r.is_template,
  sourceTemplateId: (r.source_template_id as string) ?? null,
  startsOn: (r.starts_on as string) ?? null,
  endsOn: (r.ends_on as string) ?? null,
  daysPerWeek: (r.days_per_week as number) ?? 0,
  clientMessage: (r.client_message as string) ?? null,
  createdBy: (r.created_by as string) ?? null,
  updatedBy: (r.updated_by as string) ?? null,
  updatedAt: (r.updated_at as string) ?? null,
  publishedAt: (r.published_at as string) ?? null,
  createdAt: r.created_at as string,
});

const toAccessRequest = (r: Row): AccessRequest => ({
  id: r.id as string,
  fullName: r.full_name as string,
  email: r.email as string,
  phone: (r.phone as string) ?? null,
  requestedCoachId: (r.requested_coach_id as string) ?? null,
  caseType: (r.case_type as AccessRequest["caseType"]) ?? null,
  message: (r.message as string) ?? null,
  status: r.status as AccessRequest["status"],
  createdAt: r.created_at as string,
  reviewedBy: (r.reviewed_by as string) ?? null,
  reviewedAt: (r.reviewed_at as string) ?? null,
  rejectReason: (r.reject_reason as string) ?? null,
  linkedProfileId: (r.linked_profile_id as string) ?? null,
});

const toSession = (r: Row): WorkoutSession => ({
  id: r.id as string,
  clientId: r.client_id as string,
  routineId: r.routine_id as string,
  dayId: r.day_id as string,
  startedAt: r.started_at as string,
  completedAt: (r.completed_at as string) ?? null,
});

const toSetLog = (r: Row): SetLog => ({
  sessionId: r.session_id as string,
  itemId: r.item_id as string,
  setNumber: r.set_number as number,
  reps: (r.reps as string) ?? null,
  load: (r.load as string) ?? null,
  rpe: r.rpe == null ? null : Number(r.rpe),
  note: (r.note as string) ?? null,
  createdAt: r.created_at as string,
});

const fromSetLog = (l: SetLogInput): Row => ({ set_number: l.setNumber, reps: l.reps, load: l.load, rpe: l.rpe, note: l.note });

const fromAppointment = (a: Appointment): Row => ({
  id: a.id,
  client_id: a.clientId,
  coach_id: a.coachId,
  starts_at: a.startsAt,
  duration_min: a.durationMin,
  type: a.type,
  status: a.status,
  notes: a.notes,
  series_id: a.seriesId,
  reschedule_reason: a.rescheduleReason,
  reschedule_preference: a.reschedulePreference,
  reschedule_requested_at: a.rescheduleRequestedAt,
});

const newId = () => crypto.randomUUID();

const toSettings = (r: Row | null): AppSettings => ({
  transferAlias: (r?.transfer_alias as string) ?? "",
  paymentTemplate: (r?.payment_template as string) ?? DEFAULT_PAYMENT_TEMPLATE,
  appointmentTemplate: (r?.appointment_template as string) ?? DEFAULT_APPOINTMENT_TEMPLATE,
  showBillingToClient: !!r?.show_billing_to_client,
  updatedAt: (r?.updated_at as string) ?? null,
});

/** El turno y, si es de una serie, el resto de la serie (para «este y los siguientes»). */
async function withSeries(id: string): Promise<Appointment[]> {
  const row = check(await sb().from("appointments").select("*").eq("id", id).maybeSingle()) as Row | null;
  if (!row) throw new Error("Turno no encontrado");
  if (!row.series_id) return [toAppointment(row)];
  return (check(await sb().from("appointments").select("*").eq("series_id", row.series_id as string)) as Row[]).map(toAppointment);
}

const ROUTINE_TREE_SELECT =
  "*, routine_days(*, routine_blocks(*, routine_items(*)))";

function toTree(r: Row): RoutineTree {
  const days = ((r.routine_days as Row[]) ?? []).sort((a, b) => (a.position as number) - (b.position as number));
  return {
    ...toRoutine(r),
    days: days.map((d) => ({
      id: d.id as string,
      routineId: d.routine_id as string,
      label: d.label as string,
      title: (d.title as string) ?? "",
      position: d.position as number,
      blocks: ((d.routine_blocks as Row[]) ?? [])
        .sort((a, b) => (a.position as number) - (b.position as number))
        .map((b) => ({
          id: b.id as string,
          dayId: b.day_id as string,
          name: b.name as string,
          position: b.position as number,
          items: ((b.routine_items as Row[]) ?? [])
            .sort((a, c) => (a.position as number) - (c.position as number))
            .map((i) => ({
              id: i.id as string,
              blockId: i.block_id as string,
              exerciseId: (i.exercise_id as string) ?? null,
              rawName: i.raw_name as string,
              position: i.position as number,
              sets: (i.sets as number) ?? null,
              reps: (i.reps as string) ?? null,
              load: (i.load as string) ?? null,
              rest: (i.rest as string) ?? null,
              tempo: (i.tempo as string) ?? null,
              rpeTarget: (i.rpe_target as string) ?? null,
              rirTarget: (i.rir_target as string) ?? null,
              notes: (i.notes as string) ?? null,
            })),
        })),
    })),
  };
}

async function sessionUser(): Promise<SessionUser | null> {
  const { data } = await sb().auth.getUser();
  if (!data.user) return null;
  const row = check(await sb().from("profiles").select("*").eq("id", data.user.id).maybeSingle());
  const p = row ? toProfile(row as Row) : null;
  if (!p || p.disabledAt) {
    // Desactivado o eliminado con la sesión abierta: se corta en esta acción y la app va al login.
    await sb().auth.signOut();
    emitSessionRevoked();
    return null;
  }
  return { id: p.id, role: p.role, fullName: p.fullName, email: p.email || data.user.email || "" };
}

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

export const supabaseDataSource: DataSource = {
  kind: "supabase",

  auth: {
    getUser: sessionUser,
    async signIn(email, password) {
      const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { ok: false, error: "Email o contraseña incorrectos." };
      const user = await sessionUser();
      return user ? { ok: true, user } : { ok: false, error: "Tu usuario no tiene perfil. Hablá con tu profe." };
    },
    async signOut() {
      await sb().auth.signOut();
    },
    async requestPasswordReset(email) {
      const { error } = await sb().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${siteUrl()}/auth/callback?next=/nueva-contrasena`,
      });
      if (error) throw new Error(error.message);
    },
    async updatePassword(password) {
      const { error } = await sb().auth.updateUser({ password });
      if (error) throw new Error(error.message);
      await markActivated();
    },
    async redeemCode(email, code, password) {
      const res = await redeemInviteCode(email, code, password);
      if (!res.ok) return res;
      const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { ok: false, error: "La cuenta quedó activa, pero no pudimos iniciar sesión. Probá ingresar." };
      const user = await sessionUser();
      return user ? { ok: true, user } : { ok: false, error: "No pudimos iniciar sesión." };
    },
    async activate() {
      // La sesión ya la dejó /auth/callback con el link de la invitación.
      return sessionUser();
    },
  },

  profiles: {
    async get(id) {
      const row = check(await sb().from("profiles").select("*").eq("id", id).maybeSingle());
      return row ? toProfile(row as Row) : null;
    },
    async listClients() {
      const rows = check(await sb().from("profiles").select("*").eq("role", "client").order("full_name"));
      return (rows as Row[]).map(toProfile);
    },
    async listStaff() {
      const rows = check(await sb().from("profiles").select("*").in("role", ["coach", "admin"]).order("full_name"));
      return (rows as Row[]).map(toProfile);
    },
    async update(id, patch) {
      const row = check(await sb().from("profiles").update(fromProfilePatch(patch)).eq("id", id).select().single());
      return toProfile(row as Row);
    },
    async createClient(input) {
      const res = await inviteClient(input);
      if (!res.ok) fail(res);
      return res.profile;
    },
    async setClientActive(id, active) {
      const res = await setClientActive(id, active);
      if (!res.ok) fail(res);
      return res.profile;
    },
    async remove(id, opts) {
      const res = await deleteUser(id, opts);
      if (!res.ok) fail(res);
    },

  },

  coachNotes: {
    async listForClient(clientId) {
      const rows = check(
        await sb().from("coach_notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      );
      return (rows as Row[]).map(
        (r): CoachNote => ({
          id: r.id as string,
          clientId: r.client_id as string,
          authorId: r.author_id as string,
          body: r.body as string,
          createdAt: r.created_at as string,
        }),
      );
    },
    async add(clientId, body) {
      const user = await sessionUser();
      const r = check(
        await sb().from("coach_notes").insert({ client_id: clientId, author_id: user?.id, body }).select().single(),
      ) as Row;
      return {
        id: r.id as string,
        clientId,
        authorId: r.author_id as string,
        body,
        createdAt: r.created_at as string,
      };
    },
  },

  exercises: {
    async list() {
      const rows = check(await sb().from("exercises").select("*").order("name"));
      return (rows as Row[]).map(toExercise);
    },
    async get(id) {
      const row = check(await sb().from("exercises").select("*").eq("id", id).maybeSingle());
      return row ? toExercise(row as Row) : null;
    },
    async create(input) {
      const user = await sessionUser();
      const row = check(
        await sb()
          .from("exercises")
          .insert({ ...fromExercise(input), created_by: user?.id })
          .select()
          .single(),
      );
      return toExercise(row as Row);
    },
    async update(id, patch) {
      const row = check(await sb().from("exercises").update(fromExercise(patch)).eq("id", id).select().single());
      return toExercise(row as Row);
    },
    async remove(id) {
      check(await sb().from("exercises").delete().eq("id", id));
    },
    async addAlias(id, alias) {
      const row = check(await sb().rpc("add_exercise_alias", { p_exercise_id: id, p_alias: alias.trim() }));
      return toExercise(row as Row);
    },
  },

  routines: {
    async list() {
      const rows = check(await sb().from("routines").select("*").order("created_at", { ascending: false }));
      return (rows as Row[]).map(toRoutine);
    },
    async listForClient(clientId) {
      const rows = check(
        await sb().from("routines").select("*").eq("client_id", clientId).order("starts_on", { ascending: false }),
      );
      return (rows as Row[]).map(toRoutine);
    },
    async getTree(id) {
      const row = check(await sb().from("routines").select(ROUTINE_TREE_SELECT).eq("id", id).maybeSingle());
      return row ? toTree(row as Row) : null;
    },
    async saveTree(tree) {
      // RPC transaccional: reemplaza días, bloques e ítems en una sola operación.
      const id = check(await sb().rpc("save_routine_tree", { p_tree: tree })) as string;
      const saved = await this.getTree(id);
      if (!saved) throw new Error("No se pudo guardar la rutina.");
      return saved;
    },
    async publish(id) {
      const row = check(
        await sb().from("routines").update({ published_at: new Date().toISOString() }).eq("id", id).select().single(),
      );
      return toRoutine(row as Row);
    },
    async update(id, patch) {
      const map: Record<string, string> = { name: "name", startsOn: "starts_on", endsOn: "ends_on", clientMessage: "client_message" };
      const row: Row = {};
      for (const [k, v] of Object.entries(patch)) if (map[k]) row[map[k]!] = v;
      const saved = check(await sb().from("routines").update(row).eq("id", id).select().single());
      return toRoutine(saved as Row);
    },
    async itemCounts() {
      // Conteo agregado por PostgREST: días → bloques → count de ítems.
      const rows = check(await sb().from("routine_days").select("routine_id, routine_blocks(routine_items(count))")) as Row[];
      const out: Record<string, number> = {};
      for (const d of rows) {
        const rid = d.routine_id as string;
        for (const b of (d.routine_blocks as Row[]) ?? []) {
          const n = ((b.routine_items as { count: number }[]) ?? [])[0]?.count ?? 0;
          out[rid] = (out[rid] ?? 0) + n;
        }
      }
      return out;
    },
    async remove(id) {
      check(await sb().from("routines").delete().eq("id", id));
    },
  },

  sessions: {
    async list(filter = {}) {
      let q = sb().from("workout_sessions").select("*");
      if (filter.clientId) q = q.eq("client_id", filter.clientId);
      if (filter.routineId) q = q.eq("routine_id", filter.routineId);
      if (filter.since) q = q.gte("started_at", filter.since);
      return (check(await q) as Row[]).map(toSession);
    },
    async start({ clientId, routineId, dayId }) {
      const row = check(
        await sb()
          .from("workout_sessions")
          .insert({ client_id: clientId, routine_id: routineId, day_id: dayId })
          .select()
          .single(),
      );
      return toSession(row as Row);
    },
    async complete(sessionId, completed) {
      const row = check(
        await sb()
          .from("workout_sessions")
          .update({ completed_at: completed ? new Date().toISOString() : null })
          .eq("id", sessionId)
          .select()
          .single(),
      );
      return toSession(row as Row);
    },
    async listChecks(sessionIds) {
      if (sessionIds.length === 0) return [];
      const rows = check(await sb().from("item_checks").select("*").in("session_id", sessionIds));
      return (rows as Row[]).map(
        (r): ItemCheck => ({
          sessionId: r.session_id as string,
          itemId: r.item_id as string,
          checkedAt: r.checked_at as string,
        }),
      );
    },
    async listSetLogs(sessionIds) {
      if (sessionIds.length === 0) return [];
      const rows = check(await sb().from("set_logs").select("*").in("session_id", sessionIds).order("set_number"));
      return (rows as Row[]).map(toSetLog);
    },
    async saveSetLogs(sessionId, itemId, logs) {
      const rows = check(
        await sb().rpc("save_set_logs", { p_session_id: sessionId, p_item_id: itemId, p_logs: cleanSetLogs(logs).map(fromSetLog) }),
      );
      return ((rows as Row[]) ?? []).map(toSetLog);
    },
    async setCheck(sessionId, itemId, checked) {
      if (checked) {
        check(await sb().from("item_checks").upsert({ session_id: sessionId, item_id: itemId }));
      } else {
        check(await sb().from("item_checks").delete().eq("session_id", sessionId).eq("item_id", itemId));
      }
    },
  },

  views: {
    async record(clientId, exerciseId) {
      check(await sb().from("exercise_views").insert({ client_id: clientId, exercise_id: exerciseId }));
    },
    async list(filter = {}) {
      let q = sb().from("exercise_views").select("*");
      if (filter.clientId) q = q.eq("client_id", filter.clientId);
      if (filter.since) q = q.gte("viewed_at", filter.since);
      return (check(await q) as Row[]).map(
        (r): ExerciseView => ({
          clientId: r.client_id as string,
          exerciseId: r.exercise_id as string,
          viewedAt: r.viewed_at as string,
        }),
      );
    },
  },

  accessRequests: {
    listCoaches: () => listPublicCoaches(),
    submit: (input) => submitAccessRequest(input),
    async list(status = "pending") {
      const rows = check(
        await sb().from("access_requests").select("*").eq("status", status).order("created_at", { ascending: false }),
      ) as Row[];
      return rows.map(toAccessRequest);
    },
    async approve(id, opts) {
      const res = await approveAccessRequest(id, opts);
      if (!res.ok) fail(res);
      return { profile: res.profile, activationLink: null, linked: res.linked };
    },
    async reject(id, reason) {
      const user = await sessionUser();
      const row = check(
        await sb()
          .from("access_requests")
          .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString(), reject_reason: reason?.trim() || null })
          .eq("id", id)
          .select()
          .single(),
      );
      return toAccessRequest(row as Row);
    },
  },

  team: {
    async list() {
      const rows = check(await sb().from("profiles").select("*").in("role", ["coach", "admin"]).order("full_name")) as Row[];
      const clients = check(await sb().from("profiles").select("coach_id").eq("role", "client")) as Row[];
      return rows.map((r) => {
        const p = toProfile(r);
        return { ...p, status: accountStatus(p), clientCount: clients.filter((c) => c.coach_id === p.id).length };
      });
    },
    async invite(input) {
      const res = await inviteStaff(input);
      if (!res.ok) fail(res);
      return { profile: res.profile, activationLink: null };
    },
    async resend(profileId) {
      const res = await resendInvite(profileId);
      if (!res.ok) throw new Error(res.error);
      return { activationLink: null };
    },
    async createCode(profileId) {
      const res = await createInviteCode(profileId);
      if (!res.ok) throw new Error(res.error);
      return { code: res.code, expiresAt: res.expiresAt };
    },
    async setRole(profileId, role) {
      const res = await setStaffRole(profileId, role);
      if (!res.ok) throw new Error(res.error);
      const row = check(await sb().from("profiles").select("*").eq("id", profileId).single());
      return toProfile(row as Row);
    },
    async deactivate(profileId, reassignTo) {
      const res = await deactivateStaff(profileId, reassignTo);
      if (!res.ok) throw new Error(res.error);
    },
    async reactivate(profileId) {
      const res = await reactivateStaff(profileId);
      if (!res.ok) throw new Error(res.error);
    },
  },

  videos: {
    // Subida reanudable (TUS) directo a Storage: tolera cortes de conexión en el gimnasio.
    async upload(file, { name, onProgress, signal }) {
      const { data } = await sb().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sesión vencida. Volvé a ingresar.");
      const safe = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const objectName = `${crypto.randomUUID()}-${safe}`;
      return new Promise<string>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
          retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
          headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: 6 * 1024 * 1024, // Supabase exige 6 MB
          metadata: {
            bucketName: VIDEO_BUCKET,
            objectName,
            contentType: file.type || "application/octet-stream",
            cacheControl: "3600",
          },
          onError: (err) => reject(err),
          onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
          onSuccess: () => resolve(objectName),
        });
        signal?.addEventListener("abort", () => {
          upload.abort(true).finally(() => reject(new DOMException("Subida cancelada", "AbortError")));
        });
        upload.findPreviousUploads().then((prev) => {
          if (prev[0]) upload.resumeFromPreviousUpload(prev[0]);
          upload.start();
        });
      });
    },
    async getUrl(path) {
      const { data, error } = await sb().storage.from(VIDEO_BUCKET).createSignedUrl(path, 60 * 10);
      return error ? null : data.signedUrl;
    },
    async remove(path) {
      check(await sb().storage.from(VIDEO_BUCKET).remove([path]));
    },
  },

  appointments: {
    async list(filter = {}) {
      let q = sb().from("appointments").select("*").order("starts_at");
      if (filter.clientId) q = q.eq("client_id", filter.clientId);
      if (filter.from) q = q.gte("starts_at", baStartOfDay(filter.from));
      if (filter.to) q = q.lt("starts_at", baStartOfDay(addDays(filter.to, 1)));
      return (check(await q) as Row[]).map(toAppointment);
    },
    async create(input, repeat) {
      const me = await sessionUser();
      if (!me) throw new Error("Iniciá sesión de nuevo.");
      // El profe agenda a su nombre (lo refuerza un trigger); el admin elige el profe.
      const rows = buildAppointments({ ...input, coachId: me.role === "admin" ? input.coachId : me.id }, repeat ?? null, {
        newId,
        createdBy: me.id,
        now: new Date().toISOString(),
      });
      const saved = check(await sb().from("appointments").insert(rows.map(fromAppointment)).select()) as Row[];
      return saved.map(toAppointment);
    },
    async update(id, patch, scope = "this") {
      const changed = applyPatch(await withSeries(id), id, patch, scope);
      const saved = await Promise.all(
        changed.map(async (a) => {
          // id y paciente no cambian; el resto se reescribe (el trigger protege el profe).
          const row = fromAppointment(a);
          delete row.id;
          delete row.client_id;
          return toAppointment(check(await sb().from("appointments").update(row).eq("id", a.id).select().single()) as Row);
        }),
      );
      return saved;
    },
    async remove(id, scope = "this") {
      const all = await withSeries(id);
      const target = all.find((a) => a.id === id)!;
      const ids = scope === "following" && target.seriesId ? all.filter((a) => a.startsAt >= target.startsAt).map((a) => a.id) : [id];
      check(await sb().from("appointments").delete().in("id", ids));
    },
    async requestReschedule(id, input) {
      const row = check(await sb().rpc("request_reschedule", { p_id: id, p_reason: input.reason, p_preference: input.preference }).single());
      return toAppointment(row as Row);
    },
  },

  billing: {
    async listPlans() {
      return (check(await sb().from("client_plans").select("*")) as Row[]).map(toPlan);
    },
    async setPlan(clientId, input) {
      const error = validatePlan(input);
      if (error) throw new Error(error);
      const row = check(
        await sb()
          .from("client_plans")
          .upsert({
            client_id: clientId,
            kind: input.kind,
            amount_cents: input.amountCents,
            due_day: input.kind === "mensual" ? input.dueDay : null,
            pack_sessions: input.kind === "pack" ? input.packSessions : null,
            starts_on: input.startsOn,
            active: input.active,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single(),
      );
      return toPlan(row as Row);
    },
    async listPayments(filter = {}) {
      let q = sb().from("payments").select("*").order("paid_at", { ascending: false }).order("created_at", { ascending: false });
      if (filter.clientId) q = q.eq("client_id", filter.clientId);
      return (check(await q) as Row[]).map(toPayment);
    },
    async addPayment(input) {
      const error = validatePayment(input);
      if (error) throw new Error(error);
      const row = check(
        await sb()
          .from("payments")
          .insert({
            client_id: input.clientId,
            amount_cents: input.amountCents,
            paid_at: input.paidAt,
            method: input.method,
            period: input.period,
            sessions: input.sessions,
            note: input.note?.trim() || null,
          })
          .select()
          .single(),
      );
      return toPayment(row as Row);
    },
    async removePayment(id) {
      check(await sb().from("payments").delete().eq("id", id));
    },
  },

  settings: {
    async get() {
      return toSettings(check(await sb().from("app_settings").select("*").eq("id", true).maybeSingle()) as Row | null);
    },
    async update(patch) {
      const row: Row = { id: true, updated_at: new Date().toISOString() };
      if (patch.transferAlias !== undefined) row.transfer_alias = patch.transferAlias.trim();
      if (patch.paymentTemplate !== undefined) row.payment_template = patch.paymentTemplate;
      if (patch.appointmentTemplate !== undefined) row.appointment_template = patch.appointmentTemplate;
      if (patch.showBillingToClient !== undefined) row.show_billing_to_client = patch.showBillingToClient;
      return toSettings(check(await sb().from("app_settings").upsert(row).select().single()) as Row);
    },
  },

  notifications: {
    async getPrefs() {
      const me = await sessionUser();
      if (!me) throw new Error("Iniciá sesión de nuevo.");
      const row = check(await sb().from("notification_prefs").select("*").eq("user_id", me.id).maybeSingle()) as Row | null;
      return row ? toPrefs(row) : defaultPrefs(me.role);
    },
    async savePrefs(input) {
      const me = await sessionUser();
      if (!me) throw new Error("Iniciá sesión de nuevo.");
      const error = validatePrefs(input);
      if (error) throw new Error(error);
      return toPrefs(check(await sb().from("notification_prefs").upsert(fromPrefs(me.id, input)).select().single()) as Row);
    },
    async listSeen() {
      const me = await sessionUser();
      if (!me) return [];
      const rows = check(await sb().from("notification_state").select("key").eq("user_id", me.id).not("seen_at", "is", null)) as Row[];
      return rows.map((r) => r.key as string);
    },
    async markSeen(keys) {
      const me = await sessionUser();
      if (!me || keys.length === 0) return;
      const seenAt = new Date().toISOString();
      check(await sb().from("notification_state").upsert([...new Set(keys)].map((key) => ({ user_id: me.id, key, seen_at: seenAt }))));
    },
  },
};
