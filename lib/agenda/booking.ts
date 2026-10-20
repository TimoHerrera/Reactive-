// Reservas online (F12): horarios libres de un profe según sus franjas, días bloqueados, reglas y turnos ocupados.
// Funciones puras; fechas y horas de Buenos Aires. La base (0013_reservas.sql) valida lo mismo al reservar.
import { addDays } from "@/lib/dates";
import type { Appointment, AppointmentType, AvailabilityRule, BookingSettings, BusySlot, CoachSchedule, TimeOff } from "@/lib/data/types";
import { overlaps } from "./agenda";
import { baDate, baTimestamp } from "./time";

export const SLOT_MINUTES = [30, 45, 60, 90];
export const BOOKING_LIMITS = {
  minNoticeHours: [0, 72],
  maxDaysAhead: [1, 90],
  cancelHours: [0, 72],
} as const;
export const ALL_TYPES: AppointmentType[] = ["kinesiologia", "entrenamiento", "evaluacion_funcional", "sport_recovery", "mep_sport"];
export const WEEKDAY_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/** Lunes primero (como se piensa la semana en el centro). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** De fábrica: apagado, confirma el profe, turnos de 60 min, 12 h de anticipación, hasta 30 días, cancelar hasta 24 h antes. */
export function defaultBookingSettings(coachId: string): BookingSettings {
  return {
    coachId,
    enabled: false,
    autoConfirm: false,
    slotMinutes: 60,
    minNoticeHours: 12,
    maxDaysAhead: 30,
    cancelHours: 24,
    types: ["kinesiologia", "entrenamiento"],
    updatedAt: null,
  };
}

// ── Validación ────────────────────────────────────────────────────

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const inRange = (n: number, [a, b]: readonly [number, number]) => Number.isInteger(n) && n >= a && n <= b;

/** Mensaje de error o null. Franjas válidas, sin pisarse dentro del mismo día. */
export function validateSchedule(s: Pick<CoachSchedule, "settings" | "rules">): string | null {
  const { settings: c, rules } = s;
  if (!SLOT_MINUTES.includes(c.slotMinutes)) return "Elegí la duración del turno.";
  if (!inRange(c.minNoticeHours, BOOKING_LIMITS.minNoticeHours)) return "La anticipación mínima va de 0 a 72 horas.";
  if (!inRange(c.maxDaysAhead, BOOKING_LIMITS.maxDaysAhead)) return "Se puede reservar de 1 a 90 días para adelante.";
  if (!inRange(c.cancelHours, BOOKING_LIMITS.cancelHours)) return "El plazo para cancelar va de 0 a 72 horas.";
  if (c.types.length === 0) return "Elegí al menos un tipo de turno.";
  for (const r of rules) {
    const day = WEEKDAY_LABEL[r.weekday] ?? "Ese día";
    if (!(r.weekday >= 0 && r.weekday <= 6)) return "Revisá el día de la semana.";
    if (!TIME.test(r.startTime) || !TIME.test(r.endTime)) return `${day}: revisá los horarios.`;
    if (toMinutes(r.endTime) - toMinutes(r.startTime) < c.slotMinutes) return `${day}: la franja de ${r.startTime} a ${r.endTime} es más corta que un turno.`;
  }
  for (let d = 0; d <= 6; d++) {
    const day = rules.filter((r) => r.weekday === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < day.length; i++) {
      if (day[i]!.startTime < day[i - 1]!.endTime) return `${WEEKDAY_LABEL[d]}: hay franjas que se pisan.`;
    }
  }
  return null;
}

// ── Horarios libres ───────────────────────────────────────────────

export type FreeSlot = { startsAt: string; time: string };

const dow = (date: string) => new Date(`${date}T12:00:00-03:00`).getUTCDay();

/**
 * Horarios libres de un día: cada franja se parte en turnos de `slotMinutes` desde su inicio.
 * Se descartan los días bloqueados, los que están fuera del rango (anticipación mínima / días para adelante)
 * y los que se pisan con un turno ocupado.
 */
export function freeSlots(input: {
  date: string;
  schedule: CoachSchedule;
  busy: BusySlot[];
  now: Date;
}): FreeSlot[] {
  const { date, schedule, busy, now } = input;
  const { settings: c } = schedule;
  if (!c.enabled) return [];
  if (schedule.timeOff.some((t) => t.date === date)) return [];
  const earliest = now.getTime() + c.minNoticeHours * 3_600_000;
  const lastDay = addDays(baDate(now), c.maxDaysAhead);
  if (date > lastDay) return [];
  const out: FreeSlot[] = [];
  const rules = schedule.rules.filter((r) => r.weekday === dow(date)).sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (const r of rules) {
    for (let m = toMinutes(r.startTime); m + c.slotMinutes <= toMinutes(r.endTime); m += c.slotMinutes) {
      const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const startsAt = baTimestamp(date, time);
      if (new Date(startsAt).getTime() < earliest) continue;
      const slot = { startsAt, durationMin: c.slotMinutes };
      if (busy.some((b) => overlaps(slot, b))) continue;
      out.push({ startsAt, time });
    }
  }
  return out;
}

/** Los próximos días reservables (desde hoy hasta `maxDaysAhead`) con sus horarios libres. */
export function bookableDays(input: { schedule: CoachSchedule; busy: BusySlot[]; now: Date }): { date: string; slots: FreeSlot[] }[] {
  const today = baDate(input.now);
  const days = input.schedule.settings.maxDaysAhead;
  return Array.from({ length: days + 1 }, (_, i) => addDays(today, i)).map((date) => ({ date, slots: freeSlots({ ...input, date }) }));
}

/** Error si el horario elegido no es reservable (la base valida lo mismo). */
export function checkBooking(input: { startsAt: string; type: AppointmentType; schedule: CoachSchedule; busy: BusySlot[]; now: Date }): string | null {
  const c = input.schedule.settings;
  if (!c.enabled) return "Tu profe todavía no habilitó las reservas online.";
  if (!c.types.includes(input.type)) return "Ese tipo de turno no se puede reservar online.";
  const date = baDate(input.startsAt);
  const ok = freeSlots({ date, schedule: input.schedule, busy: input.busy, now: input.now }).some((s) => s.startsAt === new Date(input.startsAt).toISOString());
  return ok ? null : "Ese horario ya no está disponible. Elegí otro.";
}

/**
 * ¿El paciente puede cancelar este turno? Una reserva por confirmar se puede retirar hasta que empiece;
 * un turno agendado, solo antes del plazo del profe.
 */
export function canClientCancel(a: Pick<Appointment, "status" | "startsAt">, settings: Pick<BookingSettings, "cancelHours">, now: Date = new Date()): boolean {
  const left = new Date(a.startsAt).getTime() - now.getTime();
  if (a.status === "pendiente") return left > 0;
  if (a.status === "agendado") return left >= settings.cancelHours * 3_600_000;
  return false;
}

/** «Podés cancelar hasta 24 h antes» / «hasta el momento del turno». */
export function cancelRule(settings: Pick<BookingSettings, "cancelHours">): string {
  return settings.cancelHours === 0 ? "Podés cancelar hasta el momento del turno." : `Podés cancelar hasta ${settings.cancelHours} h antes.`;
}

/** Ocupación (para quien reserva): solo inicio y duración de los turnos que ocupan el horario. */
export const toBusy = (list: Pick<Appointment, "startsAt" | "durationMin">[]): BusySlot[] => list.map((a) => ({ startsAt: a.startsAt, durationMin: a.durationMin }));

/** Turno nuevo de una reserva. */
export function bookedAppointment(input: {
  id: string;
  clientId: string;
  coachId: string;
  startsAt: string;
  type: AppointmentType;
  notes: string | null;
  settings: BookingSettings;
  now: string;
}): Appointment {
  return {
    id: input.id,
    clientId: input.clientId,
    coachId: input.coachId,
    startsAt: new Date(input.startsAt).toISOString(),
    durationMin: input.settings.slotMinutes,
    type: input.type,
    status: input.settings.autoConfirm ? "agendado" : "pendiente",
    notes: input.notes?.trim().slice(0, 300) || null,
    seriesId: null,
    createdBy: input.clientId,
    createdAt: input.now,
    rescheduleReason: null,
    reschedulePreference: null,
    rescheduleRequestedAt: null,
  };
}

/** Resumen de las franjas de un día: «8:00–12:00 · 15:00–19:00». */
export function dayRulesText(rules: AvailabilityRule[], weekday: number): string {
  const day = rules.filter((r) => r.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
  return day.length ? day.map((r) => `${r.startTime}–${r.endTime}`).join(" · ") : "Sin atención";
}

/** Días bloqueados futuros, ordenados. */
export const upcomingTimeOff = (list: TimeOff[], today: string) => list.filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date));
