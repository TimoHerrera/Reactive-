import { diffDays, todayISO } from "@/lib/dates";
import type { Routine } from "@/lib/data/types";

export type RoutineStatus = "plantilla" | "borrador" | "programada" | "activa" | "por-vencer" | "vencida";

export const EXPIRING_DAYS = 7;

/** El estado se calcula, no se guarda. «Por vencer» = vence en ≤ 7 días. */
export function routineStatus(
  r: Pick<Routine, "isTemplate" | "publishedAt" | "startsOn" | "endsOn">,
  today: string = todayISO(),
): RoutineStatus {
  if (r.isTemplate) return "plantilla";
  if (!r.publishedAt) return "borrador";
  if (r.endsOn && diffDays(r.endsOn, today) > 0) return "vencida";
  if (r.startsOn && diffDays(today, r.startsOn) > 0) return "programada";
  if (r.endsOn && diffDays(today, r.endsOn) <= EXPIRING_DAYS) return "por-vencer";
  return "activa";
}

export function isCurrent(status: RoutineStatus): boolean {
  return status === "activa" || status === "por-vencer";
}

/** Rutina vigente de un cliente: la publicada más reciente que no venció. */
export function currentRoutine<T extends Routine>(routines: T[], today: string = todayISO()): T | null {
  const current = routines
    .filter((r) => r.clientId && isCurrent(routineStatus(r, today)))
    .sort((a, b) => (b.startsOn ?? "").localeCompare(a.startsOn ?? ""));
  return current[0] ?? null;
}

export type ClientRoutineFilter = "activa" | "por-vencer" | "sin-rutina";

/** Para los filtros de Clientes (Activa / Por vencer / Sin rutina). */
export function clientRoutineFilter(routinesOfClient: Routine[], today: string = todayISO()): ClientRoutineFilter {
  const cur = currentRoutine(routinesOfClient, today);
  if (!cur) return "sin-rutina";
  return routineStatus(cur, today) === "por-vencer" ? "por-vencer" : "activa";
}
