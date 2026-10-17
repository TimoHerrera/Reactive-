"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { isDuplicateEmail, sameName } from "@/lib/data/errors";

/** Error de un formulario de alta. Si el email ya existe: «Ya existe un usuario con ese email» + «Ver ficha». */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const href = isDuplicateEmail(error) ? error.existing?.href : null;
  return (
    <div role="alert" className="rounded-md border border-danger bg-danger/10 px-4 py-3 text-small font-medium text-danger-ink">
      <p>✕ {(error as Error).message}</p>
      {href && (
        <Link href={href} className="mt-2 inline-flex min-h-[44px] items-center font-bold text-ink underline underline-offset-4">
          Ver ficha →
        </Link>
      )}
    </div>
  );
}

/**
 * Eliminar definitivamente: hay que escribir el nombre de la persona para habilitar el botón.
 * `children` va arriba (por ejemplo, el selector para reasignar clientes).
 */
export function DeleteForever({
  name,
  what,
  disabled,
  onConfirm,
  children,
}: {
  name: string;
  what: string;
  disabled?: boolean;
  onConfirm: (typedName: string) => Promise<void>;
  children?: React.ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-center rounded-full text-body font-bold text-danger-ink underline underline-offset-4"
      >
        Eliminar definitivamente
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-md border-2 border-danger p-3" role="group" aria-label="Eliminar definitivamente">
      <p className="text-small text-title">{what} No se puede deshacer.</p>
      {children}
      <div>
        <label htmlFor={id} className="label mb-2 block">
          Escribí «{name}» para confirmar
        </label>
        <input
          id={id}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="h-12 w-full rounded-md border border-line bg-bg px-3 text-body text-ink focus:border-danger"
        />
      </div>
      {error && (
        <p role="alert" className="text-small font-medium text-danger-ink">
          ✕ {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
          className="h-12 rounded-full border border-line text-small font-semibold"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || disabled || !sameName(typed, name)}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onConfirm(typed);
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
          className="h-12 rounded-full bg-danger text-small font-bold text-ink disabled:opacity-40"
        >
          {busy ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
    </div>
  );
}
