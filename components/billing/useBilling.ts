"use client";

import { useMemo } from "react";
import { baDate, baToday } from "@/lib/agenda/time";
import { billingStatus, STATE_ORDER, type BillingStatus } from "@/lib/billing/status";
import { data, type AppSettings, type ClientPlan, type Payment, type Profile } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

export type BillingRow = { client: Profile; plan: ClientPlan | null; payments: Payment[]; status: BillingStatus };

/**
 * Todo lo que necesitan Pagos, el Panel y la ficha: planes, pagos, asistencias (para packs y por sesión),
 * ajustes y el estado calculado por paciente. La capa de datos ya filtra por profe (o todo, si es admin).
 */
export function useBilling(opts: { clientId?: string } = {}) {
  const today = baToday();
  const q = useQuery(async () => {
    const [clients, plans, payments, settings, staff] = await Promise.all([
      data.profiles.listClients(),
      data.billing.listPlans(),
      data.billing.listPayments(opts.clientId ? { clientId: opts.clientId } : {}),
      data.settings.get(),
      data.profiles.listStaff(),
    ]);
    const from = plans.map((p) => p.startsOn).sort()[0];
    const appointments = from ? await data.appointments.list({ from, ...(opts.clientId ? { clientId: opts.clientId } : {}) }) : [];
    return { clients, plans, payments, settings, staff, appointments };
  }, [opts.clientId]);

  const rows = useMemo((): BillingRow[] => {
    if (!q.data) return [];
    const { clients, plans, payments, appointments } = q.data;
    const attended = new Map<string, string[]>();
    for (const a of appointments) if (a.status === "asistio") attended.set(a.clientId, [...(attended.get(a.clientId) ?? []), baDate(a.startsAt)]);
    return clients
      .filter((c) => !c.disabledAt && (!opts.clientId || c.id === opts.clientId))
      .map((client) => {
        const plan = plans.find((p) => p.clientId === client.id) ?? null;
        const mine = payments.filter((p) => p.clientId === client.id);
        return { client, plan, payments: mine, status: billingStatus(plan, mine, attended.get(client.id) ?? [], today) };
      })
      .sort((a, b) => STATE_ORDER[a.status.state] - STATE_ORDER[b.status.state] || b.status.daysLate - a.status.daysLate || a.client.fullName.localeCompare(b.client.fullName, "es"));
  }, [q.data, opts.clientId, today]);

  return { ...q, rows, today, settings: q.data?.settings as AppSettings | undefined };
}
