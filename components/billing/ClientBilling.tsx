"use client";

import { useState } from "react";
import { WhatsAppButton, WhatsAppSheet } from "@/components/agenda/parts";
import { InlineLoading } from "@/components/Loading";
import { QueryError } from "@/components/QueryError";
import { dm, formatMoney, formatPeriod, paymentReminderText } from "@/lib/billing/status";
import { PAYMENT_METHOD_LABEL, PLAN_KIND_LABEL, data, type Profile } from "@/lib/data";
import { BillingPill, PaymentForm, PlanForm } from "./forms";
import { useBilling } from "./useBilling";

/** Pestaña «Pagos» de la ficha: plan, estado, historial y «+ Registrar pago». */
export function ClientBilling({ client }: { client: Profile }) {
  const b = useBilling({ clientId: client.id });
  const [form, setForm] = useState<"pago" | "plan" | "wa" | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  if (b.error && !b.data) return <QueryError what="los pagos" onRetry={() => void b.reload()} />;
  const row = b.rows[0];
  if (!b.data || !row) return <InlineLoading />;
  const { plan, status, payments } = row;
  const staffName = (id: string | null) => b.data!.staff.find((s) => s.id === id)?.fullName ?? "—";

  const remove = async (id: string) => {
    if (!window.confirm("¿Borrar este pago? (por ejemplo, si lo cargaste por error)")) return;
    setRemoving(id);
    try {
      await data.billing.removePayment(id);
      await b.reload();
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <section aria-labelledby="plan" className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="plan" className="label">
            Plan
          </h2>
          <BillingPill state={status.state} />
        </div>
        {plan ? (
          <>
            <p className="mt-2 text-title-sm">
              {PLAN_KIND_LABEL[plan.kind]} · {formatMoney(plan.amountCents)}
              {plan.kind === "mensual" ? ` · vence el ${plan.dueDay}` : plan.kind === "pack" ? ` · ${plan.packSessions} sesiones` : " por sesión"}
            </p>
            <p className="mt-1 text-small text-muted">Desde el {dm(plan.startsOn)}{plan.active ? "" : " · pausado"}</p>
            <p className={status.state === "vencido" ? "mt-2 font-semibold text-danger-ink" : "mt-2 text-title"}>
              {status.detail}
              {status.amountDueCents > 0 ? ` · ${formatMoney(status.amountDueCents)}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-2 text-small text-muted">Todavía no tiene un plan de cobro.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {plan && (
            <button type="button" onClick={() => setForm("pago")} className="min-h-[44px] rounded-full bg-accent px-5 text-small font-bold text-ink">
              + Registrar pago
            </button>
          )}
          <button type="button" onClick={() => setForm("plan")} className="min-h-[44px] rounded-full border border-line px-4 text-small font-bold hover:bg-surface-2">
            {plan ? "Editar plan" : "Definir plan"}
          </button>
          {plan && ["vencido", "por_vencer", "renovar"].includes(status.state) && <WhatsAppButton label="Recordar pago" onClick={() => setForm("wa")} />}
        </div>
      </section>

      <section aria-labelledby="historial-pagos" className="rounded-lg border border-line bg-surface px-4 py-3">
        <h2 id="historial-pagos" className="label">
          Historial de pagos
        </h2>
        {payments.length === 0 ? (
          <p className="mt-2 text-small text-muted">Sin pagos registrados.</p>
        ) : (
          <ul className="mt-1">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold tabular-nums">{formatMoney(p.amountCents)}</span>
                  <span className="block text-small text-muted">
                    {dm(p.paidAt)} · {PAYMENT_METHOD_LABEL[p.method]}
                    {p.period ? ` · ${formatPeriod(p.period)}` : p.sessions ? ` · ${p.sessions} ${p.sessions === 1 ? "sesión" : "sesiones"}` : ""}
                    {` · cargó ${staffName(p.registeredBy)}`}
                  </span>
                  {p.note && <span className="block text-small text-title">{p.note}</span>}
                </span>
                <button
                  type="button"
                  aria-label={`Borrar pago del ${dm(p.paidAt)}`}
                  disabled={removing === p.id}
                  onClick={() => void remove(p.id)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-danger-ink"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {form === "pago" && (
        <PaymentForm client={client} plan={plan} status={status} today={b.today} onClose={() => setForm(null)} onSaved={() => (setForm(null), void b.reload())} />
      )}
      {form === "plan" && <PlanForm client={client} plan={plan} today={b.today} onClose={() => setForm(null)} onSaved={() => (setForm(null), void b.reload())} />}
      {form === "wa" && plan && b.settings && (
        <WhatsAppSheet
          title="Recordar pago"
          to={client.fullName}
          phone={client.phone}
          initialText={paymentReminderText(status, plan, { clientName: client.fullName, alias: b.settings.transferAlias, template: b.settings.paymentTemplate, today: b.today })}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
