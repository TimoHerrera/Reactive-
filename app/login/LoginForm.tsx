"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthHeader } from "@/components/AuthHeader";
import { Input, PillButton } from "@/components/ui";
import { data } from "@/lib/data";
import { DEMO_PASSWORD, IDS } from "@/lib/data/seed";
import { homeForRole } from "@/lib/auth/cookies";
import { getDb } from "@/lib/data/mock/store";

function safeNext(next: string | null, home: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return home;
  // Un cliente no puede ir a /coach.
  if (home === "/app" && next.startsWith("/coach")) return home;
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? "El link venció o ya se usó. Pedí uno nuevo." : null,
  );
  const [busy, setBusy] = useState(false);

  async function signIn(e: string, p: string) {
    setBusy(true);
    setError(null);
    const res = await data.auth.signIn(e, p);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.replace(safeNext(params.get("next"), homeForRole(res.user.role)));
    router.refresh();
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    void signIn(email, password);
  }

  const demoUsers =
    data.kind === "mock"
      ? [
          { label: "Martina (cliente)", id: IDS.martina },
          { label: "Nico (profe)", id: IDS.nico },
          { label: "Admin", id: IDS.admin },
        ]
      : [];

  return (
    <main className="phone flex flex-col">
      <AuthHeader>
        Entrá a
        <br />
        tu rutina
      </AuthHeader>

      <form onSubmit={onSubmit} className="flex flex-1 flex-col px-gutter pt-8" noValidate>
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="relative mt-5">
          <Input
            label="Contraseña"
            type={showPwd ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-1 top-[26px] flex h-11 w-11 items-center justify-center rounded-md text-muted hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {showPwd && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </div>
        <div className="mt-3 flex justify-end">
          <Link
            href="/recuperar"
            className="flex min-h-[44px] items-center text-small text-muted underline underline-offset-4 hover:text-ink"
          >
            ¿Te olvidaste la contraseña?
          </Link>
        </div>

        <PillButton type="submit" arrow block className="mt-4" disabled={busy || !email || !password}>
          {busy ? "Ingresando…" : "Ingresar"}
        </PillButton>

        {demoUsers.length > 0 && (
          <div className="mt-8 rounded-lg border border-dashed border-line p-4">
            <p className="label">Modo demo · acceso rápido</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {demoUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const p = getDb().profiles.find((x) => x.id === u.id);
                    if (p) void signIn(p.email, DEMO_PASSWORD);
                  }}
                  className="h-11 rounded-full border border-line bg-surface px-4 text-small font-semibold hover:bg-surface-2"
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <footer className="mt-auto border-t border-line pb-8 pt-6 text-center">
          <Link
            href="/solicitar-acceso"
            className="inline-flex min-h-[44px] items-center text-body underline decoration-accent decoration-2 underline-offset-4 hover:text-ink"
          >
            ¿Primera vez?&nbsp;<span className="text-title">Pedile tu acceso a tu profe.</span>
          </Link>
          <p className="mt-3 text-small text-muted">Clientes y profes usan el mismo acceso.</p>
        </footer>
      </form>
    </main>
  );
}
