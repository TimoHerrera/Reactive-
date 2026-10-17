// Fila de cobro por paciente (plan + pagos + estado). La usan Pagos, el Panel, los avisos y el mail diario.
import { baDate } from "@/lib/agenda/time";
import type { Appointment, ClientPlan, Payment, Profile } from "@/lib/data/types";
import { billingStatus, STATE_ORDER, type BillingStatus } from "./status";

export type BillingRow = { client: Profile; plan: ClientPlan | null; payments: Payment[]; status: BillingStatus };

/** Pacientes activos con su estado, lo urgente arriba. `appointments`: para contar los «asistió» (packs y por sesión). */
export function buildBillingRows(
  input: { clients: Profile[]; plans: ClientPlan[]; payments: Payment[]; appointments: Appointment[] },
  today: string,
  clientId?: string,
): BillingRow[] {
  const attended = new Map<string, string[]>();
  for (const a of input.appointments) if (a.status === "asistio") attended.set(a.clientId, [...(attended.get(a.clientId) ?? []), baDate(a.startsAt)]);
  return input.clients
    .filter((c) => c.role === "client" && !c.disabledAt && (!clientId || c.id === clientId))
    .map((client) => {
      const plan = input.plans.find((p) => p.clientId === client.id) ?? null;
      const mine = input.payments.filter((p) => p.clientId === client.id);
      return { client, plan, payments: mine, status: billingStatus(plan, mine, attended.get(client.id) ?? [], today) };
    })
    .sort((a, b) => STATE_ORDER[a.status.state] - STATE_ORDER[b.status.state] || b.status.daysLate - a.status.daysLate || a.client.fullName.localeCompare(b.client.fullName, "es"));
}
