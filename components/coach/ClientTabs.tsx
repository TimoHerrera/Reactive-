"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export type ClientTab = { key: string; label: string; badge?: number };

/** Pestañas de la ficha del cliente («Ficha · Registro · …»). El estado vive en la URL (?tab=). */
export function ClientTabs({ clientId, tabs, active }: { clientId: string; tabs: ClientTab[]; active: string }) {
  return (
    <nav aria-label="Secciones de la ficha" className="sticky top-0 z-20 -mx-gutter mb-4 border-b border-line bg-bg/95 px-gutter backdrop-blur">
      <ul className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.key === tabs[0]!.key ? `/coach/clientes/${clientId}` : `/coach/clientes/${clientId}?tab=${t.key}`}
                replace
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-[48px] items-center gap-2 border-b-2 px-3 text-body font-semibold",
                  on ? "border-accent text-ink" : "border-transparent text-muted hover:text-title",
                )}
              >
                {t.label}
                {!!t.badge && <span className="rounded-full bg-danger px-1.5 text-caption font-bold text-ink">{t.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
