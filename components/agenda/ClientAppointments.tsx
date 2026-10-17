"use client";

import { useState } from "react";
import { InlineLoading } from "@/components/Loading";
import { QueryError } from "@/components/QueryError";
import { useSession } from "@/components/SessionProvider";
import { attendance, byStart, shortDay } from "@/lib/agenda/agenda";
import { baDate, baTime, baToday } from "@/lib/agenda/time";
import { APPOINTMENT_TYPE_LABEL, data, type Appointment, type Profile } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import { AppointmentForm } from "./AppointmentForm";
import { StatusPill } from "./parts";

/** Pestaña «Turnos» de la ficha: próximos turnos e historial con asistencias y ausencias. */
export function ClientAppointments({ client }: { client: Profile }) {
  const { user } = useSession();
  const [form, setForm] = useState<{ appointment: Appointment | null } | null>(null);
  const q = useQuery(async () => {
    const [list, staff] = await Promise.all([data.appointments.list({ clientId: client.id }), data.profiles.listStaff()]);
    return { list: list.sort(byStart), staff };
  }, [client.id]);

  if (q.error && !q.data) return <QueryError what="los turnos" onRetry={() => void q.reload()} />;
  if (!q.data || !user) return <InlineLoading />;

  const now = Date.now();
  const upcoming = q.data.list.filter((a) => new Date(a.startsAt).getTime() >= now - 30 * 60_000 && a.status !== "asistio" && a.status !== "ausente");
  const history = q.data.list.filter((a) => !upcoming.includes(a)).reverse();
  const stats = attendance(history);
  const coachName = (id: string) => q.data!.staff.find((s) => s.id === id)?.fullName ?? "";

  const row = (a: Appointment) => (
    <li key={a.id}>
      <button type="button" onClick={() => setForm({ appointment: a })} className="flex min-h-[56px] w-full items-center gap-3 border-b border-line py-2 text-left last:border-0">
        <span className="w-24 shrink-0">
          <span className="block font-bold capitalize">{shortDay(baDate(a.startsAt))}</span>
          <span className="block text-small text-muted tabular-nums">{baTime(a.startsAt)}</span>
        </span>
        <span className="min-w-0 flex-1 truncate text-small text-title">
          {APPOINTMENT_TYPE_LABEL[a.type]}
          {coachName(a.coachId) ? ` · ${coachName(a.coachId)}` : ""}
        </span>
        <StatusPill status={a.status} />
      </button>
    </li>
  );

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setForm({ appointment: null })} className="h-12 w-full rounded-full bg-accent font-bold text-ink">
        + Agendar turno
      </button>

      <section aria-labelledby="proximos" className="rounded-lg border border-line bg-surface px-4 py-3">
        <h2 id="proximos" className="label">
          Próximos turnos
        </h2>
        {upcoming.length === 0 ? <p className="mt-2 text-small text-muted">No tiene turnos agendados.</p> : <ul className="mt-1">{upcoming.map(row)}</ul>}
      </section>

      <section aria-labelledby="historial" className="rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="historial" className="label">
            Historial
          </h2>
          <p className="text-small">
            <span className="font-bold text-success">{stats.asistio} asistencias</span> ·{" "}
            <span className={stats.ausente ? "font-bold text-danger-ink" : "text-muted"}>
              {stats.ausente} {stats.ausente === 1 ? "ausencia" : "ausencias"}
            </span>
          </p>
        </div>
        {history.length === 0 ? <p className="mt-2 text-small text-muted">Todavía no hay turnos pasados.</p> : <ul className="mt-1">{history.map(row)}</ul>}
      </section>

      {form && (
        <AppointmentForm
          appointment={form.appointment}
          clients={[client]}
          coachId={client.coachId ?? user.id}
          isAdmin={user.role === "admin"}
          coaches={q.data.staff.filter((s) => !s.disabledAt)}
          existing={q.data.list}
          defaultDate={baToday()}
          defaultClientId={client.id}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void q.reload();
          }}
        />
      )}
    </div>
  );
}
