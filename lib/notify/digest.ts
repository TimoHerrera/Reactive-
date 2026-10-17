// Mail diario (F11): a quién mandarle qué. Puro: la ruta /api/cron/avisos solo lee, llama acá y envía.
import { buildBillingRows } from "@/lib/billing/rows";
import type { Appointment, ClientPlan, NotificationPrefs, Payment, Profile } from "@/lib/data/types";
import { isStaff } from "@/lib/data/types";
import { buildAlerts, type Alert } from "./alerts";

export type NotificationStateRow = { userId: string; key: string; seenAt: string | null; emailedAt: string | null };

/**
 * Para cada profe con «También por mail»: los avisos de hoy que todavía no vio en la app ni le llegaron por mail.
 * Cada profe recibe solo lo de sus pacientes (admin: todo el centro si así lo eligió).
 */
export function planDigests(input: {
  profiles: Profile[];
  plans: ClientPlan[];
  payments: Payment[];
  appointments: Appointment[];
  prefs: Map<string, NotificationPrefs>;
  state: NotificationStateRow[];
  today: string;
}): { user: Profile; alerts: Alert[] }[] {
  const rows = buildBillingRows({ clients: input.profiles, plans: input.plans, payments: input.payments, appointments: input.appointments }, input.today);
  const done = new Set(input.state.filter((s) => s.seenAt || s.emailedAt).map((s) => `${s.userId}|${s.key}`));
  const out: { user: Profile; alerts: Alert[] }[] = [];
  for (const user of input.profiles) {
    const prefs = input.prefs.get(user.id);
    if (!prefs?.emailEnabled || !isStaff(user.role) || user.disabledAt || !user.email) continue;
    const alerts = buildAlerts({ rows, appointments: input.appointments, prefs, me: { id: user.id, role: user.role }, today: input.today }).filter(
      (a) => !done.has(`${user.id}|${a.key}`),
    );
    if (alerts.length) out.push({ user, alerts });
  }
  return out;
}
