"use client";

import { useMemo } from "react";
import { baToday } from "@/lib/agenda/time";
import { buildBillingRows, type BillingRow } from "@/lib/billing/rows";
import { data, type AppSettings } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

export type { BillingRow };

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

  const rows = useMemo((): BillingRow[] => (q.data ? buildBillingRows(q.data, today, opts.clientId) : []), [q.data, opts.clientId, today]);

  return { ...q, rows, today, settings: q.data?.settings as AppSettings | undefined };
}
