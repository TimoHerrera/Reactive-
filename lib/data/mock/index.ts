import { normalizeText } from "@/lib/text";
import { encodeMockSession, MOCK_SESSION_COOKIE } from "@/lib/auth/cookies";
import { emitSessionChange, emitSessionRevoked } from "@/lib/auth/session-events";
import type { DataSource } from "../repositories";
import { DEMO_PASSWORD } from "../seed";
import { accountStatus, isStaff, type AccessRequest, type Profile, type Routine, type RoutineTree, type SessionUser } from "../types";
import {
  canDeleteUser,
  canEditRoutine,
  canReassignClient,
  canSeeAccessRequest,
  canSeeClient,
  canSeeProfile,
  canSeeRoutine,
  coachForNewClient,
  type Viewer,
} from "@/lib/access/scope";
import {
  canChangeRole,
  canDeactivate,
  canEditProfile,
  canManageTeam,
  checkInviteCode,
  CODE_MESSAGES,
  codeExpiry,
  generateInviteCode,
  hashCode,
} from "@/lib/team/rules";
import {
  cleanAccessRequest,
  duplicateReason,
  isRateLimited,
  MESSAGES,
  normalizeEmail,
  validateAccessRequest,
} from "@/lib/access/rules";
import { DuplicateEmailError, existingUserFor, sameName } from "../errors";
import { cleanSetLogs } from "@/lib/routine/setlogs";
import { delay, getDb, mutate, resetMockDb, uuid } from "./store";
import { mockVideos } from "./videos";

const SESSION_KEY = "reactive-mock-session";
const PASSWORDS_KEY = "reactive-mock-passwords";

/** Contraseñas creadas en /activar o /nueva-contrasena (solo modo demo, en este navegador). */
function storedPasswords(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(PASSWORDS_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
const now = () => new Date().toISOString();

/**
 * Usuario de la sesión. Desactivado o eliminado: la sesión se corta en su próxima acción
 * (se borra y se avisa para que la app lo mande al login).
 */
function currentUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const p = getDb().profiles.find((x) => x.id === id);
  if (!p || p.disabledAt) {
    window.localStorage.removeItem(SESSION_KEY);
    setSessionCookie(null);
    setTimeout(emitSessionRevoked, 0);
    return null;
  }
  return { id: p.id, role: p.role, fullName: p.fullName, email: p.email };
}

function requireStaff(): SessionUser {
  const me = currentUser();
  if (!me || !isStaff(me.role)) throw new Error("Solo profes.");
  return me;
}

function requireAdmin(): SessionUser {
  const me = currentUser();
  if (!canManageTeam(me)) throw new Error("Solo un admin puede gestionar el equipo.");
  return me!;
}

function activationLinkFor(db: ReturnType<typeof getDb>, userId: string): string {
  const token = uuid();
  db.activations.push({ token, userId, createdAt: now(), usedAt: null });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/activar?token=${token}`;
}

function startSession(p: Pick<Profile, "id" | "role">) {
  window.localStorage.setItem(SESSION_KEY, p.id);
  setSessionCookie(encodeMockSession(p.role, p.id));
  emitSessionChange();
}

function setSessionCookie(value: string | null) {
  const base = `${MOCK_SESSION_COOKIE}=`;
  document.cookie = value
    ? `${base}${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
    : `${base}; path=/; max-age=0`;
}

// ── Visibilidad (imita RLS de 0007_coach_scope.sql con las reglas de lib/access/scope.ts) ──
type MockDb = ReturnType<typeof getDb>;
const profileById = (db: MockDb, id: string | null | undefined) => (id ? db.profiles.find((p) => p.id === id) : undefined);
const ownerOf = (db: MockDb, r: Routine) => profileById(db, r.clientId);
const seesClient = (db: MockDb, v: Viewer, clientId: string) => canSeeClient(v, profileById(db, clientId));
const seesRoutine = (db: MockDb, v: Viewer, r: Routine) => canSeeRoutine(v, r, ownerOf(db, r));
function requireRoutineEdit(db: MockDb, v: Viewer, r: Routine) {
  if (!canEditRoutine(v, r, ownerOf(db, r))) throw new Error("No tenés acceso a esta rutina.");
}
/** Profe o admin activo (para asignar clientes). */
const activeStaff = (db: MockDb, id: string | null | undefined) => {
  const p = profileById(db, id);
  return p && isStaff(p.role) && !p.disabledAt ? p : null;
};

// ── Un email = una persona (normalizado: trim + minúsculas) ─────────
const byEmail = (db: MockDb, email: string) => db.profiles.find((p) => normalizeEmail(p.email) === normalizeEmail(email));
function assertEmailFree(db: MockDb, me: Viewer, email: string, exceptId?: string) {
  const p = byEmail(db, email);
  if (p && p.id !== exceptId) throw new DuplicateEmailError(existingUserFor(me, p));
}

/**
 * Eliminar definitivamente (lo mismo que hacen las FKs + app/actions/accounts.ts en Supabase).
 * - Cliente: perfil, rutinas (con su árbol), sesiones, checks, vistas, observaciones y solicitudes.
 * - Profe: exige reasignar sus clientes; ejercicios y plantillas pasan al admin; el resto de sus
 *   referencias queda en null (como «on delete set null»).
 */
function purgeUser(db: MockDb, p: Profile, adminId: string, reassignTo: string | null) {
  if (p.role === "client") {
    const routineIds = new Set(db.routines.filter((r) => r.clientId === p.id).map((r) => r.id));
    const dayIds = new Set(db.routineDays.filter((d) => routineIds.has(d.routineId)).map((d) => d.id));
    const blockIds = new Set(db.routineBlocks.filter((b) => dayIds.has(b.dayId)).map((b) => b.id));
    const sessionIds = new Set(db.workoutSessions.filter((s) => s.clientId === p.id).map((s) => s.id));
    db.routineItems = db.routineItems.filter((i) => !blockIds.has(i.blockId));
    db.routineBlocks = db.routineBlocks.filter((b) => !dayIds.has(b.dayId));
    db.routineDays = db.routineDays.filter((d) => !routineIds.has(d.routineId));
    db.routines = db.routines.filter((r) => !routineIds.has(r.id));
    db.itemChecks = db.itemChecks.filter((c) => !sessionIds.has(c.sessionId));
    db.setLogs = db.setLogs.filter((l) => !sessionIds.has(l.sessionId));
    db.workoutSessions = db.workoutSessions.filter((s) => !sessionIds.has(s.id));
    db.exerciseViews = db.exerciseViews.filter((v) => v.clientId !== p.id);
    db.coachNotes = db.coachNotes.filter((n) => n.clientId !== p.id);
    db.accessRequests = db.accessRequests.filter((r) => normalizeEmail(r.email) !== normalizeEmail(p.email) && r.linkedProfileId !== p.id);
  } else {
    const clients = db.profiles.filter((c) => c.role === "client" && c.coachId === p.id);
    if (clients.length) {
      const target = activeStaff(db, reassignTo);
      if (!target || target.id === p.id) throw new Error(`Primero reasigná sus ${clients.length} clientes a otro profe.`);
      for (const c of clients) c.coachId = target.id;
    }
    for (const e of db.exercises) if (e.createdBy === p.id) e.createdBy = adminId;
    for (const r of db.routines) {
      if (r.createdBy === p.id) r.createdBy = r.isTemplate || !r.clientId ? adminId : null;
      if (r.updatedBy === p.id) r.updatedBy = null;
    }
    for (const n of db.coachNotes) if (n.authorId === p.id) n.authorId = null;
    for (const r of db.accessRequests) {
      if (r.requestedCoachId === p.id) r.requestedCoachId = r.status === "pending" ? (reassignTo ?? null) : null;
      if (r.reviewedBy === p.id) r.reviewedBy = null;
    }
  }
  db.activations = db.activations.filter((a) => a.userId !== p.id);
  db.inviteCodes = db.inviteCodes.filter((c) => c.profileId !== p.id);
  db.profiles = db.profiles.filter((x) => x.id !== p.id);
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
      const p = byEmail(getDb(), email);
      await delay(null, 350);
      // La contraseña demo vale solo para cuentas ya activas; un invitado primero la crea en /activar.
      const okPassword = !!p && (storedPasswords()[p.id] === password || (password === DEMO_PASSWORD && !!p.activatedAt));
      if (!p || !okPassword) {
        return { ok: false, error: "Email o contraseña incorrectos." };
      }
      if (p.disabledAt) return { ok: false, error: "Tu acceso está desactivado. Hablá con Reactive." };
      startSession(p);
      return { ok: true, user: { id: p.id, role: p.role, fullName: p.fullName, email: p.email } };
    },
    async signOut() {
      window.localStorage.removeItem(SESSION_KEY);
      setSessionCookie(null);
      emitSessionChange();
    },
    async requestPasswordReset() {
      await delay(null, 400);
    },
    async updatePassword(password) {
      const me = currentUser();
      if (me) {
        window.localStorage.setItem(PASSWORDS_KEY, JSON.stringify({ ...storedPasswords(), [me.id]: password }));
        mutate((db) => {
          const p = db.profiles.find((x) => x.id === me.id);
          if (p && !p.activatedAt) p.activatedAt = now();
        });
      }
      await delay(null, 400);
    },
    async redeemCode(email, code, password) {
      await delay(null, 300);
      if (password.length < 8) return { ok: false, error: "Usá al menos 8 caracteres." };
      const hash = await hashCode(code);
      const result = mutate((db) => {
        const p = db.profiles.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        const rec = db.inviteCodes.find((c) => c.codeHash === hash && (!p || c.profileId === p.id)) ?? null;
        const check = checkInviteCode(rec, email);
        if (check !== "ok") return { ok: false as const, error: CODE_MESSAGES[check] };
        if (!p || p.disabledAt) return { ok: false as const, error: CODE_MESSAGES["not-found"] };
        rec!.usedAt = now();
        p.activatedAt ??= now();
        return { ok: true as const, profile: p };
      });
      if (!result.ok) return result;
      const p = result.profile;
      window.localStorage.setItem(PASSWORDS_KEY, JSON.stringify({ ...storedPasswords(), [p.id]: password }));
      startSession(p);
      return { ok: true, user: { id: p.id, role: p.role, fullName: p.fullName, email: p.email } };
    },
    async activate(token) {
      if (!token) return delay(currentUser(), 0);
      const user = mutate((db) => {
        const act = db.activations.find((a) => a.token === token);
        const p = act ? db.profiles.find((x) => x.id === act.userId) : null;
        if (!act || !p) return null;
        // Un solo uso (con 10 min de gracia por si se recarga la página).
        if (act.usedAt && Date.now() - new Date(act.usedAt).getTime() > 10 * 60_000) return null;
        act.usedAt ??= now();
        return p;
      });
      if (!user || user.disabledAt) return delay(null, 200);
      startSession(user);
      return delay({ id: user.id, role: user.role, fullName: user.fullName, email: user.email }, 200);
    },
  },

  profiles: {
    async get(id) {
      const p = getDb().profiles.find((x) => x.id === id) ?? null;
      // Staff: públicos para los logueados. Clientes: el propio, o los del profe (admin: todos).
      return delay(canSeeProfile(currentUser(), p) ? p : null);
    },
    async listClients() {
      const me = currentUser();
      return delay(getDb().profiles.filter((p) => canSeeClient(me, p)));
    },
    async listStaff() {
      if (!currentUser()) return delay([]);
      return delay(getDb().profiles.filter((p) => isStaff(p.role)));
    },
    async update(id, patch) {
      const me = currentUser();
      return delay(
        mutate((db) => {
          const p = db.profiles.find((x) => x.id === id) ?? notFound("Perfil");
          if (!canEditProfile(me, p) || (p.role === "client" && !canSeeClient(me, p))) {
            throw new Error("No tenés permiso para editar este perfil.");
          }
          // Rol y estado nunca se cambian por acá (aunque vengan en el objeto).
          const safe: Partial<Profile> = { ...patch };
          delete safe.role;
          delete safe.activatedAt;
          delete safe.disabledAt;
          delete safe.id;
          if (safe.coachId !== undefined && safe.coachId !== p.coachId) {
            if (p.role !== "client" || !canReassignClient(me)) throw new Error("Solo el admin reasigna clientes a otro profe.");
            if (!activeStaff(db, safe.coachId)) throw new Error("Elegí un profe activo.");
          }
          if (safe.email !== undefined) {
            safe.email = normalizeEmail(safe.email);
            assertEmailFree(db, me, safe.email, p.id);
          }
          Object.assign(p, safe);
          return p;
        }),
      );
    },
    async createClient(input) {
      const me = requireStaff();
      return delay(
        mutate((db) => {
          const email = normalizeEmail(input.email);
          assertEmailFree(db, me, email);
          const coachId = coachForNewClient(me, input.coachId);
          if (!activeStaff(db, coachId)) throw new Error("Elegí un profe activo.");
          const p: Profile = {
            id: uuid(),
            role: "client",
            fullName: input.fullName,
            email,
            phone: input.phone ?? null,
            title: null,
            sport: input.sport ?? null,
            caseType: input.caseType ?? null,
            caseDetail: input.caseDetail ?? null,
            goal: input.goal ?? null,
            coachId,
            clientSince: now().slice(0, 10),
            createdAt: now(),
            bio: null,
            avatarPath: null,
            activatedAt: null,
            disabledAt: null,
          };
          db.profiles.push(p);
          return p;
        }),
      );
    },
    async setClientActive(id, active) {
      const me = requireStaff();
      return delay(
        mutate((db) => {
          const p = db.profiles.find((x) => x.id === id && x.role === "client");
          // Admin o su profe (el resto, como si no existiera).
          if (!p || !canSeeClient(me, p)) notFound("Cliente");
          p.disabledAt = active ? null : (p.disabledAt ?? now());
          return p;
        }),
      );
    },
    async remove(id, { confirmName, reassignTo = null }) {
      const me = requireStaff();
      mutate((db) => {
        const p = db.profiles.find((x) => x.id === id);
        // Un cliente de otro profe: como si no existiera (ni siquiera le aparece).
        if (!p || (p.role === "client" && !canSeeClient(me, p))) notFound("Usuario");
        if (p.id === me.id) throw new Error("No podés eliminarte a vos.");
        // Admin: cualquiera. Profe: solo sus propios clientes.
        if (!canDeleteUser(me, p)) throw new Error("Solo un admin puede eliminar profes.");
        if (!sameName(confirmName, p.fullName)) throw new Error(`Escribí «${p.fullName}» para confirmar.`);
        purgeUser(db, p, me.id, reassignTo);
      });
      const pwds = storedPasswords();
      delete pwds[id];
      window.localStorage.setItem(PASSWORDS_KEY, JSON.stringify(pwds));
      return delay(undefined);
    },
  },

  coachNotes: {
    async listForClient(clientId) {
      const me = currentUser();
      // El cliente NUNCA ve las observaciones; el profe, solo las de sus clientes.
      if (!me || !isStaff(me.role)) return delay([]);
      const db = getDb();
      if (!seesClient(db, me, clientId)) return delay([]);
      return delay(db.coachNotes.filter((n) => n.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    async add(clientId, body) {
      const author = requireStaff();
      return delay(
        mutate((db) => {
          if (!seesClient(db, author, clientId)) throw new Error("No tenés acceso a este cliente.");
          const n = { id: uuid(), clientId, authorId: author.id, body, createdAt: now() };
          db.coachNotes.push(n);
          return n;
        }),
      );
    },
  },

  // Biblioteca compartida entre todos los profes.
  exercises: {
    async list() {
      if (!currentUser()) return delay([]);
      return delay([...getDb().exercises].sort((a, b) => a.name.localeCompare(b.name, "es")));
    },
    async get(id) {
      if (!currentUser()) return delay(null);
      return delay(getDb().exercises.find((e) => e.id === id) ?? null);
    },
    async create(input) {
      const me = requireStaff();
      return delay(
        mutate((db) => {
          const key = normalizeText(input.name);
          if (db.exercises.some((e) => normalizeText(e.name) === key)) {
            throw new Error("Ya existe un ejercicio con ese nombre.");
          }
          const e = { ...input, id: uuid(), createdBy: me.id, createdAt: now(), updatedAt: now() };
          db.exercises.push(e);
          return e;
        }),
      );
    },
    async update(id, patch) {
      requireStaff();
      return delay(
        mutate((db) => {
          const e = db.exercises.find((x) => x.id === id) ?? notFound("Ejercicio");
          Object.assign(e, patch, { updatedAt: now() });
          return e;
        }),
      );
    },
    async remove(id) {
      requireStaff();
      mutate((db) => {
        db.exercises = db.exercises.filter((e) => e.id !== id);
        db.routineItems.forEach((i) => {
          if (i.exerciseId === id) i.exerciseId = null;
        });
      });
      return delay(undefined);
    },
    async addAlias(id, alias) {
      requireStaff();
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
      const me = currentUser();
      const db = getDb();
      return delay(db.routines.filter((r) => seesRoutine(db, me, r)));
    },
    async listForClient(clientId) {
      const me = currentUser();
      const db = getDb();
      return delay(
        db.routines
          .filter((r) => r.clientId === clientId && seesRoutine(db, me, r))
          .sort((a, b) => (b.startsOn ?? "").localeCompare(a.startsOn ?? "")),
      );
    },
    async getTree(id) {
      const db = getDb();
      const r = db.routines.find((x) => x.id === id);
      if (!r || !seesRoutine(db, currentUser(), r)) return delay(null);
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
      const me = requireStaff();
      return delay(
        mutate((db) => {
          const { days, ...routine } = tree;
          const id = routine.id || uuid();
          const existing = db.routines.find((r) => r.id === id);
          // Autor: SIEMPRE el usuario logueado al crearla (se ignora lo que venga del formulario).
          // Al editarla se conserva el autor y se registra quién la editó.
          const saved: Routine = {
            ...routine,
            id,
            daysPerWeek: days.length || routine.daysPerWeek,
            createdBy: existing ? existing.createdBy : me.id,
            updatedBy: existing ? me.id : null,
            updatedAt: existing ? now() : null,
            createdAt: existing?.createdAt ?? now(),
          };
          if (existing) requireRoutineEdit(db, me, existing);
          requireRoutineEdit(db, me, saved);

          // Reemplaza días/bloques/ítems (las sesiones viejas apuntan a días que ya no existen: es esperable).
          const oldDays = db.routineDays.filter((d) => d.routineId === id).map((d) => d.id);
          const oldBlocks = db.routineBlocks.filter((b) => oldDays.includes(b.dayId)).map((b) => b.id);
          db.routineItems = db.routineItems.filter((i) => !oldBlocks.includes(i.blockId));
          db.routineBlocks = db.routineBlocks.filter((b) => !oldDays.includes(b.dayId));
          db.routineDays = db.routineDays.filter((d) => d.routineId !== id);

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
      const me = requireStaff();
      return delay(
        mutate((db) => {
          const r = db.routines.find((x) => x.id === id) ?? notFound("Rutina");
          requireRoutineEdit(db, me, r);
          r.publishedAt = now();
          return r;
        }),
      );
    },
    async update(id, patch) {
      const me = requireStaff();
      return delay(
        mutate((db) => {
          const r = db.routines.find((x) => x.id === id) ?? notFound("Rutina");
          requireRoutineEdit(db, me, r);
          Object.assign(r, patch, { updatedBy: me.id, updatedAt: now() });
          return r;
        }),
      );
    },
    async itemCounts() {
      const db = getDb();
      const me = currentUser();
      const visible = new Set(db.routines.filter((r) => seesRoutine(db, me, r)).map((r) => r.id));
      const dayToRoutine = new Map(db.routineDays.map((d) => [d.id, d.routineId]));
      const blockToRoutine = new Map(db.routineBlocks.map((b) => [b.id, dayToRoutine.get(b.dayId)]));
      const out: Record<string, number> = {};
      for (const it of db.routineItems) {
        const rid = blockToRoutine.get(it.blockId);
        if (rid && visible.has(rid)) out[rid] = (out[rid] ?? 0) + 1;
      }
      return delay(out, 40);
    },
    async remove(id) {
      const me = requireStaff();
      mutate((db) => {
        const r = db.routines.find((x) => x.id === id) ?? notFound("Rutina");
        requireRoutineEdit(db, me, r);
        const days = db.routineDays.filter((d) => d.routineId === id).map((d) => d.id);
        const blocks = db.routineBlocks.filter((b) => days.includes(b.dayId)).map((b) => b.id);
        db.routineItems = db.routineItems.filter((i) => !blocks.includes(i.blockId));
        db.routineBlocks = db.routineBlocks.filter((b) => !days.includes(b.dayId));
        db.routineDays = db.routineDays.filter((d) => d.routineId !== id);
        db.routines = db.routines.filter((x) => x.id !== id);
      });
      return delay(undefined);
    },
  },

  sessions: {
    async list(filter = {}) {
      const me = currentUser();
      const db = getDb();
      return delay(
        db.workoutSessions.filter(
          (s) =>
            seesClient(db, me, s.clientId) &&
            (!filter.clientId || s.clientId === filter.clientId) &&
            (!filter.routineId || s.routineId === filter.routineId) &&
            (!filter.since || s.startedAt >= filter.since),
        ),
      );
    },
    // El registro lo escribe solo el cliente (el «Ver como» del profe es de solo lectura).
    async start({ clientId, routineId, dayId }) {
      if (currentUser()?.id !== clientId) throw new Error("Solo el cliente registra su entrenamiento.");
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
      const me = currentUser();
      return delay(
        mutate((db) => {
          const s = db.workoutSessions.find((x) => x.id === sessionId && x.clientId === me?.id) ?? notFound("Sesión");
          s.completedAt = completed ? (s.completedAt ?? now()) : null;
          return s;
        }),
        40,
      );
    },
    async listChecks(sessionIds) {
      const me = currentUser();
      const db = getDb();
      const visible = new Set(db.workoutSessions.filter((s) => sessionIds.includes(s.id) && seesClient(db, me, s.clientId)).map((s) => s.id));
      return delay(db.itemChecks.filter((c) => visible.has(c.sessionId)), 40);
    },
    async setCheck(sessionId, itemId, checked) {
      const me = currentUser();
      mutate((db) => {
        if (!db.workoutSessions.some((s) => s.id === sessionId && s.clientId === me?.id)) notFound("Sesión");
        db.itemChecks = db.itemChecks.filter((c) => !(c.sessionId === sessionId && c.itemId === itemId));
        if (checked) db.itemChecks.push({ sessionId, itemId, checkedAt: now() });
      });
      return delay(undefined, 40);
    },
    async listSetLogs(sessionIds) {
      const me = currentUser();
      const db = getDb();
      const visible = new Set(db.workoutSessions.filter((s) => sessionIds.includes(s.id) && seesClient(db, me, s.clientId)).map((s) => s.id));
      return delay(
        db.setLogs.filter((l) => visible.has(l.sessionId)).sort((a, b) => a.itemId.localeCompare(b.itemId) || a.setNumber - b.setNumber),
        40,
      );
    },
    async saveSetLogs(sessionId, itemId, logs) {
      const me = currentUser();
      return delay(
        mutate((db) => {
          if (!db.workoutSessions.some((s) => s.id === sessionId && s.clientId === me?.id)) throw new Error("Solo el cliente registra su entrenamiento.");
          const clean = cleanSetLogs(logs).map((l) => ({ ...l, sessionId, itemId, createdAt: now() }));
          db.setLogs = [...db.setLogs.filter((l) => !(l.sessionId === sessionId && l.itemId === itemId)), ...clean];
          return clean;
        }),
        40,
      );
    },
  },

  views: {
    async record(clientId, exerciseId) {
      // Solo cuenta lo que mira el propio cliente.
      if (currentUser()?.id !== clientId) return delay(undefined, 0);
      mutate((db) => {
        db.exerciseViews.push({ clientId, exerciseId, viewedAt: now() });
      });
      return delay(undefined, 0);
    },
    async list(filter = {}) {
      const me = currentUser();
      const db = getDb();
      return delay(
        db.exerciseViews.filter(
          (v) =>
            seesClient(db, me, v.clientId) &&
            (!filter.clientId || v.clientId === filter.clientId) &&
            (!filter.since || v.viewedAt >= filter.since),
        ),
      );
    },
  },

  videos: mockVideos,

  accessRequests: {
    async listCoaches() {
      return delay(
        getDb()
          .profiles.filter((p) => p.role === "coach" && accountStatus(p) === "activo")
          .map((p) => ({ id: p.id, fullName: p.fullName, title: p.title }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, "es")),
      );
    },
    async submit(input) {
      await delay(null, 400);
      if (input.website) return { ok: false, reason: "spam", message: MESSAGES.spam };
      const errors = validateAccessRequest(input);
      if (Object.keys(errors).length) return { ok: false, reason: "invalid", errors };
      const db = getDb();
      const dup = duplicateReason(input.email, db.accessRequests, db.profiles);
      if (dup) return { ok: false, reason: dup, message: MESSAGES[dup] };
      // En el navegador no hay IP: el límite del mock es por email.
      if (isRateLimited(db.accessRequests, input.email, null)) {
        return { ok: false, reason: "rate-limited", message: MESSAGES["rate-limited"] };
      }
      const req: AccessRequest = {
        id: uuid(),
        ...cleanAccessRequest(input),
        status: "pending",
        createdAt: now(),
        reviewedBy: null,
        reviewedAt: null,
        rejectReason: null,
        linkedProfileId: null,
      };
      mutate((d) => {
        d.accessRequests.push(req);
      });
      return { ok: true, id: req.id };
    },
    async list(status = "pending") {
      const me = currentUser();
      if (!me || !isStaff(me.role)) return delay([]);
      return delay(
        getDb()
          .accessRequests.filter((r) => r.status === status && canSeeAccessRequest(me, r))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    async approve(id, opts = {}) {
      const me = currentUser();
      if (!me || !isStaff(me.role)) throw new Error("Solo profes");
      const result = mutate((db) => {
        const r = db.accessRequests.find((x) => x.id === id && canSeeAccessRequest(me, x)) ?? notFound("Solicitud");
        // El profe se lo queda; el admin elige a quién (por defecto, el que eligió la persona).
        const coachId = me.role === "admin" ? (opts.coachId ?? r.requestedCoachId ?? me.id) : me.id;
        if (!activeStaff(db, coachId)) throw new Error("Elegí un profe activo.");
        if (r.status !== "pending") throw new Error("Esta solicitud ya fue revisada.");
        const existing = byEmail(db, r.email);
        if (existing) {
          // Una persona = un email: no se crea otra cuenta. Se ofrece vincular la solicitud a la existente.
          if (!opts.linkExisting) throw new DuplicateEmailError(existingUserFor(me, existing));
          if (existing.role === "client" && !existing.coachId) existing.coachId = coachId;
          r.status = "approved";
          r.reviewedBy = me.id;
          r.reviewedAt = now();
          r.linkedProfileId = existing.id;
          return { profile: canSeeProfile(me, existing) ? existing : null, token: null };
        }
        const profile: Profile = {
          id: uuid(),
          role: "client",
          fullName: r.fullName,
          email: r.email,
          phone: r.phone,
          title: null,
          sport: null,
          caseType: r.caseType,
          caseDetail: null,
          goal: r.message,
          coachId,
          clientSince: now().slice(0, 10),
          createdAt: now(),
          bio: null,
          avatarPath: null,
          activatedAt: null,
          disabledAt: null,
        };
        db.profiles.push(profile);
        r.status = "approved";
        r.reviewedBy = me.id;
        r.reviewedAt = now();
        const token = uuid();
        db.activations.push({ token, userId: profile.id, createdAt: now(), usedAt: null });
        return { profile, token };
      });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return delay({
        profile: result.profile,
        activationLink: result.token ? `${origin}/activar?token=${result.token}` : null,
        linked: !result.token,
      });
    },
    async reject(id, reason) {
      const me = currentUser();
      if (!me || !isStaff(me.role)) throw new Error("Solo profes");
      return delay(
        mutate((db) => {
          const r = db.accessRequests.find((x) => x.id === id && canSeeAccessRequest(me, x)) ?? notFound("Solicitud");
          r.status = "rejected";
          r.reviewedBy = me.id;
          r.reviewedAt = now();
          r.rejectReason = reason?.trim() || null;
          return r;
        }),
      );
    },
  },

  team: {
    async list() {
      requireAdmin();
      const db = getDb();
      return delay(
        db.profiles
          .filter((p) => isStaff(p.role))
          .map((p) => ({
            ...p,
            status: accountStatus(p),
            clientCount: db.profiles.filter((c) => c.role === "client" && c.coachId === p.id).length,
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, "es")),
      );
    },
    async invite(input) {
      const me = requireAdmin();
      const result = mutate((db) => {
        const email = normalizeEmail(input.email);
        assertEmailFree(db, me, email);
        const p: Profile = {
          id: uuid(),
          role: input.role,
          fullName: input.fullName.trim(),
          email,
          phone: input.phone?.trim() || null,
          title: input.title?.trim() || null,
          sport: null,
          caseType: null,
          caseDetail: null,
          goal: null,
          coachId: null,
          clientSince: null,
          createdAt: now(),
          bio: null,
          avatarPath: null,
          activatedAt: null,
          disabledAt: null,
        };
        db.profiles.push(p);
        return { profile: p, activationLink: activationLinkFor(db, p.id) };
      });
      return delay(result);
    },
    async resend(profileId) {
      requireAdmin();
      return delay(
        mutate((db) => {
          const p = db.profiles.find((x) => x.id === profileId) ?? notFound("Profe");
          if (p.activatedAt) throw new Error("Ya activó su cuenta.");
          return { activationLink: activationLinkFor(db, p.id) };
        }),
      );
    },
    async createCode(profileId) {
      const me = requireAdmin();
      const code = generateInviteCode();
      const codeHash = await hashCode(code);
      const expiresAt = codeExpiry();
      mutate((db) => {
        const p = db.profiles.find((x) => x.id === profileId) ?? notFound("Profe");
        if (p.activatedAt) throw new Error("Ya activó su cuenta.");
        // Un código vigente por persona: los anteriores dejan de servir.
        for (const c of db.inviteCodes) if (c.profileId === p.id && !c.usedAt) c.usedAt = now();
        db.inviteCodes.push({ id: uuid(), codeHash, email: p.email, profileId: p.id, expiresAt, usedAt: null, createdBy: me.id, createdAt: now() });
      });
      return delay({ code, expiresAt });
    },
    async setRole(profileId, role) {
      const me = requireAdmin();
      return delay(
        mutate((db) => {
          const p = db.profiles.find((x) => x.id === profileId) ?? notFound("Profe");
          if (!canChangeRole(me, p, role)) throw new Error("No podés cambiar este rol.");
          p.role = role;
          return p;
        }),
      );
    },
    async deactivate(profileId, reassignTo) {
      const me = requireAdmin();
      mutate((db) => {
        const p = db.profiles.find((x) => x.id === profileId) ?? notFound("Profe");
        if (!canDeactivate(me, p)) throw new Error("No podés desactivar a este usuario.");
        const clients = db.profiles.filter((c) => c.role === "client" && c.coachId === p.id);
        if (clients.length) {
          const target = reassignTo ? db.profiles.find((x) => x.id === reassignTo) : null;
          if (!target || target.id === p.id || !isStaff(target.role) || target.disabledAt) {
            throw new Error(`Elegí a qué profe pasar sus ${clients.length} clientes.`);
          }
          for (const c of clients) c.coachId = target.id;
        }
        for (const r of db.accessRequests) if (r.status === "pending" && r.requestedCoachId === p.id) r.requestedCoachId = reassignTo;
        p.disabledAt = now();
      });
      return delay(undefined);
    },
    async reactivate(profileId) {
      requireAdmin();
      mutate((db) => {
        const p = db.profiles.find((x) => x.id === profileId) ?? notFound("Profe");
        p.disabledAt = null;
      });
      return delay(undefined);
    },
  },
};

/**
 * «Restablecer datos de demo» (solo admin): vuelve al seed y borra lo que quedó en este navegador
 * (usuarios de prueba, contraseñas creadas y videos subidos).
 */
export async function resetDemoData(): Promise<void> {
  if (currentUser()?.role !== "admin") throw new Error("Solo el admin restablece la demo.");
  resetMockDb();
  window.localStorage.removeItem(PASSWORDS_KEY);
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase("reactive-mock-videos");
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
