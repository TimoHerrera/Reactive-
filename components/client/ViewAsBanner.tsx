"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/data";
import { clearViewAs } from "./useViewedClient";

/** Aviso para el profe que está mirando la app como un cliente (solo lectura). */
export function ViewAsBanner({ client }: { client: Profile | null }) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-accent px-gutter py-2 text-small font-semibold text-ink">
      <span className="min-w-0 truncate">Viendo como {client?.fullName ?? "cliente"} · solo lectura</span>
      <button
        type="button"
        onClick={() => {
          clearViewAs();
          router.push(client ? `/coach/clientes/${client.id}` : "/coach/clientes");
        }}
        className="h-11 shrink-0 rounded-full bg-ink px-4 text-caption font-bold text-bg"
      >
        Salir
      </button>
    </div>
  );
}

/** «Ver como» un cliente ajeno (por URL). */
export function ViewAsNoAccess() {
  return (
    <div className="px-gutter pt-16 text-center" role="alert">
      <p className="display text-h1">No tenés acceso</p>
      <p className="mt-3 text-muted">Este cliente no existe o lo atiende otro profe.</p>
      <Link
        href="/coach/clientes"
        onClick={() => clearViewAs()}
        className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 font-semibold text-bg"
      >
        Ir a Clientes
      </Link>
    </div>
  );
}

/** Profe en /app sin cliente elegido. */
export function PickClientNotice() {
  return (
    <div className="px-gutter pt-16 text-center">
      <p className="display text-h1">Elegí un cliente</p>
      <p className="mt-3 text-muted">Para ver la app como un cliente, entrá desde su ficha y tocá «Ver como».</p>
      <Link href="/coach/clientes" className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 font-semibold text-bg">
        Ir a Clientes
      </Link>
    </div>
  );
}
