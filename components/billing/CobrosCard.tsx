"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useBilling } from "./useBilling";

/** Panel: «Cobros: 3 vencidos · 2 por vencer» → Pagos. */
export function CobrosCard({ coachId }: { coachId: string | null }) {
  const b = useBilling();
  const rows = b.rows.filter((r) => !coachId || r.client.coachId === coachId);
  const vencidos = rows.filter((r) => r.status.state === "vencido").length;
  const porVencer = rows.filter((r) => r.status.state === "por_vencer" || r.status.state === "renovar").length;
  const alert = vencidos > 0;
  return (
    <Link
      href={alert ? "/coach/pagos?estado=vencido" : "/coach/pagos"}
      className={cn(
        "flex min-h-[64px] items-center justify-between gap-3 rounded-lg border px-4 py-3",
        alert ? "border-danger/70 bg-danger/10 hover:bg-danger/15" : "border-line bg-surface hover:bg-surface-2",
      )}
    >
      <span className="min-w-0">
        <span className="block text-title-sm">
          Cobros: {b.data ? `${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"} · ${porVencer} por vencer` : "–"}
        </span>
        <span className="block truncate text-small text-muted">
          {b.data
            ? rows
                .filter((r) => r.status.state === "vencido")
                .slice(0, 2)
                .map((r) => r.client.fullName)
                .join(", ") || "Nadie con pagos vencidos"
            : "Cargando…"}
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-[1.25rem]">→</span>
    </Link>
  );
}
