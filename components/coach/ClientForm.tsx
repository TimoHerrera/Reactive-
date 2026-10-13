"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormError } from "@/components/coach/AccountParts";
import { useCoachFilter } from "@/components/coach/CoachFilter";
import { WizardFooter } from "@/components/coach/routine/WizardHeader";
import { Input, PillButton } from "@/components/ui";
import { IconArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { CASE_TYPE_LABEL, data, type CaseType, type Profile } from "@/lib/data";

const CASES = Object.entries(CASE_TYPE_LABEL) as [CaseType, string][];

type Values = {
  fullName: string;
  email: string;
  phone: string;
  sport: string;
  caseType: CaseType | null;
  caseDetail: string;
  goal: string;
  coachId: string;
};

const toValues = (p?: Profile): Values => ({
  fullName: p?.fullName ?? "",
  email: p?.email ?? "",
  phone: p?.phone ?? "",
  sport: p?.sport ?? "",
  caseType: p?.caseType ?? null,
  caseDetail: p?.caseDetail ?? "",
  goal: p?.goal ?? "",
  coachId: p?.coachId ?? "",
});

/** Alta («+ Cliente»: invitación por email en Supabase) y edición de datos del cliente. */
export function ClientForm({ client }: { client?: Profile }) {
  const router = useRouter();
  const editing = !!client;
  // Admin: elige el profe (alta) o lo reasigna (edición). El profe no: sus clientes quedan con él.
  const team = useCoachFilter();
  const [v, setV] = useState<Values>(() => toValues(client));
  const coachId = v.coachId || (!editing ? (team.coachId ?? "") : "");
  const [errors, setErrors] = useState<Partial<Record<keyof Values | "form", string>>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((x) => ({ ...x, [k]: val }));
  const back = editing ? `/coach/clientes/${client!.id}` : "/coach/clientes";

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    const errs: typeof errors = {};
    if (!v.fullName.trim()) errs.fullName = "Poné el nombre.";
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) errs.email = "Revisá el email.";
    if (team.isAdmin && !coachId) errs.coachId = "Elegí el profe.";
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const payload = {
      fullName: v.fullName.trim(),
      email: v.email.trim().toLowerCase(),
      phone: v.phone.trim() || null,
      sport: v.sport.trim() || null,
      caseType: v.caseType,
      caseDetail: v.caseDetail.trim() || null,
      goal: v.goal.trim() || null,
      ...(team.isAdmin ? { coachId } : {}),
    };
    try {
      if (editing) {
        await data.profiles.update(client!.id, payload);
        router.push(back);
      } else {
        const created = await data.profiles.createClient(payload);
        router.replace(`/coach/clientes/${created.id}?nuevo=1`);
      }
    } catch (err) {
      // Email repetido: «Ya existe un usuario con ese email» + «Ver ficha» (no se crea el duplicado).
      setFormError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <header className="flex items-center gap-3 border-b border-line px-gutter py-4">
        <button
          type="button"
          onClick={() => router.push(back)}
          aria-label="Volver"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[1.5rem] hover:bg-surface-2"
        >
          <IconArrowLeft />
        </button>
        <h1 className="display text-[1.75rem]">{editing ? "Editar datos" : "Nuevo cliente"}</h1>
      </header>

      <div className="space-y-5 px-gutter pb-32 pt-5">
        {team.isAdmin && (
          <div>
            <label htmlFor="coach" className="label mb-2 block">
              Profe
            </label>
            <select
              id="coach"
              value={coachId}
              onChange={(e) => set("coachId", e.target.value)}
              aria-invalid={errors.coachId ? true : undefined}
              className={cn(
                "h-12 w-full rounded-md border bg-surface px-3 text-body text-ink focus:border-accent",
                errors.coachId ? "border-danger" : "border-line",
              )}
            >
              <option value="">Elegí un profe…</option>
              {team.coaches.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
            {errors.coachId && <p className="mt-2 text-small font-medium text-danger-ink">✕ {errors.coachId}</p>}
            {editing && client?.coachId && coachId !== client.coachId && (
              <p className="mt-2 text-small text-warning">Se lo vas a pasar a otro profe: deja de verlo quien lo tenía.</p>
            )}
          </div>
        )}
        <Input label="Nombre y apellido" value={v.fullName} onChange={(e) => set("fullName", e.target.value)} error={errors.fullName} autoFocus={!editing} />
        <Input
          label="Email"
          type="email"
          inputMode="email"
          value={v.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors.email}
          disabled={editing && data.kind === "supabase"}
          hint={editing ? undefined : "Le mandamos una invitación para que cree su contraseña."}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Teléfono" type="tel" inputMode="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+54 9 11…" />
          <Input label="Deporte" value={v.sport} onChange={(e) => set("sport", e.target.value)} placeholder="Fútbol 11" />
        </div>
        <fieldset>
          <legend className="label mb-2">Tipo de caso</legend>
          <div className="flex flex-wrap gap-2">
            {CASES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={v.caseType === key}
                onClick={() => set("caseType", v.caseType === key ? null : key)}
                className={cn(
                  "h-11 rounded-full px-4 text-small font-semibold",
                  v.caseType === key ? "bg-accent text-ink" : "border border-line text-title hover:bg-surface-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <Input label="Detalle del caso" value={v.caseDetail} onChange={(e) => set("caseDetail", e.target.value)} placeholder="LCA Fase 3, Lumbalgia…" />
        <div>
          <label htmlFor="goal" className="label mb-2 block">
            Objetivo
          </label>
          <textarea
            id="goal"
            rows={2}
            value={v.goal}
            onChange={(e) => set("goal", e.target.value)}
            placeholder="Volver a jugar al fútbol post-esguince de tobillo"
            className="w-full rounded-md border border-line bg-surface px-4 py-3 text-body text-ink outline-none placeholder:text-muted/70 focus:border-accent"
          />
        </div>
        <FormError error={formError} />
      </div>

      <WizardFooter>
        <PillButton type="submit" block arrow disabled={busy}>
          {busy ? "Guardando…" : editing ? "Guardar" : "Crear cliente"}
        </PillButton>
      </WizardFooter>
    </form>
  );
}
