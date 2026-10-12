"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { data, type SessionUser } from "@/lib/data";

type Ctx = {
  user: SessionUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setUser(await data.auth.getUser());
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const signOut = async () => {
    await data.auth.signOut();
    setUser(null);
    router.replace("/login");
    router.refresh();
  };

  return <SessionContext.Provider value={{ user, loading, signOut, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession fuera de SessionProvider");
  return ctx;
}
