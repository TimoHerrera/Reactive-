"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { Avatar } from "@/components/ui";
import { data } from "@/lib/data";
import { resetMockDb } from "@/lib/data/mock/store";

/** Avatar del profe con menú: Profes (admin), restablecer demo (mock) y cerrar sesión. */
export function CoachMenu() {
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!user) return null;
  const item = "flex min-h-[48px] w-full items-center px-4 text-left text-body hover:bg-line";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${user.fullName}`}
        className="rounded-full"
      >
        <Avatar name={user.fullName} size="md" pro />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-md border border-line bg-surface-2 py-1">
          <p className="px-4 py-2 text-small text-muted">
            {user.fullName} · {user.role === "admin" ? "Admin" : "Profe"}
          </p>
          {user.role === "admin" && (
            <Link role="menuitem" href="/coach/profes" className={item}>
              Profes
            </Link>
          )}
          {data.kind === "mock" && (
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={() => {
                if (window.confirm("¿Volver a los datos de demo? Se pierde lo que cargaste en este navegador.")) {
                  resetMockDb();
                  setOpen(false);
                }
              }}
            >
              Restablecer datos demo
            </button>
          )}
          <button role="menuitem" type="button" className={`${item} text-danger-ink`} onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
