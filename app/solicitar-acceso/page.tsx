"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AuthHeader } from "@/components/AuthHeader";
import { Input, PillButton, Stripe } from "@/components/ui";
import { IconCheck } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { REACTIVE_WHATSAPP_LINK, type AccessRequestInput } from "@/lib/access/rules";
import { CASE_TYPE_LABEL, data, type CaseType, type PublicCoach } from "@/lib/data";

const CASES = Object.entries(CASE_TYPE_LABEL) as [CaseType, string][];
const NO_COACH = "__none__";

type FieldErrors = Partial<Record<"fullName" | "email" | "phone" | "message", string>>;

export default function SolicitarAccesoPage() {
  const [coaches, setCoaches] = useState<PublicCoach[] | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", coach: "", caseType: null as CaseType | null, message: "", website: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ kind: "pending" | "account" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    data.accessRequests
      .listCoaches()
      .then(setCoaches)
      .catch(() => setCoaches([]));
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const input: AccessRequestInput = {
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      requestedCoachId: form.coach && form.coach !== NO_COACH ? form.coach : null,
      caseType: form.caseType,
      message: form.message,
      website: form.website,
    };
    try {
      const res = await data.accessRequests.submit(input);
      if (res.ok) {
        setDone(true);
        window.scrollTo({ top: 0 });
      } else if (res.reason === "invalid") setErrors(res.errors);
      else {
        setErrors({});
        setNotice({ kind: res.reason === "pending" || res.reason === "account" ? res.reason : "error", text: res.message });
      }
    } catch {
      setNotice({ kind: "error", text: "No pudimos enviar el pedido. Probá de nuevo en un rato." });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="phone bg-grid flex flex-col overflow-hidden px-gutter pb-8 pt-20">
        <div className="flex flex-1 flex-col items-center text-center">
          <span className="flex h-28 w-28 items-center justify-center rounded-full bg-success text-bg">
            <IconCheck className="h-12 w-12" />
          </span>
          <h1 className="display mt-8 text-display-xl">¡Listo!</h1>
          <p className="mt-4 max-w-[20rem] text-body">Tu profe ya recibió tu pedido. Te va a llegar un mail para activar tu cuenta.</p>
          <Stripe tilt className="-mx-8 my-10 self-stretch text-[2rem]">
            ¡Sin rutinas genéricas!
          </Stripe>
        </div>
        <div className="space-y-3">
          <a
            href={REACTIVE_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 w-full items-center justify-center rounded-full border-2 border-ink text-body font-bold hover:bg-surface"
          >
            Escribinos por WhatsApp
          </a>
          <Link href="/login" className="flex min-h-[44px] items-center justify-center text-small text-muted underline underline-offset-4">
            Volver a ingresar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="phone flex flex-col">
      <AuthHeader>
        Pedí tu
        <br />
        acceso
      </AuthHeader>
      <form onSubmit={onSubmit} className="space-y-5 px-gutter pb-10 pt-6" noValidate>
        <p className="text-body text-muted">Completá tus datos y tu profe te habilita la cuenta. Te llega un mail para crear tu contraseña.</p>

        <Input label="Nombre y apellido" autoComplete="name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} error={errors.fullName} />
        <Input label="Email" type="email" inputMode="email" autoComplete="email" placeholder="tu@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
        <Input label="WhatsApp" type="tel" inputMode="tel" autoComplete="tel" placeholder="11 5555 0101" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} />

        <div>
          <label htmlFor="coach" className="label mb-2 block">
            Tu profe
          </label>
          <select
            id="coach"
            value={form.coach}
            onChange={(e) => set("coach", e.target.value)}
            className="h-12 w-full appearance-none rounded-md border border-line bg-surface px-4 text-body font-medium text-ink outline-none focus:border-accent"
          >
            <option value="" disabled>
              {coaches === null ? "Cargando profes…" : "Elegí a tu profe"}
            </option>
            {(coaches ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
                {c.title ? ` · ${c.title}` : ""}
              </option>
            ))}
            <option value={NO_COACH}>Todavía no tengo</option>
          </select>
        </div>

        <fieldset>
          <legend className="label mb-2">Tipo de caso</legend>
          <div className="flex flex-wrap gap-2">
            {CASES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={form.caseType === key}
                onClick={() => set("caseType", form.caseType === key ? null : key)}
                className={cn(
                  "h-11 rounded-full px-4 text-small font-semibold",
                  form.caseType === key ? "bg-accent text-ink" : "border border-line text-title hover:bg-surface-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="mensaje" className="label mb-2 block">
            Mensaje (opcional)
          </label>
          <textarea
            id="mensaje"
            rows={3}
            maxLength={500}
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="Contanos qué te pasa o qué querés lograr"
            className="w-full rounded-md border border-line bg-surface px-4 py-3 text-body text-ink outline-none placeholder:text-muted/70 focus:border-accent"
          />
          {errors.message && <p className="mt-2 text-small text-danger-ink">✕ {errors.message}</p>}
        </div>

        {/* Honeypot: invisible para personas; los bots lo completan. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Sitio web
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
          </label>
        </div>

        {notice && (
          <div
            role="alert"
            className={cn(
              "rounded-md border px-4 py-3 text-small",
              notice.kind === "error" ? "border-danger bg-danger/10 text-danger-ink" : "border-warning bg-warning/10 text-ink",
            )}
          >
            <p>{notice.text}</p>
            {notice.kind === "account" && (
              <p className="mt-2 flex gap-4">
                <Link href="/login" className="font-bold underline underline-offset-4">
                  Ingresar
                </Link>
                <Link href="/recuperar" className="font-bold underline underline-offset-4">
                  Recuperar contraseña
                </Link>
              </p>
            )}
          </div>
        )}

        <PillButton type="submit" block arrow disabled={busy}>
          {busy ? "Enviando…" : "Pedir acceso"}
        </PillButton>
        <Link href="/login" className="flex min-h-[44px] items-center justify-center text-small text-muted underline underline-offset-4">
          Ya tengo cuenta: ingresar
        </Link>
      </form>
    </main>
  );
}
