"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { AuthHeader } from "@/components/AuthHeader";
import { Loading } from "@/components/Loading";
import { Input, PillButton } from "@/components/ui";
import { homeForRole } from "@/lib/auth/cookies";
import { hardNavigate } from "@/lib/auth/session-events";
import { data, type SessionUser } from "@/lib/data";

/** Destino del link de invitación: el cliente crea su contraseña y entra directo a Hoy. */
function Activar() {
  const params = useSearchParams();
  const token = params.get("token");
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    data.auth
      .activate(token)
      .then(setUser)
      .catch(() => setUser(null));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) return setError("Usá al menos 8 caracteres.");
    if (pwd !== pwd2) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    setError(null);
    try {
      await data.auth.updatePassword(pwd);
      hardNavigate(user ? homeForRole(user.role) : "/app");
    } catch {
      setError("No pudimos guardar la contraseña. Pedile a tu profe un link nuevo.");
      setBusy(false);
    }
  }

  if (user === undefined) return <Loading label="Activando tu cuenta…" />;

  if (!user) {
    return (
      <main className="phone flex flex-col">
        <AuthHeader>
          Link
          <br />
          vencido
        </AuthHeader>
        <div className="px-gutter pt-8">
          <p className="text-body text-muted">Este link de activación ya se usó o venció. Pedile a tu profe que te reenvíe la invitación.</p>
          <PillButton href="/login" variant="inverse" arrow block className="mt-6">
            Ir a ingresar
          </PillButton>
          <Link href="/recuperar" className="mt-3 flex min-h-[44px] items-center justify-center text-small text-muted underline underline-offset-4">
            ¿Ya la activaste? Recuperá tu contraseña
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="phone flex flex-col">
      <AuthHeader>
        Creá tu
        <br />
        contraseña
      </AuthHeader>
      <form onSubmit={onSubmit} className="px-gutter pt-8" noValidate>
        <p className="mb-6 text-body text-muted">
          ¡Hola, {user.fullName.split(" ")[0]}! Elegí una contraseña para entrar a tu rutina.
        </p>
        <Input label="Email" value={user.email} disabled readOnly />
        <Input label="Contraseña" type="password" autoComplete="new-password" className="mt-5" value={pwd} onChange={(e) => setPwd(e.target.value)} hint="Mínimo 8 caracteres." />
        <Input
          label="Repetila"
          type="password"
          autoComplete="new-password"
          className="mt-5"
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          error={error ?? undefined}
        />
        <PillButton type="submit" arrow block className="mt-6" disabled={busy || !pwd || !pwd2}>
          {busy ? "Guardando…" : "Entrar a mi rutina"}
        </PillButton>
      </form>
    </main>
  );
}

export default function ActivarPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Activar />
    </Suspense>
  );
}
