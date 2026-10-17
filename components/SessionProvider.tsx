"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { hardNavigate, onSessionChange, onSessionRevoked } from "@/lib/auth/session-events";
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
  const userRef = useRef<SessionUser | null>(null);
  userRef.current = user;
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    setUser(await data.auth.getUser());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    // Si la sesión cambia (otro login, logout), el usuario de este provider se vuelve a leer.
    return onSessionChange(() => void refresh());
  }, [refresh]);

  // Desactivado o eliminado con la sesión abierta: la capa de datos lo detecta en su próxima acción
  // (o al navegar / volver a la pestaña) y acá se lo manda al login.
  useEffect(
    () =>
      onSessionRevoked(() => {
        if (signingOut.current) return;
        signingOut.current = true;
        setUser(null);
        hardNavigate("/login?error=desactivado");
      }),
    [],
  );
  useEffect(() => {
    const recheck = () => {
      if (userRef.current && document.visibilityState === "visible") void data.auth.getUser();
    };
    recheck();
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [pathname]);

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
