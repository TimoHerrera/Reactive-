// Agenda de turnos: turnos que se repiten, superposiciones, próximo turno, recordatorio por WhatsApp y .ics.
// Funciones puras; las fechas y horas son de Buenos Aires (lib/agenda/time.ts).
import { addDays, diffDays, parseISODate, startOfWeek } from "@/lib/dates";
import type { Appointment, AppointmentStatus } from "@/lib/data/types";
import { APPOINTMENT_TYPE_LABEL } from "@/lib/data/types";
import { baDate, baTime, baTimestamp, baToday } from "./time";

/** Estados que ocupan el horario del profe (cancelado no). */
const OCCUPIES: AppointmentStatus[] = ["agendado", "reprogramacion_pedida", "asistio", "ausente"];

/** Tope de turnos que se crean de una vez con «Repetir». */
export const MAX_SERIES = 120;

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAYS_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** «jue 16/10» */
export function shortDay(date: string): string {
  const d = parseISODate(date);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** «jueves 16/10» */
export function longDay(date: string): string {
  const d = parseISODate(date);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** «hoy jueves 16/10», «mañana jueves 16/10», «el jueves 16/10» */
export function relativeDay(date: string, today: string): string {
  const diff = diffDays(today, date);
  if (diff === 0) return `hoy ${longDay(date)}`;
  if (diff === 1) return `mañana ${longDay(date)}`;
  return `el ${longDay(date)}`;
}

// ── Repetir ───────────────────────────────────────────────────────

export type Repeat = {
  /** Días de la semana (0 = domingo … 6 = sábado). */
  weekdays: number[];
  /** Cantidad de semanas (incluida la del primer turno)… */
  weeks?: number;
  /** …o fecha de fin (inclusive). Si vienen las dos, gana la fecha. */
  until?: string;
};

/**
 * Fechas de un turno recurrente a partir de `start` (incluido si cae en uno de los días).
 * Recorre semana a semana desde la del primer turno. Tope: MAX_SERIES turnos.
 */
export function recurringDates(start: string, repeat: Repeat): string[] {
  const days = [...new Set(repeat.weekdays)].filter((d) => d >= 0 && d <= 6);
  if (days.length === 0) return [start];
  // Lunes de la semana del inicio; el domingo (0) va al final de la semana.
  const monday = startOfWeek(start);
  const offset = (dow: number) => (dow + 6) % 7;
  const weeks = repeat.until ? Math.ceil((diffDays(monday, repeat.until) + 1) / 7) : Math.max(1, Math.min(52, repeat.weeks ?? 1));
  const out: string[] = [];
  for (let w = 0; w < weeks && out.length < MAX_SERIES; w++) {
    for (const dow of days.map(offset).sort((a, b) => a - b)) {
      const date = addDays(monday, w * 7 + dow);
      if (date < start || (repeat.until && date > repeat.until)) continue;
      out.push(date);
      if (out.length >= MAX_SERIES) break;
    }
  }
  return out;
}

// ── Superposición ─────────────────────────────────────────────────

type Slot = Pick<Appointment, "startsAt" | "durationMin">;
const end = (a: Slot) => new Date(a.startsAt).getTime() + a.durationMin * 60_000;
export const overlaps = (a: Slot, b: Slot) => new Date(a.startsAt).getTime() < end(b) && new Date(b.startsAt).getTime() < end(a);

/** Turnos del mismo profe que se pisan con el candidato (sin contar cancelados ni el propio turno). */
export function findConflicts<T extends Pick<Appointment, "id" | "coachId" | "startsAt" | "durationMin" | "status">>(
  candidate: Slot & { coachId: string; id?: string },
  existing: T[],
): T[] {
  return existing.filter((e) => e.id !== candidate.id && e.coachId === candidate.coachId && OCCUPIES.includes(e.status) && overlaps(candidate, e));
}

// ── Listas ────────────────────────────────────────────────────────

export const byStart = <T extends Pick<Appointment, "startsAt">>(a: T, b: T) => a.startsAt.localeCompare(b.startsAt);

/** Próximo turno vigente (agendado o con reprogramación pedida) desde `now` (incluye el que empezó hace < 30 min). */
export function nextAppointment<T extends Pick<Appointment, "startsAt" | "status">>(list: T[], now: Date = new Date()): T | null {
  const from = now.getTime() - 30 * 60_000;
  return [...list].sort(byStart).find((a) => (a.status === "agendado" || a.status === "reprogramacion_pedida") && new Date(a.startsAt).getTime() >= from) ?? null;
}

export const onDate = <T extends Pick<Appointment, "startsAt">>(list: T[], date: string) => list.filter((a) => baDate(a.startsAt) === date).sort(byStart);

/** Turnos de la semana (lunes a domingo) de `date`, agrupados por día. */
export function weekOf<T extends Pick<Appointment, "startsAt">>(list: T[], date: string): { date: string; items: T[] }[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => ({ date: d, items: onDate(list, d) }));
}

/** Asistencia: { asistio, ausente } de los turnos pasados. */
export function attendance(list: Pick<Appointment, "status">[]): { asistio: number; ausente: number } {
  return { asistio: list.filter((a) => a.status === "asistio").length, ausente: list.filter((a) => a.status === "ausente").length };
}

// ── Recordatorio por WhatsApp ─────────────────────────────────────

export const DEFAULT_APPOINTMENT_TEMPLATE =
  "¡Hola {nombre}! Te recordamos tu turno de {tipo} {cuando} a las {hora} en Reactive. ¿Nos confirmás? 💪";

/** Arma el mensaje con la plantilla ({nombre}, {tipo}, {cuando}, {hora}, {profe}). */
export function appointmentReminderText(
  a: Pick<Appointment, "startsAt" | "type">,
  opts: { clientName: string; coachName?: string | null; today?: string; template?: string },
): string {
  const date = baDate(a.startsAt);
  const values: Record<string, string> = {
    nombre: opts.clientName.split(" ")[0]!,
    tipo: APPOINTMENT_TYPE_LABEL[a.type],
    cuando: relativeDay(date, opts.today ?? baToday()),
    hora: baTime(a.startsAt),
    profe: opts.coachName ?? "",
  };
  return (opts.template ?? DEFAULT_APPOINTMENT_TEMPLATE).replace(/\{(nombre|tipo|cuando|hora|profe)\}/g, (_, k: string) => values[k]!);
}

// ── Agregar al calendario (.ics) ──────────────────────────────────

const icsDate = (ts: string) => new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Archivo .ics (un evento) para «Agregar a mi calendario». */
export function appointmentIcs(a: Pick<Appointment, "id" | "startsAt" | "durationMin" | "type" | "notes">, opts: { coachName?: string | null; now?: Date } = {}): string {
  const endTs = new Date(new Date(a.startsAt).getTime() + a.durationMin * 60_000).toISOString();
  const title = `${APPOINTMENT_TYPE_LABEL[a.type]}${opts.coachName ? ` con ${opts.coachName}` : ""} · Reactive`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Reactive//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.id}@reactive`,
    `DTSTAMP:${icsDate((opts.now ?? new Date()).toISOString())}`,
    `DTSTART:${icsDate(a.startsAt)}`,
    `DTEND:${icsDate(endTs)}`,
    `SUMMARY:${icsText(title)}`,
    "LOCATION:Reactive",
    ...(a.notes ? [`DESCRIPTION:${icsText(a.notes)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** Para mover un turno a otra fecha/hora conservando la duración. */
export function moveTo(date: string, time: string): string {
  return baTimestamp(date, time);
}
