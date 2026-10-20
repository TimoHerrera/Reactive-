// Avisos del profe (F11): qué pasa con sus pacientes según lo que él eligió en «Mis avisos». Funciones puras.
// Cada aviso tiene una clave estable: si el profe ya lo vio (o ya salió por mail), no vuelve a aparecer como nuevo.
import { shortDay } from "@/lib/agenda/agenda";
import { baDate, baTime } from "@/lib/agenda/time";
import { APPOINTMENT_TYPE_LABEL } from "@/lib/data/types";
import type { BillingRow } from "@/lib/billing/rows";
import { dm, formatMoney } from "@/lib/billing/status";
import { addDays, diffDays } from "@/lib/dates";
import type { Appointment, NotificationPrefs, Role } from "@/lib/data/types";

export type AlertKind = "vence" | "vencido" | "pack" | "reprogramacion" | "reserva";

export type Alert = {
  /** Estable mientras sea «el mismo» aviso (mismo vencimiento, misma repetición, mismo pedido). */
  key: string;
  kind: AlertKind;
  clientId: string;
  title: string;
  detail: string;
  /** Desde cuándo corresponde el aviso (para ordenar y para «hace 2 días»). */
  date: string;
  href: string;
};

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  vence: "Por vencer",
  vencido: "Sin pagar",
  pack: "Pack",
  reprogramacion: "Reprogramación",
  reserva: "Reserva",
};

// ── Preferencias ──────────────────────────────────────────────────

export const LIMITS = {
  dueSoonDays: [1, 60],
  overdueAfterDays: [0, 90],
  overdueRepeatDays: [1, 60],
  packLowSessions: [0, 10],
} as const;

/** De fábrica: 3 días antes, al día siguiente de vencido y cada 7 días, pack con 1 sesión, reprogramaciones. Sin mail. */
export function defaultPrefs(role: Role | null | undefined): NotificationPrefs {
  return {
    dueSoonEnabled: true,
    dueSoonDays: 3,
    overdueEnabled: true,
    overdueAfterDays: 1,
    overdueRepeatDays: 7,
    packLowEnabled: true,
    packLowSessions: 1,
    rescheduleEnabled: true,
    bookingEnabled: true,
    scope: role === "admin" ? "all" : "mine",
    emailEnabled: false,
    updatedAt: null,
  };
}

export type PrefsInput = Omit<NotificationPrefs, "updatedAt">;

const inRange = (n: number, [min, max]: readonly [number, number]) => Number.isInteger(n) && n >= min && n <= max;

/** Mensaje de error o null. */
export function validatePrefs(p: PrefsInput): string | null {
  if (!inRange(p.dueSoonDays, LIMITS.dueSoonDays)) return "Los días antes del vencimiento van de 1 a 60.";
  if (!inRange(p.overdueAfterDays, LIMITS.overdueAfterDays)) return "Los días después del vencimiento van de 0 a 90.";
  if (p.overdueRepeatDays !== null && !inRange(p.overdueRepeatDays, LIMITS.overdueRepeatDays)) return "La repetición va de 1 a 60 días.";
  if (!inRange(p.packLowSessions, LIMITS.packLowSessions)) return "Las sesiones del pack van de 0 a 10.";
  if (p.scope !== "mine" && p.scope !== "all") return "Elegí de quiénes querés los avisos.";
  return null;
}

const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** Resumen de una regla para la pantalla de configuración: «3 días antes del vencimiento». */
export function describeRule(kind: AlertKind, p: NotificationPrefs): string {
  if (kind === "vence") return `${days(p.dueSoonDays)} antes del vencimiento`;
  if (kind === "vencido") {
    const first = p.overdueAfterDays === 0 ? "el mismo día que vence" : `${days(p.overdueAfterDays)} después de vencer`;
    return p.overdueRepeatDays ? `${first} y cada ${days(p.overdueRepeatDays)} mientras siga sin pagar` : `${first}, una sola vez`;
  }
  if (kind === "pack") return p.packLowSessions === 0 ? "cuando se termina el pack" : `cuando quedan ${p.packLowSessions} ${p.packLowSessions === 1 ? "sesión" : "sesiones"} o menos`;
  if (kind === "reserva") return "cuando un paciente reserva y hay que confirmar";
  return "cuando un paciente pide cambiar un turno";
}

// ── Avisos ────────────────────────────────────────────────────────

const firstName = (name: string) => name.split(" ")[0] ?? name;
const paidFor = (row: BillingRow, period: string | null) =>
  period ? row.payments.filter((p) => p.period === period).reduce((s, p) => s + p.amountCents, 0) : 0;
const pagosHref = (clientId: string) => `/coach/clientes/${clientId}?tab=pagos`;

/**
 * Avisos de un profe según sus preferencias.
 * - `rows`: estado de cobro de los pacientes que la capa de datos le deja ver.
 * - `requests`: turnos (con «reprogramación pedida» o no, se filtran acá).
 * - Profe: solo sus pacientes. Admin: todos o solo los suyos, según `prefs.scope`.
 */
export function buildAlerts(input: {
  rows: BillingRow[];
  appointments: Appointment[];
  prefs: NotificationPrefs;
  me: { id: string; role: Role };
  today: string;
}): Alert[] {
  const { rows, prefs, me, today } = input;
  const everyone = me.role === "admin" && prefs.scope === "all";
  const mine = rows.filter((r) => everyone || r.client.coachId === me.id);
  const alerts: Alert[] = [];

  for (const row of mine) {
    const { client, plan, status } = row;
    if (!plan || !plan.active) continue;
    const name = client.fullName;

    // Cuota mensual por vencer: N días antes (el aviso aparece ese día y sigue hasta que paga o vence).
    if (prefs.dueSoonEnabled && plan.kind === "mensual" && (status.state === "al_dia" || status.state === "por_vencer") && status.dueOn) {
      const left = diffDays(today, status.dueOn);
      if (left >= 0 && left <= prefs.dueSoonDays) {
        const owed = Math.max(0, plan.amountCents - paidFor(row, status.periodToCharge));
        alerts.push({
          key: `vence:${client.id}:${status.dueOn}`,
          kind: "vence",
          clientId: client.id,
          title: left === 0 ? `A ${name} le vence la cuota hoy` : `A ${name} le vence la cuota en ${days(left)}`,
          detail: `${capitalize(status.concept)} · ${formatMoney(owed)} · vence el ${dm(status.dueOn)}`,
          date: addDays(status.dueOn, -prefs.dueSoonDays),
          href: pagosHref(client.id),
        });
      }
    }

    // Venció y no pagó: a los N días y, si eligió repetir, cada M días (cada repetición es un aviso nuevo).
    if (prefs.overdueEnabled && status.state === "vencido" && status.daysLate >= prefs.overdueAfterDays) {
      const since = addDays(today, -status.daysLate);
      const round = prefs.overdueRepeatDays ? Math.floor((status.daysLate - prefs.overdueAfterDays) / prefs.overdueRepeatDays) : 0;
      alerts.push({
        key: `vencido:${client.id}:${since}:${round}`,
        kind: "vencido",
        clientId: client.id,
        title: round > 0 ? `${name} sigue sin pagar` : `${name} no pagó`,
        detail: `${capitalize(status.concept)} · ${formatMoney(status.amountDueCents)} · ${status.detail}`,
        date: addDays(since, prefs.overdueAfterDays + round * (prefs.overdueRepeatDays ?? 0)),
        href: pagosHref(client.id),
      });
    }

    // Pack que se termina: un aviso por cada sesión que baja desde el umbral (2 → 1 → 0).
    if (prefs.packLowEnabled && plan.kind === "pack" && status.sessionsLeft !== null && status.sessionsLeft >= 0 && status.sessionsLeft <= prefs.packLowSessions) {
      const left = status.sessionsLeft;
      const bought = row.payments.reduce((s, p) => s + (p.sessions ?? 0), 0);
      alerts.push({
        key: `pack:${client.id}:${bought}:${left}`,
        kind: "pack",
        clientId: client.id,
        title: left === 0 ? `${name} terminó su pack` : `A ${name} le ${left === 1 ? "queda 1 sesión" : `quedan ${left} sesiones`} del pack`,
        detail: left === 0 ? `Hay que renovar ${status.concept} · ${formatMoney(plan.amountCents)}` : `${capitalize(status.concept)} · ${formatMoney(plan.amountCents)}`,
        date: today,
        href: pagosHref(client.id),
      });
    }
  }

  // Pedidos de reprogramación (de sus pacientes o de turnos que atiende él).
  if (prefs.rescheduleEnabled) {
    const names = new Map(rows.map((r) => [r.client.id, r.client]));
    for (const a of input.appointments) {
      if (a.status !== "reprogramacion_pedida") continue;
      const client = names.get(a.clientId);
      if (!client || (!everyone && client.coachId !== me.id && a.coachId !== me.id)) continue;
      const day = baDate(a.startsAt);
      alerts.push({
        key: `reprogramacion:${a.id}:${a.rescheduleRequestedAt ?? ""}`,
        kind: "reprogramacion",
        clientId: client.id,
        title: `${firstName(client.fullName)} pidió cambiar un turno`,
        detail: `${dm(day)} ${baTime(a.startsAt)}${a.rescheduleReason ? ` · «${a.rescheduleReason}»` : ""}`,
        date: a.rescheduleRequestedAt ? baDate(a.rescheduleRequestedAt) : today,
        href: `/coach/agenda?fecha=${day}`,
      });
    }
  }

  // Reservas online por confirmar (F12).
  if (prefs.bookingEnabled) {
    const names = new Map(rows.map((r) => [r.client.id, r.client]));
    for (const a of input.appointments) {
      if (a.status !== "pendiente") continue;
      const client = names.get(a.clientId);
      if (!client || (!everyone && client.coachId !== me.id && a.coachId !== me.id)) continue;
      const day = baDate(a.startsAt);
      alerts.push({
        key: `reserva:${a.id}`,
        kind: "reserva",
        clientId: client.id,
        title: `${firstName(client.fullName)} reservó un turno`,
        detail: `${shortDay(day)} ${baTime(a.startsAt)} · ${APPOINTMENT_TYPE_LABEL[a.type]} · por confirmar`,
        date: baDate(a.createdAt || a.startsAt),
        href: `/coach/agenda?fecha=${day}`,
      });
    }
  }

  return alerts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "es"));
}

function capitalize(s: string) {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** «hoy», «ayer», «hace 3 días». */
export function since(date: string, today: string): string {
  const n = diffDays(date, today);
  if (n <= 0) return "hoy";
  if (n === 1) return "ayer";
  return `hace ${n} días`;
}
