"use client";

import type { ReactNode } from "react";
import { useSession } from "@/components/SessionProvider";
import { PillButton } from "@/components/ui";

/** Pantalla provisional hasta que la fase correspondiente la construya. */
export function PagePlaceholder({ kicker, title, phase, children }: { kicker: string; title: string; phase: string; children?: ReactNode }) {
  const { user, signOut } = useSession();
  return (
    <div>
      <header className="bg-grid px-gutter pb-8 pt-10">
        <p className="label">{kicker}</p>
        <h1 className="display mt-2 text-display-xl">{title}</h1>
      </header>
      <div className="space-y-4 px-gutter">
        <div className="rounded-lg border border-dashed border-line p-5">
          <p className="text-title-sm">Se construye en {phase}</p>
          <p className="mt-1 text-small text-muted">
            Sesión: {user?.fullName} · {user?.role}
          </p>
        </div>
        {children}
        <PillButton variant="outline" size="sm" block onClick={() => void signOut()}>
          Cerrar sesión
        </PillButton>
      </div>
    </div>
  );
}
