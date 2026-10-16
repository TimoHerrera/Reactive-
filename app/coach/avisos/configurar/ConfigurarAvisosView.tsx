"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Choice } from "@/components/agenda/parts";
import { InlineLoading } from "@/components/Loading";
import { useAlerts } from "@/components/notify/useAlerts";
import { useSession } from "@/components/SessionProvider";
import { IconArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { data, type NotificationPrefs } from "@/lib/data";
import { describeRule, LIMITS, validatePrefs } from "@/lib/notify/alerts";

/** − N + con límites. */
function Stepper({ value, onChange, range, label, disabled }: {
  value: number;
  onChange: (n: number) => void;
  range: readonly [number, number];
  label: string;
  disabled?: boolean;
}) {
  const [min, max] = range;
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const btn = "flex h-11 w-11 items-center justify-center rounded-full border border-line text-[1.25rem] font-bold hover:bg-surface-2 disabled:opacity-40";
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" aria-label={`Menos ${label}`} disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1))} className={btn}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => e.target.value !== "" && onChange(clamp(Number(e.target.value)))}
        className="h-11 w-16 rounded-md border border-line bg-bg text-center text-body font-bold tabular-nums text-ink outline-none focus:border-accent disabled:opacity-40 [color-scheme:dark]"
      />
      <button type="button" aria-label={`Más ${label}`} disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))} className={btn}>
        +
      </button>
    </span>
  );
}

/** Tarjeta de una regla: título + interruptor; el detalle se atenúa si está apagada. */
function Rule({ title, hint, enabled, onToggle, children }: {
  title: string;
  hint: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <label className="flex min-h-[44px] items-center justify-between gap-3">
        <span>
          <span className="block text-title-sm">{title}</span>
          <span className="block text-small text-muted">{hint}</span>
        </span>
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="h-6 w-6 shrink-0 accent-[#2457E6]" />
      </label>
      {children && <div className={cn("mt-3 space-y-3", !enabled && "pointer-events-none opacity-40")}>{children}</div>}
    </section>
  );
}

const unit = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** «Mis avisos»: cada profe elige qué avisos recibe y con cuántos días o sesiones. */
export function ConfigurarAvisosView() {
  const { user } = useSession();
  const a = useAlerts();
  const [form, setForm] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (a.prefs && !form) setForm(a.prefs);
  }, [a.prefs, form]);

  if (!form) return <InlineLoading />;
  const set = (patch: Partial<NotificationPrefs>) => (setForm({ ...form, ...patch }), setSaved(false), setError(null));
  const isAdmin = user?.role === "admin";
  const preview = a.compute(form).length;

  const save = async () => {
    const { updatedAt, ...input } = form;
    void updatedAt;
    const invalid = validatePrefs(input);
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(null);
    try {
      setForm(await data.notifications.savePrefs(input));
      setSaved(true);
      void a.reload();
    } catch (e) {
      setError((e as Error).message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-10">
      <header className="bg-grid px-gutter pb-5 pt-6">
        <Link href="/coach/avisos" className="-ml-1 inline-flex min-h-[44px] items-center gap-2 text-body text-title hover:text-ink">
          <IconArrowLeft className="h-5 w-5" /> Avisos
        </Link>
        <h1 className="display mt-2 text-display-xl text-title">Mis avisos</h1>
        <p className="mt-1 text-body text-title">Elegí qué querés que te avisemos y cuándo. Es solo para vos: cada profe arma los suyos.</p>
      </header>

      <div className="space-y-3 px-gutter">
        <Rule title="Cuota por vencer" hint="Planes mensuales." enabled={form.dueSoonEnabled} onToggle={(v) => set({ dueSoonEnabled: v })}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Avisame</span>
            <Stepper label="días antes" value={form.dueSoonDays} range={LIMITS.dueSoonDays} onChange={(n) => set({ dueSoonDays: n })} disabled={!form.dueSoonEnabled} />
            <span>{unit(form.dueSoonDays, "día", "días")} antes del vencimiento</span>
          </div>
        </Rule>

        <Rule title="Venció y no pagó" hint="Mensual, pack o por sesión." enabled={form.overdueEnabled} onToggle={(v) => set({ overdueEnabled: v })}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Avisame</span>
            <Stepper label="días después" value={form.overdueAfterDays} range={LIMITS.overdueAfterDays} onChange={(n) => set({ overdueAfterDays: n })} disabled={!form.overdueEnabled} />
            <span>{form.overdueAfterDays === 0 ? "días después (0 = el mismo día)" : `${unit(form.overdueAfterDays, "día", "días")} después de vencer`}</span>
          </div>
          <label className="flex min-h-[44px] items-center gap-3">
            <input
              type="checkbox"
              checked={form.overdueRepeatDays !== null}
              onChange={(e) => set({ overdueRepeatDays: e.target.checked ? 7 : null })}
              className="h-6 w-6 shrink-0 accent-[#2457E6]"
            />
            <span>Repetir mientras siga sin pagar</span>
          </label>
          {form.overdueRepeatDays !== null && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span>cada</span>
              <Stepper label="días entre avisos" value={form.overdueRepeatDays} range={LIMITS.overdueRepeatDays} onChange={(n) => set({ overdueRepeatDays: n })} disabled={!form.overdueEnabled} />
              <span>{unit(form.overdueRepeatDays, "día", "días")}</span>
            </div>
          )}
        </Rule>

        <Rule title="Pack por terminarse" hint="Planes por pack de sesiones." enabled={form.packLowEnabled} onToggle={(v) => set({ packLowEnabled: v })}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Avisame cuando queden</span>
            <Stepper label="sesiones" value={form.packLowSessions} range={LIMITS.packLowSessions} onChange={(n) => set({ packLowSessions: n })} disabled={!form.packLowEnabled} />
            <span>{unit(form.packLowSessions, "sesión", "sesiones")} o menos</span>
          </div>
        </Rule>

        <Rule title="Pedidos de reprogramación" hint="Cuando un paciente pide cambiar un turno." enabled={form.rescheduleEnabled} onToggle={(v) => set({ rescheduleEnabled: v })} />

        {isAdmin && (
          <section className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-title-sm">¿De quiénes?</h2>
            <p className="mb-3 text-small text-muted">Como admin podés recibir los avisos de todo el centro.</p>
            <Choice
              label="De quiénes"
              options={[
                ["all", "Todo el centro"],
                ["mine", "Solo mis pacientes"],
              ]}
              value={form.scope}
              onChange={(v) => set({ scope: v })}
            />
          </section>
        )}

        <Rule
          title="También por mail"
          hint={
            data.kind === "mock"
              ? "Un resumen por día con los avisos nuevos. En la demo no se mandan mails."
              : `Un resumen por día con los avisos nuevos, a ${user?.email ?? "tu mail"}.`
          }
          enabled={form.emailEnabled}
          onToggle={(v) => set({ emailEnabled: v })}
        />

        <div className="rounded-lg bg-surface-2 p-4 text-small" role="status">
          <p className="font-semibold">
            Con esta configuración, hoy {preview === 1 ? "tendrías 1 aviso" : `tendrías ${preview} avisos`}.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {form.dueSoonEnabled && <li>Cuota por vencer: {describeRule("vence", form)}.</li>}
            {form.overdueEnabled && <li>Sin pagar: {describeRule("vencido", form)}.</li>}
            {form.packLowEnabled && <li>Pack: {describeRule("pack", form)}.</li>}
            {form.rescheduleEnabled && <li>Reprogramaciones: {describeRule("reprogramacion", form)}.</li>}
            {!form.dueSoonEnabled && !form.overdueEnabled && !form.packLowEnabled && !form.rescheduleEnabled && <li>Todos los avisos están apagados.</li>}
          </ul>
        </div>

        {error && (
          <p role="alert" className="text-small font-medium text-danger-ink">
            ✕ {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-small font-medium text-success">
            Listo, guardado.
          </p>
        )}
        <button type="button" onClick={() => void save()} disabled={saving} className="h-12 w-full rounded-full bg-accent font-bold text-ink disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar mis avisos"}
        </button>
      </div>
    </div>
  );
}
