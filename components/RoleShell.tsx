"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider, useSession } from "@/components/SessionProvider";
import { Loading } from "@/components/Loading";
import { TabBar, type TabItem } from "@/components/ui/TabBar";
import { isStaff } from "@/lib/data";

function Guard({ area, children }: { area: "client" | "coach"; children: ReactNode }) {
  const { user, loading, signOut } = useSession();

  useEffect(() => {
    // Cookie vieja sin sesión real (ej. se borró el storage): limpiamos y volvemos al login.
    if (!loading && !user) void signOut();
  }, [loading, user, signOut]);

  if (loading || !user) return <Loading />;
  if (area === "coach" && !isStaff(user.role)) return <Loading />;
  return <>{children}</>;
}

/** Pantallas a pantalla completa, sin tab bar (detalle de ejercicio, formulario de ejercicio). */
const FULLSCREEN = [/^\/app\/ejercicios\/[^/]+$/, /^\/coach\/ejercicios\/[^/]+$/, /^\/coach\/rutinas\/.+/];

/** Layout por rol: protege, provee la sesión y dibuja la tab bar. */
export function RoleShell({ area, tabs, children }: { area: "client" | "coach"; tabs: TabItem[]; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const fullscreen = FULLSCREEN.some((re) => re.test(pathname));
  return (
    <SessionProvider>
      <div className={fullscreen ? "phone" : "phone pb-[calc(84px+env(safe-area-inset-bottom))]"}>
        <Guard area={area}>{children}</Guard>
        {!fullscreen && <TabBar items={tabs} />}
      </div>
    </SessionProvider>
  );
}
