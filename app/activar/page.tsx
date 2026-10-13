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
import { normalizeCode } from "@/lib/team/rules";

/** «¿Tenés un código?»: para cuando el mail no llega. Un solo uso, atado al email, vence en 48 h. */
function CanjearCodigo({ onBack }: { onBack?: () => void }) {
  const params = useSearchParams();
  const [v, setV] = useState({ email: params.get("email") ?? "", code: "", pwd: "", pwd2: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, value: string) => setV((s) => ({ ...s, [k]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) return setError("Revisá el email.");
    if (normalizeCode(v.code).length !== 9) return setError("El código tiene 8 caracteres (por ejemplo K7Q4-M2XP).");
    if (v.pwd.length < 8) return setError("Usá al menos 8 caracteres.");
    if (v.pwd !== v.pwd2) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    setError(null);
    const res = await data.auth.redeemCode(v.email.trim().toLowerCase(), v.code, v.pwd).catch(() => ({ ok: false as const, error: "No pudimos activar la cuenta." }));
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    hardNavigate(homeForRole(res.user.role));
  }

  return (
    <main className="phone flex flex-col">
      <AuthHeader>
        Activá
        <br />
        tu cuenta
      </AuthHeader>
      <form onSubmit={onSubmit} className="px-gutter pt-8" noValidate aria-label="Canjear código">
        <p className="mb-6 text-body text-muted">Ingresá el código que te pasó Reactive y elegí tu contraseña.</p>
        <Input label="Email" type="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
        <Input
          label="Código"
          className="mt-5"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          placeholder="K7Q4-M2XP"
          value={v.code}
          onChange={(e) => set("code", e.target.value)}
        />
        <Input label="Contraseña" type="password" autoComplete="new-password" className="mt-5" value={v.pwd} onChange={(e) => set("pwd", e.target.value)} hint="Mínimo 8 caracteres." />
        <Input
          label="Repetila"
          type="password"
          autoComplete="new-password"
          className="mt-5"
          value={v.pwd2}
          onChange={(e) => set("pwd2", e.target.value)}
          error={error ?? undefined}
        />
        <PillButton type="submit" arrow block className="mt-6" disabled={busy || !v.email || !v.code || !v.pwd || !v.pwd2}>
          {busy ? "Activando…" : "Activar y entrar"}
        </PillButton>
        {onBack ? (
          <button type="button" onClick={onBack} className="mt-3 flex min-h-[44px] w-full items-center justify-center text-small text-muted underline underline-offset-4">
            Volver
          </button>
        ) : (
          <Link href="/login" className="mt-3 flex min-h-[44px] items-center justify-center text-small text-muted underline underline-offset-4">
            ¿Ya tenés cuenta? Ingresá
          </Link>
        )}
      </form>
    </main>
  );
}

/** Destino del link de invitación: crea su contraseña y entra directo (cliente → Hoy, profe → Panel). */
function Activar() {
  const params = useSearchParams();
  const token = params.get("token");
  const [withCode, setWithCode] = useState(params.has("codigo"));
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

  if (withCode) return <CanjearCodigo onBack={token ? () => setWithCode(false) : undefined} />;
  if (user === undefined) return <Loading label="Activando tu cuenta…" />;
  // Sin link ni sesión: se activa con código.
  if (!user && !token) return <CanjearCodigo />;

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
          <PillButton type="button" arrow block className="mt-6" onClick={() => setWithCode(true)}>
            Tengo un código
          </PillButton>
          <PillButton href="/login" variant="inverse" arrow block className="mt-3">
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
          ¡Hola, {user.fullName.split(" ")[0]}! Elegí una contraseña para entrar {user.role === "client" ? "a tu rutina" : "al panel de Reactive"}.
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
          {busy ? "Guardando…" : user.role === "client" ? "Entrar a mi rutina" : "Entrar al panel"}
        </PillButton>
        <button
          type="button"
          onClick={() => setWithCode(true)}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center text-small text-muted underline underline-offset-4"
        >
          ¿Tenés un código?
        </button>
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
