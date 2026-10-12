"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { isStaff } from "@/lib/data";

const KEY = "rx-ver-como";

/**
 * Cliente que se está mirando en /app.
 * - Cliente: él mismo.
 * - Profe/admin: «Ver como» (?como=<id>, se recuerda en la pestaña). Es de solo lectura.
 */
export function useViewedClient(): { clientId: string | null; viewingAs: boolean; ready: boolean } {
  const { user } = useSession();
  const params = useSearchParams();
  const fromUrl = params.get("como");
  const [stored, setStored] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (fromUrl) sessionStorage.setItem(KEY, fromUrl);
      setStored(fromUrl ?? sessionStorage.getItem(KEY));
    } catch {
      setStored(fromUrl);
    }
    setReady(true);
  }, [fromUrl]);

  if (!user) return { clientId: null, viewingAs: false, ready: false };
  if (!isStaff(user.role)) return { clientId: user.id, viewingAs: false, ready: true };
  return { clientId: stored, viewingAs: true, ready };
}

export function clearViewAs() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // sin storage: nada que limpiar
  }
}
