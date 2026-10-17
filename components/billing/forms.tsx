"use client";

import { useState } from "react";
import { Choice, Field, inputClass } from "@/components/agenda/parts";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { formatMoney, formatPeriod, parseMoney, suggestedPayment, type BillingState, type BillingStatus, BILLING_STATE_LABEL } from "@/lib/billing/status";
import { validatePayment, validatePlan } from "@/lib/billing/validate";
import { PAYMENT_METHOD_LABEL, PLAN_KIND_LABEL, data, type ClientPlan, type Payment, type PaymentMethod, type PlanKind, type Profile } from "@/lib/data";

const STATE_CLASS: Record<BillingState, string> = {
  al_dia: "bg-success/20 text-success",
  por_vencer: "bg-warning/20 text-warning",
  vencido: "bg-danger/20 text-danger-ink",
  renovar: "bg-warning/20 text-warning",
  sin_plan: "bg-surface-2 text-muted",
};

export function BillingPill({ state, className }: { state: BillingState; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption font-bold", STATE_CLASS[state], className)}>{BILLING_STATE_LABEL[state]}</span>;
}

/** «35.000» para el input (sin «$»). */
const moneyInput = (cents: number) => formatMoney(cents).replace("$ ", "");
const METHODS = Object.entries(PAYMENT_METHOD_LABEL) as [PaymentMethod, string][];
const KINDS = Object.entries(PLAN_KIND_LABEL) as [PlanKind, string][];

/** «+ Registrar pago»: precarga el monto del plan y el mes (o las sesiones) a cobrar. */
export function PaymentForm({ client, plan, status, today, onClose, onSaved }: {
  client: Profile;
  plan: ClientPlan | null;
  status: BillingStatus;
  today: string;
  onClose: () => void;
  onSaved: (p: Payment) => void;
}) {
  const s = plan ? suggestedPayment(plan, status) : { amountCents: 0, period: null, sessions: null };
  const [amount, setAmount] = useState(s.amountCents ? moneyInput(s.amountCents) : "");
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [period, setPeriod] = useState(s.period ?? (plan?.kind === "mensual" ? today.slice(0, 7) : ""));
  const [sessions, setSessions] = useState(s.sessions ? String(s.sessions) : "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const input = {
      clientId: client.id,
      amountCents: parseMoney(amount) ?? 0,
      paidAt,
      method,
      period: plan?.kind === "mensual" || (!plan && period) ? period || null : null,
      sessions: plan && plan.kind !== "mensual" && sessions ? Number(sessions) : null,
      note: note || null,
    };
    const problem = validatePayment(input);
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      onSaved(await data.billing.addPayment(input));
    } catch (e) {
      setError((e as Error).message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Registrar pago" subtitle={client.fullName} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Monto ($)">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="25.000" className={inputClass} data-autofocus />
          </Field>
          <Field label="Fecha">
            <input type="date" value={paidAt} max={today} onChange={(e) => setPaidAt(e.target.value)} className={inputClass} />
          </Field>
        </div>
        {(!plan || plan.kind === "mensual") && (
          <Field label="Mes que cubre">
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={inputClass} />
          </Field>
        )}
        {plan && plan.kind !== "mensual" && (
          <Field label={plan.kind === "pack" ? "Sesiones del pack" : "Sesiones que paga"}>
            <input type="number" min={1} max={100} value={sessions} onChange={(e) => setSessions(e.target.value)} className={inputClass} />
          </Field>
        )}
        <div>
          <p className="label mb-2 text-[0.6875rem]">Medio</p>
          <Choice label="Medio de pago" options={METHODS} value={method} onChange={setMethod} />
        </div>
        <Field label="Nota (opcional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ej.: pagó en recepción" className={inputClass} />
        </Field>
        {plan?.kind === "mensual" && period && <p className="text-small text-muted">Cubre {formatPeriod(period)}.</p>}
        {error && (
          <p role="alert" className="text-small font-medium text-danger-ink">
            ✕ {error}
          </p>
        )}
        <button type="button" onClick={() => void save()} disabled={saving} className="h-12 w-full rounded-full bg-accent font-bold text-ink disabled:opacity-50">
          {saving ? "Guardando…" : "Registrar pago"}
        </button>
      </div>
    </Sheet>
  );
}

/** Plan de cobro del paciente: mensual / por sesión / pack. */
export function PlanForm({ client, plan, today, onClose, onSaved }: {
  client: Profile;
  plan: ClientPlan | null;
  today: string;
  onClose: () => void;
  onSaved: (p: ClientPlan) => void;
}) {
  const [kind, setKind] = useState<PlanKind>(plan?.kind ?? "mensual");
  const [amount, setAmount] = useState(plan ? moneyInput(plan.amountCents) : "");
  const [dueDay, setDueDay] = useState(String(plan?.dueDay ?? 10));
  const [packSessions, setPackSessions] = useState(String(plan?.packSessions ?? 8));
  const [startsOn, setStartsOn] = useState(plan?.startsOn ?? today);
  const [active, setActive] = useState(plan?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const input = {
      kind,
      amountCents: parseMoney(amount) ?? 0,
      dueDay: kind === "mensual" ? Number(dueDay) : null,
      packSessions: kind === "pack" ? Number(packSessions) : null,
      startsOn,
      active,
    };
    const problem = validatePlan(input);
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      onSaved(await data.billing.setPlan(client.id, input));
    } catch (e) {
      setError((e as Error).message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={plan ? "Editar plan" : "Plan de cobro"} subtitle={client.fullName} onClose={onClose}>
      <div className="space-y-4">
        <Choice label="Tipo de plan" options={KINDS} value={kind} onChange={setKind} />
        <Field label={kind === "mensual" ? "Cuota mensual ($)" : kind === "pack" ? "Precio del pack ($)" : "Valor de la sesión ($)"}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="25.000" className={inputClass} />
        </Field>
        {kind === "mensual" && (
          <Field label="Vence el día">
            <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputClass} />
          </Field>
        )}
        {kind === "pack" && (
          <Field label="Sesiones del pack">
            <input type="number" min={1} max={100} value={packSessions} onChange={(e) => setPackSessions(e.target.value)} className={inputClass} />
          </Field>
        )}
        <Field label="Desde">
          <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={inputClass} />
        </Field>
        <label className="flex min-h-[44px] items-center justify-between gap-3">
          <span className="font-semibold">Plan activo</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-6 w-6 accent-[#2457E6]" />
        </label>
        {kind === "pack" && <p className="text-small text-muted">Cada turno marcado «Asistió» descuenta una sesión del pack.</p>}
        {error && (
          <p role="alert" className="text-small font-medium text-danger-ink">
            ✕ {error}
          </p>
        )}
        <button type="button" onClick={() => void save()} disabled={saving} className="h-12 w-full rounded-full bg-accent font-bold text-ink disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar plan"}
        </button>
      </div>
    </Sheet>
  );
}
