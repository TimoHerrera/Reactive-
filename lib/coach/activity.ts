// «Actividad reciente» del Panel del profe: sesiones completas y parciales, rutinas que vencen
// videos vistos varias veces (posible duda con la técnica) y RPE real por encima del objetivo. Puro y testeable.
import { diffDays, formatRelative, parseISODate, toISODate } from "@/lib/dates";
import type { ExerciseView, ItemCheck, Profile, Routine, RoutineTree, SetLog, WorkoutSession } from "@/lib/data/types";
import { CASE_TYPE_LABEL } from "@/lib/data/types";
import { itemsOfDay } from "@/lib/routine/locate";
import { routineStatus } from "@/lib/routine/status";
import { summarizeSession } from "@/lib/routine/setlogs";

export type ActivityKind = "completada" | "parcial" | "vence" | "vistas" | "rpe";

export type ActivityItem = {
  key: string;
  kind: ActivityKind;
  clientId: string;
  clientName: string;
  /** Texto principal; `strong` va resaltado (nombre). */
  parts: { text: string; strong?: boolean }[];
  sub: string;
  at: string; // para ordenar
};

const WEEKDAY = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** «hoy», «mañana», «el jueves», «el 30/10» */
export function whenLabel(date: string, today: string): string {
  const d = diffDays(today, date);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d > 1 && d < 7) return `el ${WEEKDAY[parseISODate(date).getDay()]}`;
  const p = parseISODate(date);
  return `el ${p.getDate()}/${p.getMonth() + 1}`;
}

export function buildActivity(input: {
  clients: Profile[];
  routines: Routine[];
  trees: Map<string, RoutineTree>;
  sessions: WorkoutSession[];
  checks: ItemCheck[];
  views: ExerciseView[];
  /** Registro real («¿Cómo te fue?»): RPE real ≥ objetivo + 2 → aviso. */
  setLogs?: SetLog[];
  exerciseNames: Map<string, string>;
  now?: Date;
  limit?: number;
}): ActivityItem[] {
  const now = input.now ?? new Date();
  const today = toISODate(now);
  const clientById = new Map(input.clients.map((c) => [c.id, c]));
  const out: ActivityItem[] = [];
  const recent = (iso: string, days: number) => diffDays(toISODate(new Date(iso)), today) <= days;

  // Sesiones (últimos 3 días)
  for (const s of input.sessions) {
    const c = clientById.get(s.clientId);
    const tree = input.trees.get(s.routineId);
    const day = tree?.days.find((d) => d.id === s.dayId);
    if (!c || !day) continue;
    const total = itemsOfDay(day).length;
    const done = input.checks.filter((k) => k.sessionId === s.id).length;
    if (s.completedAt && recent(s.completedAt, 3)) {
      out.push({
        key: `s-${s.id}`,
        kind: "completada",
        clientId: c.id,
        clientName: c.fullName,
        parts: [{ text: c.fullName, strong: true }, { text: ` completó el Día ${day.label}` }],
        sub: `${total}/${total} ejercicios · ${formatRelative(s.completedAt, now)}`,
        at: s.completedAt,
      });
    } else if (!s.completedAt && done > 0 && recent(s.startedAt, 3)) {
      const last = input.checks.filter((k) => k.sessionId === s.id).map((k) => k.checkedAt).sort().at(-1) ?? s.startedAt;
      out.push({
        key: `s-${s.id}`,
        kind: "parcial",
        clientId: c.id,
        clientName: c.fullName,
        parts: [{ text: c.fullName, strong: true }, { text: ` marcó ${done} de ${total} en el Día ${day.label}` }],
        sub: formatRelative(last, now),
        at: last,
      });
    }
  }

  // RPE real por encima del objetivo (últimos 3 días)
  for (const s of input.sessions) {
    const c = clientById.get(s.clientId);
    const day = input.trees.get(s.routineId)?.days.find((d) => d.id === s.dayId);
    const logs = (input.setLogs ?? []).filter((l) => l.sessionId === s.id);
    if (!c || !day || logs.length === 0) continue;
    const items = itemsOfDay(day);
    for (const sum of summarizeSession(items, logs)) {
      const last = sum.logs.map((l) => l.createdAt).sort().at(-1)!;
      if (!sum.alert || !recent(last, 3)) continue;
      const item = items.find((i) => i.id === sum.itemId)!;
      const name = (item.exerciseId && input.exerciseNames.get(item.exerciseId)) || item.rawName;
      out.push({
        key: `rpe-${s.id}-${item.id}`,
        kind: "rpe",
        clientId: c.id,
        clientName: c.fullName,
        parts: [{ text: c.fullName.split(" ")[0]!, strong: true }, { text: ` marcó RPE ${sum.maxRpe} en ${name} (objetivo ${item.rpeTarget})` }],
        sub: [formatRelative(last, now), sum.note && `«${sum.note}»`].filter(Boolean).join(" · "),
        at: last,
      });
    }
  }

  // Rutinas por vencer (≤ 7 días)
  for (const r of input.routines) {
    if (!r.clientId || !r.endsOn || routineStatus(r, today) !== "por-vencer") continue;
    const c = clientById.get(r.clientId);
    if (!c) continue;
    const caseText = [c.caseType ? CASE_TYPE_LABEL[c.caseType] : null, r.name].filter(Boolean).join(" · ");
    out.push({
      key: `r-${r.id}`,
      kind: "vence",
      clientId: c.id,
      clientName: c.fullName,
      parts: [{ text: "La rutina de " }, { text: c.fullName, strong: true }, { text: ` vence ${whenLabel(r.endsOn, today)}` }],
      sub: caseText,
      // Lo urgente arriba: cuanto antes vence, más «reciente».
      at: new Date(now.getTime() - diffDays(today, r.endsOn) * 3_600_000).toISOString(),
    });
  }

  // Videos vistos 3+ veces por el mismo cliente (últimos 7 días)
  const groups = new Map<string, ExerciseView[]>();
  for (const v of input.views) {
    if (!recent(v.viewedAt, 7)) continue;
    const k = `${v.clientId}|${v.exerciseId}`;
    groups.set(k, [...(groups.get(k) ?? []), v]);
  }
  for (const [k, list] of groups) {
    if (list.length < 3) continue;
    const [clientId, exerciseId] = k.split("|") as [string, string];
    const c = clientById.get(clientId);
    const name = input.exerciseNames.get(exerciseId);
    if (!c || !name) continue;
    const last = list.map((v) => v.viewedAt).sort().at(-1)!;
    out.push({
      key: `v-${k}`,
      kind: "vistas",
      clientId,
      clientName: c.fullName,
      parts: [{ text: c.fullName, strong: true }, { text: ` vio «${name}» ${list.length} veces` }],
      sub: `${formatRelative(last, now)} · ¿dudas con la técnica?`,
      at: last,
    });
  }

  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, input.limit ?? 8);
}

/** «Buen lunes, Nico.» */
export function greeting(firstName: string, now: Date = new Date()): string {
  return `Buen ${WEEKDAY[now.getDay()]}, ${firstName}.`;
}
