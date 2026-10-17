"use client";

import Link from "next/link";
import { IconBell } from "@/components/ui/icons";
import { useAlerts } from "./useAlerts";

/** Campanita del Panel: cantidad de avisos nuevos → Avisos. */
export function AlertsBell() {
  const { fresh, loading } = useAlerts();
  const n = loading ? 0 : fresh.length;
  return (
    <Link
      href="/coach/avisos"
      aria-label={n ? `Avisos: ${n} ${n === 1 ? "nuevo" : "nuevos"}` : "Avisos"}
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-title hover:bg-surface-2"
    >
      <IconBell className="h-6 w-6" />
      {n > 0 && (
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[0.6875rem] font-bold leading-none text-white">
          {n > 9 ? "9+" : n}
        </span>
      )}
    </Link>
  );
}
