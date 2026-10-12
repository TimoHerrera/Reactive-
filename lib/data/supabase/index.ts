// Implementación Supabase de la capa de datos. Corre en el navegador con la anon key:
// la seguridad la garantiza RLS (supabase/migrations/0002_rls.sql).
import * as tus from "tus-js-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { SUPABASE_URL, VIDEO_BUCKET } from "@/lib/supabase/env";
import { inviteClient, inviteCoach } from "@/app/actions/clients";
import type { DataSource } from "../repositories";
import type {
  CoachNote,
  Exercise,
  ExerciseView,
  ItemCheck,
  Profile,
  Routine,
  RoutineTree,
  SessionUser,
  WorkoutSession,
} from "../types";

type Row = Record<string, unknown>;

const sb = (): SupabaseClient => getBrowserSupabase();

function check({ data, error }: { data: unknown; error: { message: string } | null }): unknown {
  if (error) throw new Error(error.message);
  return data;
}

// ── Mapeos fila ↔ dominio ─────────────────────────────────────────

const toProfile = (r: Row): Profile => ({
  id: r.id as string,
  role: r.role as Profile["role"],
  fullName: r.full_name as string,
  email: (r.email as string) ?? "",
  phone: (r.phone as string) ?? null,
  title: (r.title as string) ?? null,
  sport: (r.sport as string) ?? null,
  caseType: (r.case_type as Profile["caseType"]) ?? null,
  caseDetail: (r.case_detail as string) ?? null,
  goal: (r.goal as string) ?? null,
  coachId: (r.coach_id as string) ?? null,
  clientSince: (r.client_since as string) ?? null,
  createdAt: r.created_at as string,
});

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
  publishedAt: (r.published_at as string) ?? null,
  createdAt: r.created_at as string,
});

const toSession = (r: Row): WorkoutSession => ({
  id: r.id as string,
  clientId: r.client_id as string,
  routineId: r.routine_id as string,
  dayId: r.day_id as string,
  startedAt: r.started_at as string,
  completedAt: (r.completed_at as string) ?? null,
});

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
  if (!row) return null;
  const p = toProfile(row as Row);
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
      if (!res.ok) throw new Error(res.error);
      return res.profile;
    },
    async createStaff(input) {
      const res = await inviteCoach(input);
      if (!res.ok) throw new Error(res.error);
      return res.profile;
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
};
