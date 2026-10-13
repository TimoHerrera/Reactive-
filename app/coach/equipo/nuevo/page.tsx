"use client";

import { useState, type FormEvent } from "react";
import { AdminOnly, BackHeader, ShareBox } from "@/components/coach/TeamParts";
import { Input, PillButton } from "@/components/ui";
import { data } from "@/lib/data";
import type { Profile } from "@/lib/data/types";
import { cn } from "@/lib/cn";

const EMPTY = { fullName: "", email: "", title: "", phone: "", role: "coach" as "coach" | "admin" };

/** «+ PROFE»: alta con invitación por mail → /activar → /coach. */
function NuevoProfe() {
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ profile: Profile; link: string | null } | null>(null);
  const set = (k: keyof typeof v, value: string) => setV((s) => ({ ...s, [k]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (v.fullName.trim().length < 2) errs.fullName = "Falta el nombre.";
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) errs.email = "Revisá el email.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await data.team.invite({
        fullName: v.fullName.trim(),
        email: v.email.trim().toLowerCase(),
        title: v.title.trim() || null,
        phone: v.phone.trim() || null,
        role: v.role,
      });
      setDone({ profile: res.profile, link: res.activationLink });
    } catch (err) {
      setErrors({ form: (err as Error).message || "No pudimos invitarlo." });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="pb-10">
        <BackHeader href="/coach/equipo" label="Equipo" title="Invitación enviada" />
        <div className="space-y-4 px-gutter">
          <p className="text-body text-muted">
            {data.kind === "supabase"
              ? `Le mandamos un mail a ${done.profile.email} para que cree su contraseña. Si no le llega, desde su ficha podés reenviarlo o generar un código.`
              : `Modo demo: no se mandan mails. Pasale este link a ${done.profile.fullName.split(" ")[0]} para que cree su contraseña.`}
          </p>
          {done.link && <ShareBox label="Link de activación" value={done.link} testId="activation-link" />}
          <PillButton href={`/coach/equipo/${done.profile.id}`} variant="inverse" block arrow>
            Ver ficha
          </PillButton>
          <PillButton
            type="button"
            variant="outline"
            block
            onClick={() => {
              setDone(null);
              setV(EMPTY);
            }}
          >
            Sumar otro profe
          </PillButton>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <BackHeader href="/coach/equipo" label="Equipo" title="+ Profe" />
      <form onSubmit={onSubmit} className="space-y-5 px-gutter" noValidate>
        <Input label="Nombre" value={v.fullName} onChange={(e) => set("fullName", e.target.value)} error={errors.fullName} autoComplete="off" />
        <Input label="Email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} error={errors.email} autoComplete="off" />
        <Input label="Título" placeholder="Kinesiólogo deportivo" value={v.title} onChange={(e) => set("title", e.target.value)} />
        <Input label="WhatsApp" type="tel" inputMode="tel" placeholder="+54 9 11 …" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
        <fieldset>
          <legend className="label mb-2">Rol</legend>
          <div className="flex gap-2">
            {(
              [
                ["coach", "Profe"],
                ["admin", "Admin"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={v.role === key}
                onClick={() => set("role", key)}
                className={cn(
                  "h-11 flex-1 rounded-full text-body font-bold",
                  v.role === key ? "bg-accent text-ink" : "border border-line text-title hover:bg-surface-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-small text-muted">El admin además gestiona el equipo.</p>
        </fieldset>
        {errors.form && (
          <p role="alert" className="text-small font-medium text-danger-ink">
            ✕ {errors.form}
          </p>
        )}
        <PillButton type="submit" block arrow disabled={busy}>
          {busy ? "Invitando…" : "Enviar invitación"}
        </PillButton>
      </form>
    </div>
  );
}

export default function NuevoProfePage() {
  return (
    <AdminOnly>
      <NuevoProfe />
    </AdminOnly>
  );
}
