"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { WhatsAppButton, WhatsAppSheet } from "@/components/agenda/parts";
import { BillingPill, PaymentForm } from "@/components/billing/forms";
import { useBilling, type BillingRow } from "@/components/billing/useBilling";
import { CoachFilterChips, useCoachFilter } from "@/components/coach/CoachFilter";
import { InlineLoading } from "@/components/Loading";
import { QueryError } from "@/components/QueryError";
import { FilterChip } from "@/components/ui";
import { IconArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  addMonths,
  BILLING_STATE_LABEL,
  formatMoney,
  formatPeriod,
  monthSummary,
  paymentReminderText,
  paymentRows,
  periodOf,
  toCsv,
  type BillingState,
} from "@/lib/billing/status";

const FILTERS: ("todos" | BillingState)[] = ["todos", "vencido", "por_vencer", "renovar", "al_dia", "sin_plan"];
const REMIND: BillingState[] = ["vencido", "por_vencer", "renovar"];

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pagos: estado de cobro de cada paciente (profe: los suyos; admin: todos, con filtro por profe). */
export function PagosView() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("estado");
  const estado = (FILTERS as string[]).includes(raw ?? "") ? (raw as (typeof FILTERS)[number]) : "todos";
  const filter = useCoachFilter();
  const b = useBilling();
  const [paying, setPaying] = useState<BillingRow | null>(null);
  const [wa, setWa] = useState<BillingRow | null>(null);
  const [month, setMonth] = useState(periodOf(b.today));

  const scoped = useMemo(() => b.rows.filter((r) => !filter.coachId || r.client.coachId === filter.coachId), [b.rows, filter.coachId]);
  const visible = estado === "todos" ? scoped : scoped.filter((r) => r.status.state === estado);
  const count = (s: BillingState) => scoped.filter((r) => r.status.state === s).length;
  const staffName = (id: string | null) => b.data?.staff.find((s) => s.id === id)?.fullName ?? "—";

  const summary = useMemo(() => {
    if (!b.data || !filter.isAdmin) return null;
    const clientIds = new Set(scoped.map((r) => r.client.id));
    const coachOf = (clientId: string) => b.data!.clients.find((c) => c.id === clientId)?.coachId ?? null;
    return monthSummary(
      month,
      b.data.payments.filter((p) => clientIds.has(p.clientId)),
      scoped.map((r) => ({ clientId: r.client.id, status: r.status })),
      coachOf,
    );
  }, [b.data, filter.isAdmin, scoped, month]);

  const exportRows = () => {
    const clientIds = new Set(scoped.map((r) => r.client.id));
    const clientName = (id: string) => b.data!.clients.find((c) => c.id === id)?.fullName ?? "";
    const coachName = (clientId: string) => staffName(b.data!.clients.find((c) => c.id === clientId)?.coachId ?? null);
    return paymentRows(
      b.data!.payments.filter((p) => clientIds.has(p.clientId) && periodOf(p.paidAt) === month),
      { client: clientName, coach: coachName, registeredBy: staffName },
    );
  };
  const exportCsv = () => download(`pagos-${month}.csv`, new Blob([toCsv(exportRows())], { type: "text/csv;charset=utf-8" }));
  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");
    XLSX.writeFile(wb, `pagos-${month}.xlsx`);
  };

  const setEstado = (e: string) => router.replace(e === "todos" ? "/coach/pagos" : `/coach/pagos?estado=${e}`, { scroll: false });

  return (
    <div className="pb-10">
      <header className="bg-grid px-gutter pb-5 pt-6">
        <Link href="/coach" className="-ml-1 inline-flex min-h-[44px] items-center gap-2 text-body text-title hover:text-ink">
          <IconArrowLeft className="h-5 w-5" /> Panel
        </Link>
        <h1 className="display mt-2 text-display-xl text-title">Pagos</h1>
        <p className="mt-1 text-body text-title">
          {count("vencido")} {count("vencido") === 1 ? "vencido" : "vencidos"} · {count("por_vencer")} por vencer{count("renovar") ? ` · ${count("renovar")} para renovar` : ""}
        </p>
      </header>

      <CoachFilterChips filter={filter} className="mb-3" />

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto px-gutter" role="group" aria-label="Filtrar por estado">
        {FILTERS.map((f) => (
          <FilterChip key={f} active={estado === f} onClick={() => setEstado(f)}>
            {f === "todos" ? `Todos (${scoped.length})` : `${BILLING_STATE_LABEL[f]} (${count(f)})`}
          </FilterChip>
        ))}
      </div>

      <div className="space-y-3 px-gutter">
        {b.error && !b.data && <QueryError what="los pagos" onRetry={() => void b.reload()} />}
        {!b.data && !b.error && <InlineLoading />}

        {summary && (
          <section aria-labelledby="resumen" className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="resumen" className="label">
                Resumen del mes
              </h2>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Mes anterior" onClick={() => setMonth(addMonths(month, -1))} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2">
                  ‹
                </button>
                <span className="min-w-[7.5rem] text-center text-small font-semibold capitalize">{formatPeriod(month)}</span>
                <button type="button" aria-label="Mes siguiente" onClick={() => setMonth(addMonths(month, 1))} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2">
                  ›
                </button>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Cobrado", summary.cobradoCents, "text-success"],
                ["Pendiente", summary.pendienteCents, "text-warning"],
                ["Vencido", summary.vencidoCents, "text-danger-ink"],
              ].map(([label, cents, cls]) => (
                <div key={label as string} className="rounded-md bg-surface-2 px-2 py-3">
                  <dt className="text-caption text-muted">{label}</dt>
                  <dd className={cn("mt-1 font-bold tabular-nums", cls as string)}>{formatMoney(cents as number)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-caption text-muted">Cobrado: pagos registrados en el mes. Pendiente y vencido: hoy.</p>
            {summary.porProfe.length > 0 && (
              <table className="mt-3 w-full text-small">
                <caption className="sr-only">Cobrado por profe</caption>
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 font-semibold">Profe</th>
                    <th className="py-1 text-right font-semibold">Pagos</th>
                    <th className="py-1 text-right font-semibold">Cobrado</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.porProfe.map((r) => (
                    <tr key={r.coachId} className="border-t border-line">
                      <td className="py-2">{staffName(r.coachId)}</td>
                      <td className="py-2 text-right tabular-nums">{r.pagos}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{formatMoney(r.cobradoCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void exportXlsx()} className="h-11 rounded-full border border-line text-small font-bold hover:bg-surface-2">
                Exportar Excel
              </button>
              <button type="button" onClick={exportCsv} className="h-11 rounded-full border border-line text-small font-bold hover:bg-surface-2">
                Exportar CSV
              </button>
            </div>
          </section>
        )}

        {b.data && visible.length === 0 && <p className="rounded-lg border-2 border-dashed border-line p-6 text-center text-small text-muted">No hay pacientes en este estado.</p>}

        {visible.length > 0 && (
          <ul className="space-y-2">
            {visible.map((r) => (
              <li key={r.client.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/coach/clientes/${r.client.id}?tab=pagos`} className="block truncate text-title-sm hover:underline">
                      {r.client.fullName}
                    </Link>
                    <p className="text-small text-muted">
                      {r.plan ? `${r.plan.kind === "mensual" ? "Mensual" : r.plan.kind === "pack" ? `Pack ${r.plan.packSessions}` : "Por sesión"} · ${formatMoney(r.plan.amountCents)}` : "Sin plan"}
                      {filter.isAdmin && !filter.coachId ? ` · ${staffName(r.client.coachId)}` : ""}
                    </p>
                  </div>
                  <BillingPill state={r.status.state} />
                </div>
                <p className={cn("mt-2 text-small", r.status.state === "vencido" ? "font-semibold text-danger-ink" : "text-title")}>
                  {r.status.detail}
                  {r.status.amountDueCents > 0 ? ` · ${formatMoney(r.status.amountDueCents)}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.plan ? (
                    <button type="button" onClick={() => setPaying(r)} className="min-h-[44px] rounded-full bg-ink px-4 text-small font-bold text-bg">
                      + Pago
                    </button>
                  ) : (
                    <Link href={`/coach/clientes/${r.client.id}?tab=pagos`} className="flex min-h-[44px] items-center rounded-full border border-line px-4 text-small font-bold">
                      Definir plan
                    </Link>
                  )}
                  {r.plan && REMIND.includes(r.status.state) && <WhatsAppButton onClick={() => setWa(r)} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {paying && (
        <PaymentForm
          client={paying.client}
          plan={paying.plan}
          status={paying.status}
          today={b.today}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            void b.reload();
          }}
        />
      )}
      {wa && wa.plan && b.settings && (
        <WhatsAppSheet
          title="Recordar pago"
          to={wa.client.fullName}
          phone={wa.client.phone}
          initialText={paymentReminderText(wa.status, wa.plan, {
            clientName: wa.client.fullName,
            alias: b.settings.transferAlias,
            template: b.settings.paymentTemplate,
            today: b.today,
          })}
          onClose={() => setWa(null)}
        />
      )}
    </div>
  );
}
