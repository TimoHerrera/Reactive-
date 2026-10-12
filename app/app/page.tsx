"use client";

import { PagePlaceholder } from "@/components/PagePlaceholder";
import { useSession } from "@/components/SessionProvider";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import { currentRoutine, routineStatus } from "@/lib/routine/status";
import { formatDM } from "@/lib/dates";

export default function HoyPage() {
  const { user } = useSession();
  const routines = useQuery(() => data.routines.listForClient(user!.id), [user?.id]);
  const cur = routines.data ? currentRoutine(routines.data) : null;

  return (
    <PagePlaceholder kicker="Hoy" title={`Hola, ${user?.fullName.split(" ")[0] ?? ""}`} phase="F3">
      <div className="rounded-lg border border-line bg-surface p-5">
        <p className="label">Rutina vigente (capa de datos)</p>
        {routines.loading ? (
          <p className="mt-2 text-muted">Cargando…</p>
        ) : cur ? (
          <p className="mt-2 text-title-sm">
            {cur.name} · {formatDM(cur.startsOn)} → {formatDM(cur.endsOn)} · {routineStatus(cur)}
          </p>
        ) : (
          <p className="mt-2 text-muted">Sin rutina vigente</p>
        )}
      </div>
    </PagePlaceholder>
  );
}
