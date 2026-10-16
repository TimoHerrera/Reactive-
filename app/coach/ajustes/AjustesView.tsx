"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Field, inputClass } from "@/components/agenda/parts";
import { NoAccess } from "@/components/coach/NoAccess";
import { InlineLoading } from "@/components/Loading";
import { useSession } from "@/components/SessionProvider";
import { IconArrowLeft } from "@/components/ui/icons";
import { DEFAULT_APPOINTMENT_TEMPLATE } from "@/lib/agenda/agenda";
import { DEFAULT_PAYMENT_TEMPLATE } from "@/lib/billing/status";
import { data, type AppSettings } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

const area = "w-full rounded-md border border-line bg-bg px-3 py-2 text-body text-ink outline-none focus:border-accent";

/** Ajustes del centro (solo admin): alias/CBU, plantillas de WhatsApp y si el paciente ve su cuota. */
export function AjustesView() {
  const { user } = useSession();
  const q = useQuery(() => data.settings.get(), []);
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.data && !form) setForm(q.data);
  }, [q.data, form]);

  if (user && user.role !== "admin") return <NoAccess text="Los ajustes los cambia el admin." href="/coach" label="Volver al Panel" />;
  if (!form) return <InlineLoading />;
  const set = (patch: Partial<AppSettings>) => (setForm({ ...form, ...patch }), setSaved(false));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      setForm(await data.settings.update({
        transferAlias: form.transferAlias,
        paymentTemplate: form.paymentTemplate.trim() || DEFAULT_PAYMENT_TEMPLATE,
        appointmentTemplate: form.appointmentTemplate.trim() || DEFAULT_APPOINTMENT_TEMPLATE,
        showBillingToClient: form.showBillingToClient,
      }));
      setSaved(true);
    } catch (e) {
      setError((e as Error).message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-10">
      <header className="bg-grid px-gutter pb-5 pt-6">
        <Link href="/coach" className="-ml-1 inline-flex min-h-[44px] items-center gap-2 text-body text-title hover:text-ink">
          <IconArrowLeft className="h-5 w-5" /> Panel
        </Link>
        <h1 className="display mt-2 text-display-xl text-title">Ajustes</h1>
        <p className="mt-1 text-body text-title">Cobros y mensajes de WhatsApp del centro.</p>
      </header>

      <div className="space-y-5 px-gutter">
        <Field label="Alias o CBU para transferir">
          <input value={form.transferAlias} onChange={(e) => set({ transferAlias: e.target.value })} maxLength={80} placeholder="reactive.kinesio" className={inputClass} />
        </Field>

        <Field label="Mensaje de cobro (WhatsApp)">
          <textarea rows={4} value={form.paymentTemplate} onChange={(e) => set({ paymentTemplate: e.target.value })} maxLength={600} className={area} />
        </Field>
        <p className="-mt-3 text-caption text-muted">Variables: {"{nombre} {concepto} {monto} {vence} {alias}"}</p>

        <Field label="Mensaje de turno (WhatsApp)">
          <textarea rows={4} value={form.appointmentTemplate} onChange={(e) => set({ appointmentTemplate: e.target.value })} maxLength={600} className={area} />
        </Field>
        <p className="-mt-3 text-caption text-muted">Variables: {"{nombre} {tipo} {cuando} {hora} {profe}"}</p>

        <label className="flex min-h-[56px] items-center justify-between gap-3 rounded-md border border-line px-4">
          <span>
            <span className="block font-semibold">Mostrar estado de cuota al paciente</span>
            <span className="block text-small text-muted">En su Perfil: «Tu cuota: al día» o cuándo vence, con el alias.</span>
          </span>
          <input type="checkbox" checked={form.showBillingToClient} onChange={(e) => set({ showBillingToClient: e.target.checked })} className="h-6 w-6 shrink-0 accent-[#2457E6]" />
        </label>

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
          {saving ? "Guardando…" : "Guardar ajustes"}
        </button>
      </div>
    </div>
  );
}
