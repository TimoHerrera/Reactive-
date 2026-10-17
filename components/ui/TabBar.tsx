"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/cn";
import { IconBolt, IconCalendar, IconClipboard, IconGrid, IconPlaySquare, IconUser, IconUsers } from "./icons";

export type TabItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
};

export const CLIENT_TABS: TabItem[] = [
  { href: "/app", label: "Hoy", icon: IconBolt, exact: true },
  { href: "/app/rutina", label: "Mi Rutina", icon: IconClipboard },
  { href: "/app/ejercicios", label: "Ejercicios", icon: IconPlaySquare },
  { href: "/app/perfil", label: "Perfil", icon: IconUser },
];

export const COACH_TABS: TabItem[] = [
  { href: "/coach", label: "Panel", icon: IconGrid, exact: true },
  { href: "/coach/agenda", label: "Agenda", icon: IconCalendar },
  { href: "/coach/clientes", label: "Clientes", icon: IconUsers },
  { href: "/coach/rutinas", label: "Rutinas", icon: IconClipboard },
  { href: "/coach/ejercicios", label: "Ejercicios", icon: IconPlaySquare },
];

function isActive(pathname: string, item: TabItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

// Tab bar 84 px (incluye el área segura). Activo: píldora azul 56×30 + label blanco. Inactivo: #9A9A9A.
export function TabBar({
  items,
  activeHref,
  fixed = true,
  className,
}: {
  items: TabItem[];
  /** Forzar el activo (para /dev/ui). Si no, se usa la ruta actual. */
  activeHref?: string;
  fixed?: boolean;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        "z-40 w-full max-w-phone border-t border-line bg-surface pb-safe",
        fixed && "fixed bottom-0 left-1/2 -translate-x-1/2",
        className,
      )}
    >
      <ul className="flex h-[84px] items-start pt-3">
        {items.map((item) => {
          const active = activeHref ? activeHref === item.href : isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[44px] flex-col items-center gap-1 rounded-md"
              >
                <span
                  className={cn(
                    "flex h-[30px] w-14 items-center justify-center rounded-full",
                    active ? "bg-accent text-ink" : "text-muted",
                  )}
                >
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <span className={cn("text-caption", active ? "font-bold text-ink" : "font-medium text-muted")}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
