"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteForever } from "@/components/coach/AccountParts";
import { useSession } from "@/components/SessionProvider";
import { canDeleteUser } from "@/lib/access/scope";
import { data, type Profile } from "@/lib/data";

/**
 * Acceso del cliente (ficha):
 * - Desactivar / reactivar: admin o su profe. Desactivado no entra, se oculta de las listas y el historial queda.
 * - Eliminar definitivamente: admin o su profe, escribiendo el nombre. Libera el email.
 */
export function ClientAccess({ client, onChanged }: { client: Profile; onChanged: (p: Profile) => void }) {
  const { user } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = !!client.disabledAt;
  const first = client.fullName.split(" ")[0];

  const toggle = async () => {
    if (!disabled && !window.confirm(`¿Desactivar a ${client.fullName}? No va a poder entrar hasta que lo reactives.`)) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(await data.profiles.setClientActive(client.id, disabled));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-4" aria-label="Acceso">
      <h2 className="display text-h2">Acceso</h2>
      <p className="text-small text-muted">
        {disabled
          ? `Desactivado: ${first} no puede entrar. Sus rutinas y su historial quedan guardados y el email sigue reservado.`
          : `Al desactivarlo, ${first} no puede entrar y deja de aparecer en las listas (filtro «Desactivados»). El historial queda.`}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className={
          disabled
            ? "flex h-11 w-full items-center justify-center rounded-full bg-ink text-body font-bold text-bg disabled:opacity-40"
            : "flex h-11 w-full items-center justify-center rounded-full border-2 border-danger text-body font-bold text-danger-ink disabled:opacity-40"
        }
      >
        {disabled ? "Reactivar" : "Desactivar"}
      </button>
      {error && (
        <p role="alert" className="text-small font-medium text-danger-ink">
          ✕ {error}
        </p>
      )}
      {canDeleteUser(user, client) && (
        <DeleteForever
          name={client.fullName}
          what="Se borran la cuenta, el perfil, las rutinas, las sesiones, las observaciones y las solicitudes. El email queda libre."
          onConfirm={async (typed) => {
            await data.profiles.remove(client.id, { confirmName: typed });
            router.replace("/coach/clientes");
          }}
        />
      )}
    </section>
  );
}
