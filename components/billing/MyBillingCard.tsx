"use client";

import { baDate, baToday } from "@/lib/agenda/time";
import { billingStatus, dm } from "@/lib/billing/status";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

/**
 * Perfil del paciente: «Tu cuota: al día» o «vence el 10/11», con el alias para transferir.
 * Solo si el admin lo activó en Ajustes (RLS: si no, el paciente no lee su plan ni sus pagos). Nunca muestra datos de otros.
 */
export function MyBillingCard({ clientId }: { clientId: string | null }) {
  const today = baToday();
  const q = useQuery(async () => {
    if (!clientId) return null;
    const settings = await data.settings.get();
    if (!settings.showBillingToClient) return null;
    const [plans, payments, appointments] = await Promise.all([
      data.billing.listPlans(),
      data.billing.listPayments({ clientId }),
      data.appointments.list({ clientId }),
    ]);
    const plan = plans.find((p) => p.clientId === clientId);
    if (!plan || !plan.active) return null;
    const attended = appointments.filter((a) => a.status === "asistio").map((a) => baDate(a.startsAt));
    return { status: billingStatus(plan, payments, attended, today), alias: settings.transferAlias, kind: plan.kind };
  }, [clientId, today]);

  if (!q.data) return null;
  const { status, alias, kind } = q.data;
  const text =
    status.state === "al_dia"
      ? kind === "mensual"
        ? `al día · la próxima vence el ${status.dueOn ? dm(status.dueOn) : "—"}`
        : `al día${status.sessionsLeft != null ? ` · ${status.detail}` : ""}`
      : status.state === "por_vencer"
        ? kind === "mensual" && status.dueOn
          ? `vence el ${dm(status.dueOn)}`
          : status.detail
        : status.state === "renovar"
          ? "tu pack se terminó: hay que renovarlo"
          : kind === "mensual" && status.dueOn
            ? `venció el ${dm(status.dueOn)}`
            : "tenés un pago pendiente";
  const tone = status.state === "al_dia" ? "text-success" : status.state === "vencido" ? "text-danger-ink" : "text-warning";

  return (
    <section aria-labelledby="mi-cuota" className="rounded-lg border border-line bg-surface p-4">
      <p id="mi-cuota" className="label">
        Tu cuota
      </p>
      <p className={`mt-2 text-title-sm ${tone}`}>{text.charAt(0).toUpperCase() + text.slice(1)}</p>
      {alias && status.state !== "al_dia" && (
        <p className="mt-2 text-small text-title">
          Podés transferir al alias <strong className="select-all text-ink">{alias}</strong>
        </p>
      )}
    </section>
  );
}
