// Validación de planes y pagos (la usan el mock, la UI y, en espejo, los checks de 0011_pagos.sql).
import type { PaymentInput, PlanInput } from "@/lib/data/repositories";

const isDate = (s: string | null | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function validatePlan(p: PlanInput): string | null {
  if (!Number.isInteger(p.amountCents) || p.amountCents <= 0) return "Poné un monto mayor a $ 0.";
  if (p.kind === "mensual" && !(p.dueDay && p.dueDay >= 1 && p.dueDay <= 31)) return "El día de vencimiento va del 1 al 31.";
  if (p.kind === "pack" && !(p.packSessions && p.packSessions >= 1 && p.packSessions <= 100)) return "El pack tiene que tener entre 1 y 100 sesiones.";
  if (!isDate(p.startsOn)) return "Revisá la fecha de inicio.";
  return null;
}

export function validatePayment(p: PaymentInput): string | null {
  if (!p.clientId) return "Falta el paciente.";
  if (!Number.isInteger(p.amountCents) || p.amountCents <= 0) return "Poné un monto mayor a $ 0.";
  if (!isDate(p.paidAt)) return "Revisá la fecha del pago.";
  if (p.period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.period)) return "Revisá el mes que cubre.";
  if (p.sessions != null && !(Number.isInteger(p.sessions) && p.sessions >= 1 && p.sessions <= 100)) return "Las sesiones van de 1 a 100.";
  if (p.note && p.note.length > 300) return "La nota es muy larga (máximo 300).";
  return null;
}
