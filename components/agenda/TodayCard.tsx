"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { nextAppointment, onDate } from "@/lib/agenda/agenda";
import { baTime, baToday } from "@/lib/agenda/time";
import { APPOINTMENT_TYPE_LABEL, data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

/** Panel: «Hoy: N turnos» con el próximo, y alerta de reprogramaciones pedidas. */
export function TodayCard({ coachId }: { coachId: string | null }) {
  const today = baToday();
  const q = useQuery(async () => {
    const [list, clients] = await Promise.all([data.appointments.list({ from: today }), data.profiles.listClients()]);
    return { list, names: new Map(clients.map((c) => [c.id, c.fullName])) };
  }, [today]);

  const list = (q.data?.list ?? []).filter((a) => !coachId || a.coachId === coachId);
  const todays = onDate(list, today).filter((a) => a.status !== "cancelado");
  const next = nextAppointment(todays);
  const requests = list.filter((a) => a.status === "reprogramacion_pedida");
  const name = (id: string) => q.data?.names.get(id) ?? "Paciente";

  return (
    <div className="space-y-2">
      <Link
        href="/coach/agenda"
        className="flex min-h-[64px] items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 hover:bg-surface-2"
      >
        <span className="min-w-0">
          <span className="block text-title-sm">
            Hoy: {q.data ? todays.length : "–"} {todays.length === 1 ? "turno" : "turnos"}
          </span>
          <span className="block truncate text-small text-muted">
            {!q.data
              ? "Cargando…"
              : next
                ? `Próximo: ${baTime(next.startsAt)} · ${name(next.clientId)} · ${APPOINTMENT_TYPE_LABEL[next.type]}`
                : todays.length
                  ? "No quedan turnos por hoy"
                  : "Sin turnos agendados"}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-[1.25rem]">→</span>
      </Link>
      {requests.length > 0 && (
        <Link
          href="/coach/agenda"
          className={cn("flex min-h-[56px] items-center justify-between gap-3 rounded-lg border border-warning bg-warning/10 px-4 py-3 hover:bg-warning/15")}
        >
          <span className="min-w-0">
            <span className="block text-title-sm text-warning">
              {requests.length === 1 ? "1 reprogramación pedida" : `${requests.length} reprogramaciones pedidas`}
            </span>
            <span className="block truncate text-small text-muted">
              {requests
                .slice(0, 2)
                .map((a) => name(a.clientId))
                .join(", ")}
              {requests.length > 2 ? ` y ${requests.length - 2} más` : ""}
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-[1.25rem]">→</span>
        </Link>
      )}
    </div>
  );
}
