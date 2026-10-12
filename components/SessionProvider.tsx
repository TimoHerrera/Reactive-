"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { hardNavigate, onSessionChange } from "@/lib/auth/session-events";
import { data, type SessionUser } from "@/lib/data";

type Ctx = {
  user: SessionUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const signingOut = useRef(false);

  const refresh = useCallback(async () => {
    setUser(await data.auth.getUser());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    // Si la sesión cambia (otro login, logout), el usuario de este provider se vuelve a leer.
    return onSessionChange(() => void refresh());
  }, [refresh]);

  /** Logout completo: cierra la sesión, limpia el estado de la pestaña y recarga en /login. Idempotente. */
  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    await data.auth.signOut().catch(() => undefined);
    setUser(null);
    hardNavigate("/login");
  }, []);

  return <SessionContext.Provider value={{ user, loading, signOut, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession fuera de SessionProvider");
  return ctx;
}
