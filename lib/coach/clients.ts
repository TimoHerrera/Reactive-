import { diffDays, formatShortWeekday, todayISO } from "@/lib/dates";
import { CASE_TYPE_LABEL, type Profile, type Routine, type WorkoutSession } from "@/lib/data/types";
import { normalizeText } from "@/lib/text";
import { clientRoutineFilter, currentRoutine, type ClientRoutineFilter } from "@/lib/routine/status";

export type ClientSummary = {
  client: Profile;
  filter: ClientRoutineFilter;
  current: Routine | null;
  /** «Lesión deportiva · Readaptación – Fase 2», «Postquirúrgico · LCA Fase 3 · vence jue 15/10» */
  subtitle: string;
};

export function summarizeClient(client: Profile, routinesOfClient: Routine[], today: string = todayISO()): ClientSummary {
  const published = routinesOfClient.filter((r) => r.publishedAt && !r.isTemplate);
  const current = currentRoutine(published, today);
  const filter = clientRoutineFilter(published, today);
  const parts: string[] = [];
  if (client.caseType) parts.push(CASE_TYPE_LABEL[client.caseType]);
  if (filter === "por-vencer" && current?.endsOn) {
    if (client.caseDetail) parts.push(client.caseDetail);
    parts.push(`vence ${formatShortWeekday(current.endsOn)}`);
  } else if (current) parts.push(current.name);
  else if (client.caseDetail) parts.push(client.caseDetail);
  return { client, filter, current, subtitle: parts.join(" · ") };
}

/** Buscar por nombre, objetivo, deporte o caso (sin acentos). */
export function matchesClient(s: ClientSummary, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const c = s.client;
  const hay = normalizeText([c.fullName, c.goal, c.sport, c.caseDetail, c.caseType ? CASE_TYPE_LABEL[c.caseType] : "", s.current?.name].filter(Boolean).join(" "));
  return q.split(" ").every((t) => hay.includes(t));
}

/** Sesiones completadas en la rutina vs. planificadas (días por semana × semanas). */
export function routineProgress(r: Routine, sessions: WorkoutSession[]) {
  const weeks = r.startsOn && r.endsOn ? Math.max(1, Math.round((diffDays(r.startsOn, r.endsOn) + 1) / 7)) : 1;
  const planned = r.daysPerWeek * weeks;
  const done = sessions.filter((s) => s.routineId === r.id && s.completedAt).length;
  return { done, planned, weeks };
}

export function sortClients(list: ClientSummary[]): ClientSummary[] {
  // Primero las que vencen antes; después activas, sin rutina al final; por nombre.
  const rank = (s: ClientSummary) => (s.filter === "por-vencer" ? 0 : s.filter === "activa" ? 1 : 2);
  return [...list].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.current?.endsOn && b.current?.endsOn ? a.current.endsOn.localeCompare(b.current.endsOn) : 0) ||
      a.client.fullName.localeCompare(b.client.fullName, "es"),
  );
}

