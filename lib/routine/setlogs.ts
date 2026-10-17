// Registro real («¿Cómo te fue?»): filas precargadas con lo planificado, limpieza antes de guardar
// y comparación planificado vs. hecho para la ficha del profe. Funciones puras.
import type { RoutineItem, SetLog } from "@/lib/data/types";
import type { SetLogInput } from "@/lib/data/repositories";
import { rpeExceeded } from "./effort";

/** Tope de series que se registran por ejercicio (por si cargaron «20» por error). */
export const MAX_LOGGED_SETS = 12;

/** Filas del panel: una por serie, precargadas con reps y carga planificadas (o con lo ya registrado). */
export function draftSetLogs(item: Pick<RoutineItem, "sets" | "reps" | "load">, previous: SetLog[] = []): SetLogInput[] {
  const n = Math.min(MAX_LOGGED_SETS, Math.max(1, item.sets ?? 1, previous.length));
  return Array.from({ length: n }, (_, i) => {
    const prev = previous.find((l) => l.setNumber === i + 1);
    return {
      setNumber: i + 1,
      reps: prev ? prev.reps : item.reps,
      load: prev ? prev.load : item.load,
      rpe: prev?.rpe ?? null,
      note: i === 0 ? (prev?.note ?? null) : null,
    };
  });
}

/** Normaliza antes de guardar: RPE entero 1–10 (o null), textos recortados, series consecutivas. */
export function cleanSetLogs(logs: SetLogInput[]): SetLogInput[] {
  const text = (v: string | null | undefined, max: number) => (v ?? "").trim().slice(0, max) || null;
  return logs.slice(0, MAX_LOGGED_SETS).map((l, i) => {
    const rpe = l.rpe == null || Number.isNaN(Number(l.rpe)) ? null : Math.round(Number(l.rpe));
    return {
      setNumber: i + 1,
      reps: text(l.reps, 20),
      load: text(l.load, 30),
      rpe: rpe != null && rpe >= 1 && rpe <= 10 ? rpe : null,
      note: text(l.note, 300),
    };
  });
}

/** El RPE más alto registrado en un ejercicio (null si no cargó RPE). */
export function maxRpe(logs: Pick<SetLog, "rpe">[]): number | null {
  const values = logs.map((l) => l.rpe).filter((v): v is number => v != null);
  return values.length ? Math.max(...values) : null;
}

export type ItemLogSummary = {
  itemId: string;
  logs: SetLog[];
  maxRpe: number | null;
  /** RPE real ≥ objetivo + 2. */
  alert: boolean;
  note: string | null;
};

/** Agrupa el registro de una sesión por ejercicio y marca los que superaron el RPE objetivo. */
export function summarizeSession(items: Pick<RoutineItem, "id" | "rpeTarget">[], logs: SetLog[]): ItemLogSummary[] {
  return items
    .map((it) => {
      const mine = logs.filter((l) => l.itemId === it.id).sort((a, b) => a.setNumber - b.setNumber);
      const top = maxRpe(mine);
      return { itemId: it.id, logs: mine, maxRpe: top, alert: rpeExceeded(top, it.rpeTarget), note: mine.find((l) => l.note)?.note ?? null };
    })
    .filter((s) => s.logs.length > 0);
}
