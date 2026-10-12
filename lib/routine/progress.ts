// Progreso del cliente: semana (lunes a domingo), sesión del día y estimación de duración.
import { addDays, parseISODate, startOfWeek, toISODate, todayISO } from "@/lib/dates";
import type { DayTree, ItemCheck, RoutineTree, WorkoutSession } from "@/lib/data/types";
import { itemsOfDay } from "./locate";

/** Fecha local («YYYY-MM-DD») de un timestamp. */
export const localDate = (iso: string) => toISODate(new Date(iso));

export function inWeek(iso: string, today: string = todayISO()): boolean {
  const d = localDate(iso);
  const start = startOfWeek(today);
  return d >= start && d <= addDays(start, 6);
}

/** Sesión vigente de un día: la más reciente de esta semana. */
export function sessionForDay(sessions: WorkoutSession[], dayId: string, today: string = todayISO()): WorkoutSession | null {
  return (
    sessions
      .filter((s) => s.dayId === dayId && inWeek(s.startedAt, today))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
  );
}

export function dayProgress(day: DayTree, checks: ItemCheck[], sessionId: string | null) {
  const items = itemsOfDay(day);
  const done = sessionId ? items.filter((i) => checks.some((c) => c.sessionId === sessionId && c.itemId === i.id)).length : 0;
  return { done, total: items.length };
}

export type WeekDot = { label: string; date: string; state: "done" | "today" | "none" };

/** «2/3 sesiones hechas» + puntos L M M J V S D. */
export function weekSummary(routine: Pick<RoutineTree, "daysPerWeek">, sessions: WorkoutSession[], today: string = todayISO()) {
  const start = startOfWeek(today);
  const completed = sessions.filter((s) => s.completedAt && inWeek(s.completedAt, today));
  const doneDates = new Set(completed.map((s) => localDate(s.completedAt!)));
  const dots: WeekDot[] = ["L", "M", "M", "J", "V", "S", "D"].map((label, i) => {
    const date = addDays(start, i);
    return { label, date, state: doneDates.has(date) ? "done" : date === today ? "today" : "none" };
  });
  return { completed: completed.length, target: routine.daysPerWeek, dots };
}

/**
 * Sesión sugerida para hoy: si hoy ya se empezó un día, ese; si no, el primer día
 * (en orden) que no se completó esta semana; si se completaron todos, el Día A.
 */
export function suggestedDay(tree: RoutineTree, sessions: WorkoutSession[], today: string = todayISO()): DayTree | null {
  if (tree.days.length === 0) return null;
  const startedToday = sessions
    .filter((s) => localDate(s.startedAt) === today)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (startedToday && !startedToday.completedAt) {
    const d = tree.days.find((x) => x.id === startedToday.dayId);
    if (d) return d;
  }
  const doneThisWeek = new Set(sessions.filter((s) => s.completedAt && inWeek(s.completedAt, today)).map((s) => s.dayId));
  return tree.days.find((d) => !doneThisWeek.has(d.id)) ?? tree.days[0]!;
}

/** «90 s» → 90, «2 min» → 120, «1:30» → 90, «45» → 45. */
export function parseSeconds(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(",", ".").trim();
  const mmss = t.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  if (/min|'/.test(t)) return Math.round(n * 60);
  return Math.round(n);
}

/** Duración estimada del día en minutos, redondeada a 5 (≈ 40 s de trabajo por serie + descanso). */
export function estimateMinutes(day: DayTree): number {
  const WORK_PER_SET = 40;
  const TRANSITION = 60;
  let total = 0;
  for (const it of itemsOfDay(day)) {
    const sets = it.sets ?? 1;
    const work = parseSeconds(it.reps?.match(/\d+\s*(s|seg|min)/i)?.[0] ?? null) ?? WORK_PER_SET;
    const rest = parseSeconds(it.rest) ?? 45;
    total += sets * (work * (/c\/lado/i.test(it.reps ?? "") ? 2 : 1)) + Math.max(0, sets - 1) * rest + TRANSITION;
  }
  return Math.max(5, Math.round(total / 60 / 5) * 5);
}

/** «Hoy toca tren inferior. ¡No faltes!» */
export function todayLine(day: DayTree | null): string {
  if (!day) return "Tu profe está armando tu rutina.";
  const title = day.title.trim().replace(/\.+$/, "");
  return title ? `Hoy toca ${title.charAt(0).toLowerCase()}${title.slice(1)}. ¡No faltes!` : `Hoy toca el Día ${day.label}. ¡No faltes!`;
}

export function weekdayIndex(iso: string): number {
  return (parseISODate(iso).getDay() + 6) % 7;
}
