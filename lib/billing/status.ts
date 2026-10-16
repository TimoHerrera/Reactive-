// Estado de cobro de cada paciente, montos y mensajes de recordatorio. Funciones puras.
// Montos en centavos (entero). Fechas «YYYY-MM-DD» de Buenos Aires.
import { diffDays, parseISODate } from "@/lib/dates";
import type { ClientPlan, Payment, Period } from "@/lib/data/types";

export type BillingState = "al_dia" | "por_vencer" | "vencido" | "renovar" | "sin_plan";

export const BILLING_STATE_LABEL: Record<BillingState, string> = {
  al_dia: "Al día",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  renovar: "Renovar pack",
  sin_plan: "Sin plan",
};

/** «Por vencer» = vence en 5 días o menos. */
export const DUE_SOON_DAYS = 5;

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// ── Montos ────────────────────────────────────────────────────────

/** 2500000 → «$ 25.000»; con centavos: «$ 25.000,50». */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const pesos = Math.floor(abs / 100).toLocaleString("es-AR");
  const rest = abs % 100;
  return `${sign}$ ${pesos}${rest ? `,${String(rest).padStart(2, "0")}` : ""}`;
}

/** «25.000», «25000», «$ 25.000,50», «25000.5» → centavos. Inválido → null. */
export function parseMoney(text: string): number | null {
  let t = text.replace(/[$\s]/g, "");
  if (!t) return null;
  // Con coma decimal (formato argentino): los puntos son miles.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  // Sin coma: un punto seguido de exactamente 3 dígitos es separador de miles.
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

// ── Períodos ──────────────────────────────────────────────────────

export const periodOf = (iso: string): Period => iso.slice(0, 7);

export function addMonths(period: Period, n: number): Period {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y!, m! - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** «2026-10» → «octubre» */
export const monthName = (period: Period) => MONTHS[Number(period.slice(5, 7)) - 1] ?? period;
/** «2026-10» → «octubre 2026» */
export const formatPeriod = (period: Period) => `${monthName(period)} ${period.slice(0, 4)}`;

/** Vencimiento del mes: el día pedido o, si el mes es más corto, el último día. */
export function dueDateFor(period: Period, dueDay: number): string {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(y!, m!, 0).getDate();
  return `${period}-${String(Math.min(Math.max(1, dueDay), last)).padStart(2, "0")}`;
}

/** «10/10» */
export function dm(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ── Estado ────────────────────────────────────────────────────────

export type BillingStatus = {
  state: BillingState;
  /** Texto corto para la lista: «vence el 10/11», «vencido hace 6 días», «quedan 3 sesiones». */
  detail: string;
  /** Lo que hay que cobrar ahora (0 si está al día). */
  amountDueCents: number;
  daysLate: number;
  /** Próximo vencimiento o el vencimiento atrasado más viejo (mensual). */
  dueOn: string | null;
  /** Mensual: meses impagos y vencidos (más viejo primero). */
  overduePeriods: Period[];
  /** Mensual: el mes a cobrar (el más viejo impago, o el actual / siguiente). */
  periodToCharge: Period | null;
  /** Pack: sesiones restantes (puede ser negativo si usó de más). */
  sessionsLeft: number | null;
  /** Por sesión: sesiones asistidas sin pagar. */
  sessionsOwed: number | null;
  /** «la cuota de octubre», «el pack de 8 sesiones», «2 sesiones». */
  concept: string;
};

const paidFor = (payments: Payment[], period: Period) => payments.filter((p) => p.period === period).reduce((s, p) => s + p.amountCents, 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** «agosto», «agosto y septiembre», «agosto, septiembre y octubre» */
const listOf = (items: string[]) => (items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`);

/**
 * Estado automático de un paciente.
 * - Mensual: «Vencido» si hay algún mes ya vencido sin pagar completo (con días de atraso desde el más viejo);
 *   «Por vencer» si el próximo vencimiento impago es en 5 días o menos; si no, «Al día».
 * - Pack: sesiones compradas (pagos con `sessions`) − turnos con «asistió» desde el inicio del plan.
 *   Quedan 0 → «Renovar pack»; queda 1 → «Por vencer»; menos de 0 → «Vencido» (usó sesiones sin pagar).
 * - Por sesión: asistidas − pagadas; si debe alguna, «Vencido» desde la primera sin pagar.
 * `attended`: fechas de los turnos con «asistió».
 */
export function billingStatus(
  plan: ClientPlan | null | undefined,
  payments: Payment[],
  attended: string[],
  today: string,
): BillingStatus {
  const base = { amountDueCents: 0, daysLate: 0, dueOn: null, overduePeriods: [], periodToCharge: null, sessionsLeft: null, sessionsOwed: null };
  if (!plan || !plan.active) return { ...base, state: "sin_plan", detail: plan ? "Plan pausado" : "Sin plan de cobro", concept: "" };
  const mine = payments.filter((p) => p.clientId === plan.clientId);
  const used = attended.filter((d) => d >= plan.startsOn).sort();

  if (plan.kind === "mensual") {
    const dueDay = plan.dueDay ?? 10;
    const first = periodOf(plan.startsOn);
    const current = periodOf(today);
    const overdue: Period[] = [];
    for (let p = first; p <= current; p = addMonths(p, 1)) {
      if (dueDateFor(p, dueDay) < today && paidFor(mine, p) < plan.amountCents) overdue.push(p);
    }
    if (overdue.length) {
      const dueOn = dueDateFor(overdue[0]!, dueDay);
      const daysLate = diffDays(dueOn, today);
      const owed = overdue.reduce((s, p) => s + plan.amountCents - paidFor(mine, p), 0);
      return {
        ...base,
        state: "vencido",
        detail: `vencido hace ${plural(daysLate, "día", "días")}${overdue.length > 1 ? ` · debe ${overdue.length} meses` : ""}`,
        amountDueCents: owed,
        daysLate,
        dueOn,
        overduePeriods: overdue,
        periodToCharge: overdue[0]!,
        concept: overdue.length > 1 ? `las cuotas de ${listOf(overdue.map(monthName))}` : `la cuota de ${monthName(overdue[0]!)}`,
      };
    }
    // Próximo mes impago (el actual si todavía no venció, si no el siguiente).
    let next = current < first ? first : current;
    while (paidFor(mine, next) >= plan.amountCents || dueDateFor(next, dueDay) < today) next = addMonths(next, 1);
    const dueOn = dueDateFor(next, dueDay);
    const soon = diffDays(today, dueOn) <= DUE_SOON_DAYS;
    return {
      ...base,
      state: soon ? "por_vencer" : "al_dia",
      detail: `vence el ${dm(dueOn)}`,
      amountDueCents: soon ? plan.amountCents - paidFor(mine, next) : 0,
      dueOn,
      periodToCharge: next,
      concept: `la cuota de ${monthName(next)}`,
    };
  }

  if (plan.kind === "pack") {
    const bought = mine.reduce((s, p) => s + (p.sessions ?? 0), 0);
    const left = bought - used.length;
    const pack = `el pack de ${plural(plan.packSessions ?? 0, "sesión", "sesiones")}`;
    if (left < 0) {
      const firstUnpaid = used[bought] ?? today;
      return {
        ...base,
        state: "vencido",
        detail: `usó ${plural(-left, "sesión", "sesiones")} sin pagar`,
        amountDueCents: plan.amountCents,
        daysLate: Math.max(0, diffDays(firstUnpaid, today)),
        sessionsLeft: left,
        concept: pack,
      };
    }
    if (left === 0) return { ...base, state: "renovar", detail: "quedan 0 sesiones", amountDueCents: plan.amountCents, sessionsLeft: 0, concept: pack };
    return {
      ...base,
      state: left === 1 ? "por_vencer" : "al_dia",
      detail: `${left === 1 ? "queda" : "quedan"} ${plural(left, "sesión", "sesiones")}`,
      sessionsLeft: left,
      concept: pack,
    };
  }

  // Por sesión
  const paidSessions = mine.reduce((s, p) => s + (p.sessions ?? Math.floor(p.amountCents / Math.max(1, plan.amountCents))), 0);
  const owed = used.length - paidSessions;
  if (owed > 0) {
    const firstUnpaid = used[paidSessions]!;
    const daysLate = Math.max(0, diffDays(firstUnpaid, today));
    return {
      ...base,
      state: "vencido",
      detail: `debe ${plural(owed, "sesión", "sesiones")}`,
      amountDueCents: owed * plan.amountCents,
      daysLate,
      dueOn: firstUnpaid,
      sessionsOwed: owed,
      concept: plural(owed, "sesión", "sesiones"),
    };
  }
  return { ...base, state: "al_dia", detail: "sin sesiones pendientes", sessionsOwed: 0, concept: "la sesión" };
}

/** Prioridad para ordenar la lista (lo urgente arriba). */
export const STATE_ORDER: Record<BillingState, number> = { vencido: 0, renovar: 1, por_vencer: 2, al_dia: 3, sin_plan: 4 };

/** Precarga de «+ Registrar pago» según el plan y el estado. */
export function suggestedPayment(plan: ClientPlan, status: BillingStatus): { amountCents: number; period: Period | null; sessions: number | null } {
  if (plan.kind === "mensual") {
    const period = status.periodToCharge;
    return { amountCents: plan.amountCents, period, sessions: null };
  }
  if (plan.kind === "pack") return { amountCents: plan.amountCents, period: null, sessions: plan.packSessions ?? 1 };
  const n = Math.max(1, status.sessionsOwed ?? 1);
  return { amountCents: plan.amountCents * n, period: null, sessions: n };
}

// ── Recordatorio por WhatsApp ─────────────────────────────────────

export const DEFAULT_PAYMENT_TEMPLATE = "Hola {nombre}, te recordamos que {concepto} ({monto}) {vence}. Podés transferir al alias {alias}. ¡Gracias!";

/** Mensaje de cobro: {nombre}, {concepto}, {monto}, {vence}, {alias}. */
export function paymentReminderText(
  status: BillingStatus,
  plan: ClientPlan,
  opts: { clientName: string; alias: string; template?: string; today: string },
): string {
  const amount = formatMoney(status.amountDueCents || plan.amountCents);
  let when: string;
  if (status.state === "renovar") when = "se terminó y hay que renovarlo";
  else if (plan.kind === "pack") when = status.state === "vencido" ? "está pendiente de pago" : `está por terminarse (${status.detail})`;
  else if (status.dueOn) when = status.dueOn < opts.today ? `venció el ${dm(status.dueOn)}` : `vence el ${dm(status.dueOn)}`;
  else when = "está pendiente de pago";
  const values: Record<string, string> = {
    nombre: opts.clientName.split(" ")[0]!,
    concepto: status.concept,
    monto: amount,
    vence: when,
    alias: opts.alias || "(pedinos el alias)",
  };
  return (opts.template || DEFAULT_PAYMENT_TEMPLATE).replace(/\{(nombre|concepto|monto|vence|alias)\}/g, (_, k: string) => values[k]!);
}

// ── Resumen del mes y exportación ─────────────────────────────────

export type MonthSummary = {
  cobradoCents: number;
  pendienteCents: number;
  vencidoCents: number;
  porProfe: { coachId: string; cobradoCents: number; pagos: number }[];
};

/** Admin: cobrado en el mes (por fecha de pago), pendiente (por vencer / renovar) y vencido, y total por profe. */
export function monthSummary(
  month: Period,
  payments: Payment[],
  statuses: { clientId: string; status: BillingStatus }[],
  coachOf: (clientId: string) => string | null,
): MonthSummary {
  const inMonth = payments.filter((p) => periodOf(p.paidAt) === month);
  const porProfe = new Map<string, { coachId: string; cobradoCents: number; pagos: number }>();
  for (const p of inMonth) {
    const coachId = coachOf(p.clientId) ?? "—";
    const row = porProfe.get(coachId) ?? { coachId, cobradoCents: 0, pagos: 0 };
    row.cobradoCents += p.amountCents;
    row.pagos += 1;
    porProfe.set(coachId, row);
  }
  const sum = (states: string[]) => statuses.filter((s) => states.includes(s.status.state)).reduce((t, s) => t + s.status.amountDueCents, 0);
  return {
    cobradoCents: inMonth.reduce((s, p) => s + p.amountCents, 0),
    pendienteCents: sum(["por_vencer", "renovar"]),
    vencidoCents: sum(["vencido"]),
    porProfe: [...porProfe.values()].sort((a, b) => b.cobradoCents - a.cobradoCents),
  };
}

/** Filas para exportar a Excel/CSV. */
export function paymentRows(payments: Payment[], names: { client: (id: string) => string; coach: (clientId: string) => string; registeredBy: (id: string | null) => string }) {
  return [...payments]
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .map((p) => ({
      Fecha: p.paidAt,
      Paciente: names.client(p.clientId),
      Profe: names.coach(p.clientId),
      Concepto: p.period ? `Cuota ${formatPeriod(p.period)}` : p.sessions ? `${plural(p.sessions, "sesión", "sesiones")}` : "Pago",
      "Monto (ARS)": p.amountCents / 100,
      Medio: { efectivo: "Efectivo", transferencia: "Transferencia", mercadopago: "Mercado Pago", otro: "Otro" }[p.method],
      Nota: p.note ?? "",
      "Registrado por": names.registeredBy(p.registeredBy),
    }));
}

/** CSV con «;» (Excel en español lo abre bien) y BOM para los acentos. */
export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "﻿";
  const headers = Object.keys(rows[0]!);
  const cell = (v: string | number) => {
    const s = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers.join(";"), ...rows.map((r) => headers.map((h) => cell(r[h] ?? "")).join(";"))].join("\r\n");
}
