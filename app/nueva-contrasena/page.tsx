"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthHeader } from "@/components/AuthHeader";
import { Input, PillButton } from "@/components/ui";
import { data } from "@/lib/data";
import { homeForRole } from "@/lib/auth/cookies";

export default function NuevaContrasenaPage() {
  const router = useRouter();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) return setError("Usá al menos 8 caracteres.");
    if (pwd !== pwd2) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await data.auth.updatePassword(pwd);
      const user = await data.auth.getUser();
      router.replace(user ? homeForRole(user.role) : "/login");
    } catch {
      setError("No pudimos guardar la contraseña. Pedí un link nuevo.");
      setBusy(false);
    }
  }

  return (
    <main className="phone flex flex-col">
      <AuthHeader>
        Creá tu
        <br />
        contraseña
      </AuthHeader>
      <form onSubmit={onSubmit} className="px-gutter pt-8" noValidate>
        <Input label="Contraseña nueva" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
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
          {busy ? "Guardando…" : "Guardar y entrar"}
        </PillButton>
      </form>
    </main>
  );
}
