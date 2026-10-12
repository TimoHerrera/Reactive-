"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthHeader } from "@/components/AuthHeader";
import { Input, PillButton } from "@/components/ui";
import { data } from "@/lib/data";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      await data.auth.requestPasswordReset(email);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="phone flex flex-col">
      <AuthHeader>
        Recuperá tu
        <br />
        contraseña
      </AuthHeader>
      <div className="flex flex-1 flex-col px-gutter pt-8">
        {state === "sent" ? (
          <div className="rounded-lg border border-line bg-surface p-5">
            <p className="text-title-sm">Revisá tu email</p>
            <p className="mt-2 text-body text-muted">
              Si <strong className="text-ink">{email}</strong> tiene una cuenta, te mandamos un link para crear una
              contraseña nueva.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <p className="mb-6 text-body text-muted">Escribí tu email y te mandamos un link para crear una nueva.</p>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={state === "error" ? "No pudimos enviar el email. Probá de nuevo." : undefined}
            />
            <PillButton type="submit" arrow block className="mt-6" disabled={!email || state === "sending"}>
              {state === "sending" ? "Enviando…" : "Enviar link"}
            </PillButton>
          </form>
        )}
        <Link
          href="/login"
          className="mx-auto mt-6 flex min-h-[44px] items-center text-small text-muted underline underline-offset-4"
        >
          ← Volver a ingresar
        </Link>
      </div>
    </main>
  );
}
