// Base de datos mock: vive en localStorage del navegador, sembrada con buildSeed().
// Así funciona igual en local y en los previews de Vercel (sin estado en el servidor).
import { buildSeed, type Db } from "../seed";

const KEY = "reactive-mock-db-v1";
let db: Db | null = null;
const listeners = new Set<() => void>();

function canPersist() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function load(): Db {
  if (!canPersist()) return buildSeed();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Db;
      // Datos guardados por versiones anteriores: completamos las colecciones nuevas.
      const seed = buildSeed();
      saved.accessRequests ??= seed.accessRequests;
      saved.activations ??= [];
      saved.setLogs ??= seed.setLogs;
      saved.appointments ??= seed.appointments;
      saved.clientPlans ??= seed.clientPlans;
      saved.payments ??= seed.payments;
      saved.settings ??= seed.settings;
      saved.bookingSettings ??= seed.bookingSettings;
      saved.availabilityRules ??= seed.availabilityRules;
      saved.timeOff ??= seed.timeOff;
      saved.notificationPrefs ??= [];
      saved.notificationSeen ??= [];
      saved.inviteCodes ??= [];
      for (const r of saved.accessRequests) if (r.linkedProfileId === undefined) r.linkedProfileId = null;
      for (const r of saved.routines) {
        if (r.updatedBy === undefined) r.updatedBy = null;
        if (r.updatedAt === undefined) r.updatedAt = null;
      }
      for (const p of saved.profiles) {
        if (p.bio === undefined) p.bio = null;
        if (p.avatarPath === undefined) p.avatarPath = null;
        if (p.activatedAt === undefined) p.activatedAt = p.createdAt; // perfiles de versiones anteriores: ya activos
        if (p.disabledAt === undefined) p.disabledAt = null;
      }
      return saved;
    }
  } catch {
    // JSON corrupto o storage bloqueado: arrancamos del seed.
  }
  const fresh = buildSeed();
  persist(fresh);
  return fresh;
}

function persist(value: Db) {
  if (!canPersist()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage lleno o bloqueado: seguimos en memoria.
  }
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function getDb(): Db {
  if (!db) db = load();
  return db;
}

export function mutate<T>(fn: (db: Db) => T): T {
  const current = getDb();
  const result = fn(current);
  persist(current);
  emit();
  return result;
}

export function resetMockDb() {
  db = buildSeed();
  persist(db);
  emit();
}

export function subscribeMockDb(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== "undefined") {
  // Otra pestaña cambió los datos (ej. profe en una, clienta en otra).
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      db = null;
      emit();
    }
  });
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Latencia artificial para ver los estados de carga en modo mock. */
export function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}
