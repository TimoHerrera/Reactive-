"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import { hardNavigate } from "@/lib/auth/session-events";
import { resetDemoData } from "@/lib/data/mock";

/** Avatar del profe con menú: Mi perfil, Pagos, Mis avisos, Mis horarios, Equipo y Ajustes (admin), restablecer datos de demo (admin, mock) y cerrar sesión. */
export function CoachMenu() {
  const { user, signOut } = useSession();
  const me = useQuery(() => (user ? data.profiles.get(user.id) : Promise.resolve(null)), [user?.id]);
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
        <ProfileAvatar name={user.fullName} avatarPath={me.data?.avatarPath} size="md" pro />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-md border border-line bg-surface-2 py-1">
          <p className="px-4 py-2 text-small text-muted">
            {user.fullName} · {user.role === "admin" ? "Admin" : "Profe"}
          </p>
          <Link role="menuitem" href="/coach/perfil" className={item}>
            Mi perfil
          </Link>
          <Link role="menuitem" href="/coach/pagos" className={item}>
            Pagos
          </Link>
          <Link role="menuitem" href="/coach/avisos/configurar" className={item}>
            Mis avisos
          </Link>
          <Link role="menuitem" href="/coach/agenda/horarios" className={item}>
            Mis horarios
          </Link>
          {user.role === "admin" && (
            <Link role="menuitem" href="/coach/equipo" className={item}>
              Equipo
            </Link>
          )}
          {user.role === "admin" && (
            <Link role="menuitem" href="/coach/ajustes" className={item}>
              Ajustes
            </Link>
          )}
          {data.kind === "mock" && user.role === "admin" && (
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={() => {
                if (!window.confirm("¿Restablecer los datos de demo? Se borran los usuarios, rutinas y videos de prueba de este navegador.")) return;
                void resetDemoData().then(() => hardNavigate("/coach"));
              }}
            >
              Restablecer datos de demo
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
