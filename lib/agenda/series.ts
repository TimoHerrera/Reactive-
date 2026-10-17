// Crear y editar turnos (sueltos o recurrentes). Puro: lo usan el mock y la implementación Supabase.
import type { Appointment, AppointmentStatus, AppointmentType } from "@/lib/data/types";
import { recurringDates, type Repeat } from "./agenda";
import { baDate, baTime, baTimestamp } from "./time";

export type AppointmentInput = {
  clientId: string;
  coachId: string;
  /** Primer turno (timestamp). */
  startsAt: string;
  durationMin: number;
  type: AppointmentType;
  notes: string | null;
};

export type AppointmentPatch = Partial<{
  startsAt: string;
  durationMin: number;
  type: AppointmentType;
  notes: string | null;
  status: AppointmentStatus;
  coachId: string;
}>;

/** «solo este» o «este y los siguientes» (misma serie, desde este turno en adelante). */
export type EditScope = "this" | "following";

export const DURATIONS = [30, 45, 60, 75, 90, 120];

export function validateAppointment(input: Pick<AppointmentInput, "clientId" | "coachId" | "startsAt" | "durationMin">): string | null {
  if (!input.clientId) return "Elegí el paciente.";
  if (!input.coachId) return "Falta el profe.";
  if (Number.isNaN(new Date(input.startsAt).getTime())) return "Revisá la fecha y la hora.";
  if (!(input.durationMin >= 10 && input.durationMin <= 480)) return "La duración tiene que ser entre 10 min y 8 h.";
  return null;
}

/** Turnos a crear: uno solo, o uno por fecha de la repetición (misma hora), todos con la misma serie. */
export function buildAppointments(
  input: AppointmentInput,
  repeat: Repeat | null,
  ctx: { newId: () => string; createdBy: string; now: string },
): Appointment[] {
  const time = baTime(input.startsAt);
  const dates = repeat ? recurringDates(baDate(input.startsAt), repeat) : [baDate(input.startsAt)];
  const seriesId = dates.length > 1 ? ctx.newId() : null;
  return dates.map((date) => ({
    id: ctx.newId(),
    clientId: input.clientId,
    coachId: input.coachId,
    startsAt: baTimestamp(date, time),
    durationMin: input.durationMin,
    type: input.type,
    status: "agendado",
    notes: input.notes?.trim() || null,
    seriesId,
    createdBy: ctx.createdBy,
    createdAt: ctx.now,
    rescheduleReason: null,
    reschedulePreference: null,
    rescheduleRequestedAt: null,
  }));
}

const clearRequest = { rescheduleReason: null, reschedulePreference: null, rescheduleRequestedAt: null };

/**
 * Turnos modificados por una edición.
 * - «solo este»: se aplica todo tal cual (incluida la fecha).
 * - «este y los siguientes»: a cada turno de la serie desde este en adelante se le aplica tipo, duración, nota,
 *   profe y estado; si cambió la hora, cada uno conserva su fecha y toma la hora nueva.
 * Si el profe mueve un turno con reprogramación pedida, vuelve a «agendado» y se limpia el pedido.
 */
export function applyPatch(all: Appointment[], targetId: string, patch: AppointmentPatch, scope: EditScope = "this"): Appointment[] {
  const target = all.find((a) => a.id === targetId);
  if (!target) return [];
  const affected =
    scope === "following" && target.seriesId
      ? all.filter((a) => a.seriesId === target.seriesId && a.startsAt >= target.startsAt)
      : [target];
  const newTime = patch.startsAt ? baTime(patch.startsAt) : null;
  const moved = !!patch.startsAt && patch.startsAt !== target.startsAt;

  return affected.map((a) => {
    const isTarget = a.id === target.id;
    const startsAt = isTarget ? (patch.startsAt ?? a.startsAt) : newTime ? baTimestamp(baDate(a.startsAt), newTime) : a.startsAt;
    const next: Appointment = {
      ...a,
      startsAt,
      durationMin: patch.durationMin ?? a.durationMin,
      type: patch.type ?? a.type,
      notes: patch.notes !== undefined ? patch.notes?.trim() || null : a.notes,
      coachId: patch.coachId ?? a.coachId,
      status: patch.status ?? a.status,
    };
    // Mover a otra fecha/hora resuelve el pedido de reprogramación.
    if (moved && a.status === "reprogramacion_pedida" && !patch.status) next.status = "agendado";
    if (next.status !== "reprogramacion_pedida") Object.assign(next, clearRequest);
    return next;
  });
}

/** Pedido de reprogramación del paciente. */
export function requestReschedule(a: Appointment, input: { reason: string; preference: string }, now: string): Appointment {
  return {
    ...a,
    status: "reprogramacion_pedida",
    rescheduleReason: input.reason.trim().slice(0, 300) || null,
    reschedulePreference: input.preference.trim().slice(0, 120) || null,
    rescheduleRequestedAt: now,
  };
}

/** ¿El paciente puede pedir reprogramar? Solo turnos agendados que no empezaron. */
export function canRequestReschedule(a: Pick<Appointment, "status" | "startsAt">, now: Date = new Date()): boolean {
  return a.status === "agendado" && new Date(a.startsAt).getTime() > now.getTime();
}
