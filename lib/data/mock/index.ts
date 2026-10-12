import { normalizeText } from "@/lib/text";
import { encodeMockSession, MOCK_SESSION_COOKIE } from "@/lib/auth/cookies";
import type { DataSource } from "../repositories";
import { DEMO_PASSWORD } from "../seed";
import { isStaff, type Profile, type RoutineTree, type SessionUser } from "../types";
import { delay, getDb, mutate, uuid } from "./store";
import { mockVideos } from "./videos";

const SESSION_KEY = "reactive-mock-session";
const now = () => new Date().toISOString();

function currentUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(SESSION_KEY);
  const p = id ? getDb().profiles.find((x) => x.id === id) : null;
  return p ? { id: p.id, role: p.role, fullName: p.fullName, email: p.email } : null;
}

function setSessionCookie(value: string | null) {
  const base = `${MOCK_SESSION_COOKIE}=`;
  document.cookie = value
    ? `${base}${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
    : `${base}; path=/; max-age=0`;
}

/** Imita RLS: los clientes solo ven lo suyo. */
function viewerIsClient(): SessionUser | null {
  const u = currentUser();
  return u && !isStaff(u.role) ? u : null;
}

function notFound(what: string): never {
  throw new Error(`${what} no encontrado`);
}

export const mockDataSource: DataSource = {
  kind: "mock",

  auth: {
    async getUser() {
      return delay(currentUser(), 0);
    },
    async signIn(email, password) {
      const p = getDb().profiles.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      await delay(null, 350);
      if (!p || password !== DEMO_PASSWORD) return { ok: false, error: "Email o contraseña incorrectos." };
      window.localStorage.setItem(SESSION_KEY, p.id);
      setSessionCookie(encodeMockSession(p.role, p.id));
      return { ok: true, user: { id: p.id, role: p.role, fullName: p.fullName, email: p.email } };
    },
    async signOut() {
      window.localStorage.removeItem(SESSION_KEY);
      setSessionCookie(null);
    },
    async requestPasswordReset() {
      await delay(null, 400);
    },
    async updatePassword() {
      await delay(null, 400);
    },
  },

  profiles: {
    async get(id) {
      return delay(getDb().profiles.find((p) => p.id === id) ?? null);
    },
    async listClients() {
      const me = viewerIsClient();
      return delay(getDb().profiles.filter((p) => p.role === "client" && (!me || p.id === me.id)));
    },
    async listStaff() {
      return delay(getDb().profiles.filter((p) => isStaff(p.role)));
    },
    async update(id, patch) {
      return delay(
        mutate((db) => {
          const p = db.profiles.find((x) => x.id === id) ?? notFound("Perfil");
          Object.assign(p, patch);
          return p;
        }),
      );
    },
    async createStaff(input) {
      if (currentUser()?.role !== "admin") throw new Error("Solo un admin puede sumar profes.");
      return delay(
        mutate((db) => {
          if (db.profiles.some((p) => p.email.toLowerCase() === input.email.toLowerCase())) {
            throw new Error("Ya existe un usuario con ese email.");
          }
          const p: Profile = {
            id: uuid(),
            role: input.role ?? "coach",
            fullName: input.fullName,
            email: input.email,
            phone: null,
            title: input.title ?? null,
            sport: null,
            caseType: null,
            caseDetail: null,
            goal: null,
            coachId: null,
            clientSince: null,
            createdAt: now(),
          };
          db.profiles.push(p);
          return p;
        }),
      );
    },
    async createClient(input) {
      return delay(
        mutate((db) => {
          if (db.profiles.some((p) => p.email.toLowerCase() === input.email.toLowerCase())) {
            throw new Error("Ya existe un usuario con ese email.");
          }
          const p: Profile = {
            id: uuid(),
            role: "client",
            fullName: input.fullName,
            email: input.email,
            phone: input.phone ?? null,
            title: null,
            sport: input.sport ?? null,
            caseType: input.caseType ?? null,
            caseDetail: input.caseDetail ?? null,
            goal: input.goal ?? null,
            coachId: input.coachId ?? currentUser()?.id ?? null,
            clientSince: now().slice(0, 10),
            createdAt: now(),
          };
          db.profiles.push(p);
          return p;
        }),
      );
    },
  },

  coachNotes: {
    async listForClient(clientId) {
      if (viewerIsClient()) return delay([]); // El cliente NUNCA ve las observaciones.
      return delay(
        getDb()
          .coachNotes.filter((n) => n.clientId === clientId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    async add(clientId, body) {
      const author = currentUser();
      if (!author || !isStaff(author.role)) throw new Error("Solo profes");
      return delay(
        mutate((db) => {
          const n = { id: uuid(), clientId, authorId: author.id, body, createdAt: now() };
          db.coachNotes.push(n);
          return n;
        }),
      );
    },
  },

  exercises: {
    async list() {
      return delay([...getDb().exercises].sort((a, b) => a.name.localeCompare(b.name, "es")));
    },
    async get(id) {
      return delay(getDb().exercises.find((e) => e.id === id) ?? null);
    },
    async create(input) {
      return delay(
        mutate((db) => {
          const key = normalizeText(input.name);
          if (db.exercises.some((e) => normalizeText(e.name) === key)) {
            throw new Error("Ya existe un ejercicio con ese nombre.");
          }
          const e = { ...input, id: uuid(), createdBy: currentUser()?.id ?? null, createdAt: now(), updatedAt: now() };
          db.exercises.push(e);
          return e;
        }),
      );
    },
    async update(id, patch) {
      return delay(
        mutate((db) => {
          const e = db.exercises.find((x) => x.id === id) ?? notFound("Ejercicio");
          Object.assign(e, patch, { updatedAt: now() });
          return e;
        }),
      );
    },
    async remove(id) {
      mutate((db) => {
        db.exercises = db.exercises.filter((e) => e.id !== id);
        db.routineItems.forEach((i) => {
          if (i.exerciseId === id) i.exerciseId = null;
        });
      });
      return delay(undefined);
    },
    async addAlias(id, alias) {
      return delay(
        mutate((db) => {
          const e = db.exercises.find((x) => x.id === id) ?? notFound("Ejercicio");
          const key = normalizeText(alias);
          if (key && normalizeText(e.name) !== key && !e.aliases.some((a) => normalizeText(a) === key)) {
            e.aliases.push(alias.trim());
            e.updatedAt = now();
          }
          return e;
        }),
      );
    },
  },

  routines: {
    async list() {
      const me = viewerIsClient();
      const all = getDb().routines;
      return delay(me ? all.filter((r) => r.clientId === me.id && r.publishedAt) : all);
    },
    async listForClient(clientId) {
      const me = viewerIsClient();
      if (me && me.id !== clientId) return delay([]);
      return delay(
        getDb()
          .routines.filter((r) => r.clientId === clientId && (!me || r.publishedAt))
          .sort((a, b) => (b.startsOn ?? "").localeCompare(a.startsOn ?? "")),
      );
    },
    async getTree(id) {
      const db = getDb();
      const r = db.routines.find((x) => x.id === id);
      const me = viewerIsClient();
      if (!r || (me && (r.clientId !== me.id || !r.publishedAt))) return delay(null);
      const tree: RoutineTree = {
        ...r,
        days: db.routineDays
          .filter((d) => d.routineId === id)
          .sort((a, b) => a.position - b.position)
          .map((d) => ({
            ...d,
            blocks: db.routineBlocks
              .filter((b) => b.dayId === d.id)
              .sort((a, b) => a.position - b.position)
              .map((b) => ({
                ...b,
                items: db.routineItems.filter((i) => i.blockId === b.id).sort((a, c) => a.position - c.position),
              })),
          })),
      };
      return delay(tree);
    },
    async saveTree(tree) {
      return delay(
        mutate((db) => {
          const { days, ...routine } = tree;
          const id = routine.id || uuid();
          const existing = db.routines.find((r) => r.id === id);
          // Reemplaza días/bloques/ítems (las sesiones viejas apuntan a días que ya no existen: es esperable).
          const oldDays = db.routineDays.filter((d) => d.routineId === id).map((d) => d.id);
          const oldBlocks = db.routineBlocks.filter((b) => oldDays.includes(b.dayId)).map((b) => b.id);
          db.routineItems = db.routineItems.filter((i) => !oldBlocks.includes(i.blockId));
          db.routineBlocks = db.routineBlocks.filter((b) => !oldDays.includes(b.dayId));
          db.routineDays = db.routineDays.filter((d) => d.routineId !== id);

          const saved = {
            ...routine,
            id,
            daysPerWeek: days.length || routine.daysPerWeek,
            createdBy: routine.createdBy ?? currentUser()?.id ?? null,
            createdAt: existing?.createdAt ?? now(),
          };
          if (existing) Object.assign(existing, saved);
          else db.routines.push(saved);

          const outDays = days.map((d, di) => {
            const dayId = d.id || uuid();
            db.routineDays.push({ id: dayId, routineId: id, label: d.label, title: d.title, position: di });
            return {
              id: dayId,
              routineId: id,
              label: d.label,
              title: d.title,
              position: di,
              blocks: d.blocks.map((b, bi) => {
                const blockId = b.id || uuid();
                db.routineBlocks.push({ id: blockId, dayId, name: b.name, position: bi });
                return {
                  id: blockId,
                  dayId,
                  name: b.name,
                  position: bi,
                  items: b.items.map((it, ii) => {
                    const item = { ...it, id: it.id || uuid(), blockId, position: ii };
                    db.routineItems.push(item);
                    return item;
                  }),
                };
              }),
            };
          });
          return { ...saved, days: outDays };
        }),
      );
    },
    async publish(id) {
      return delay(
        mutate((db) => {
          const r = db.routines.find((x) => x.id === id) ?? notFound("Rutina");
          r.publishedAt = now();
          return r;
        }),
      );
    },
    async update(id, patch) {
      return delay(
        mutate((db) => {
          const r = db.routines.find((x) => x.id === id) ?? notFound("Rutina");
          Object.assign(r, patch);
          return r;
        }),
      );
    },
    async itemCounts() {
      const db = getDb();
      const dayToRoutine = new Map(db.routineDays.map((d) => [d.id, d.routineId]));
      const blockToRoutine = new Map(db.routineBlocks.map((b) => [b.id, dayToRoutine.get(b.dayId)]));
      const out: Record<string, number> = {};
      for (const it of db.routineItems) {
        const rid = blockToRoutine.get(it.blockId);
        if (rid) out[rid] = (out[rid] ?? 0) + 1;
      }
      return delay(out, 40);
    },
    async remove(id) {
      mutate((db) => {
        const days = db.routineDays.filter((d) => d.routineId === id).map((d) => d.id);
        const blocks = db.routineBlocks.filter((b) => days.includes(b.dayId)).map((b) => b.id);
        db.routineItems = db.routineItems.filter((i) => !blocks.includes(i.blockId));
        db.routineBlocks = db.routineBlocks.filter((b) => !days.includes(b.dayId));
        db.routineDays = db.routineDays.filter((d) => d.routineId !== id);
        db.routines = db.routines.filter((r) => r.id !== id);
      });
      return delay(undefined);
    },
  },

  sessions: {
    async list(filter = {}) {
      const me = viewerIsClient();
      return delay(
        getDb().workoutSessions.filter(
          (s) =>
            (!me || s.clientId === me.id) &&
            (!filter.clientId || s.clientId === filter.clientId) &&
            (!filter.routineId || s.routineId === filter.routineId) &&
            (!filter.since || s.startedAt >= filter.since),
        ),
      );
    },
    async start({ clientId, routineId, dayId }) {
      return delay(
        mutate((db) => {
          const s = { id: uuid(), clientId, routineId, dayId, startedAt: now(), completedAt: null };
          db.workoutSessions.push(s);
          return s;
        }),
        40,
      );
    },
    async complete(sessionId, completed) {
      return delay(
        mutate((db) => {
          const s = db.workoutSessions.find((x) => x.id === sessionId) ?? notFound("Sesión");
          s.completedAt = completed ? (s.completedAt ?? now()) : null;
          return s;
        }),
        40,
      );
    },
    async listChecks(sessionIds) {
      return delay(getDb().itemChecks.filter((c) => sessionIds.includes(c.sessionId)), 40);
    },
    async setCheck(sessionId, itemId, checked) {
      mutate((db) => {
        db.itemChecks = db.itemChecks.filter((c) => !(c.sessionId === sessionId && c.itemId === itemId));
        if (checked) db.itemChecks.push({ sessionId, itemId, checkedAt: now() });
      });
      return delay(undefined, 40);
    },
  },

  views: {
    async record(clientId, exerciseId) {
      mutate((db) => {
        db.exerciseViews.push({ clientId, exerciseId, viewedAt: now() });
      });
      return delay(undefined, 0);
    },
    async list(filter = {}) {
      return delay(
        getDb().exerciseViews.filter(
          (v) => (!filter.clientId || v.clientId === filter.clientId) && (!filter.since || v.viewedAt >= filter.since),
        ),
      );
    },
  },

  videos: mockVideos,
};
