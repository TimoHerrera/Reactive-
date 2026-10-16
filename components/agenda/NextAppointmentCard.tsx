"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { appointmentIcs, byStart, nextAppointment, shortDay } from "@/lib/agenda/agenda";
import { canRequestReschedule } from "@/lib/agenda/series";
import { baDate, baTime, baToday } from "@/lib/agenda/time";
import { APPOINTMENT_TYPE_LABEL, data, type Appointment, type Profile } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import { Field, inputClass, StatusPill } from "./parts";

/** «jue 16/10 · 18:00 · Kinesiología con Nico R.» */
export function appointmentLine(a: Appointment, coachName?: string | null): string {
  return `${shortDay(baDate(a.startsAt))} · ${baTime(a.startsAt)} · ${APPOINTMENT_TYPE_LABEL[a.type]}${coachName ? ` con ${coachName}` : ""}`;
}

function downloadIcs(a: Appointment, coachName: string | null) {
  const blob = new Blob([appointmentIcs(a, { coachName })], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `turno-reactive-${baDate(a.startsAt)}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Turnos del paciente (Hoy y Perfil). */
export function useClientAppointments(clientId: string | null) {
  return useQuery(async () => {
    if (!clientId) return { list: [] as Appointment[], staff: [] as Profile[] };
    const [list, staff] = await Promise.all([data.appointments.list({ clientId, from: baToday() }), data.profiles.listStaff()]);
    return { list: list.sort(byStart), staff };
  }, [clientId]);
}

/** Hoy: «Próximo turno» con «Pedir reprogramar» y «Agregar a mi calendario». */
export function NextAppointmentCard({ clientId, readOnly }: { clientId: string | null; readOnly?: boolean }) {
  const q = useClientAppointments(clientId);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [preference, setPreference] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = q.data ? nextAppointment(q.data.list) : null;
  if (!next) return null;
  const coachName = q.data!.staff.find((s) => s.id === next.coachId)?.fullName ?? null;
  const requested = next.status === "reprogramacion_pedida";

  const send = async () => {
    if (!reason.trim()) return setError("Contale a tu profe el motivo.");
    setSending(true);
    setError(null);
    try {
      const updated = await data.appointments.requestReschedule(next.id, { reason, preference });
      q.setData((prev) => (prev ? { ...prev, list: prev.list.map((a) => (a.id === updated.id ? updated : a)) } : prev));
      setAsking(false);
    } catch (e) {
      setError((e as Error).message || "No se pudo enviar.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-labelledby="proximo-turno" className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p id="proximo-turno" className="label">
          Próximo turno
        </p>
        {requested && <StatusPill status={next.status} />}
      </div>
      <p className="mt-2 text-title-sm">{appointmentLine(next, coachName)}</p>
      {requested ? (
        <p className="mt-2 text-small text-muted">Le avisamos a tu profe que querés reprogramar. Te va a confirmar el nuevo horario.</p>
      ) : (
        next.notes && <p className="mt-1 text-small text-muted">{next.notes}</p>
      )}
      {!readOnly && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAsking(true)}
            disabled={!canRequestReschedule(next)}
            className="flex min-h-[48px] items-center justify-center rounded-full border border-line px-3 text-small font-semibold hover:bg-surface-2 disabled:opacity-40"
          >
            Pedir reprogramar
          </button>
          <button
            type="button"
            onClick={() => downloadIcs(next, coachName)}
            className="flex min-h-[48px] items-center justify-center rounded-full border border-line px-3 text-small font-semibold hover:bg-surface-2"
          >
            Agregar a mi calendario
          </button>
        </div>
      )}

      {asking && (
        <Sheet title="Pedir reprogramar" subtitle={appointmentLine(next, coachName)} onClose={() => setAsking(false)}>
          <div className="space-y-4">
            <Field label="Motivo">
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Ej.: tengo un examen" className={inputClass} />
            </Field>
            <Field label="¿Qué franja te queda mejor?">
              <input value={preference} onChange={(e) => setPreference(e.target.value)} maxLength={120} placeholder="Ej.: martes o jueves a la tarde" className={inputClass} />
            </Field>
            {error && (
              <p role="alert" className="text-small font-medium text-danger-ink">
                ✕ {error}
              </p>
            )}
            <button type="button" onClick={() => void send()} disabled={sending} className="h-12 w-full rounded-full bg-accent font-bold text-ink disabled:opacity-50">
              {sending ? "Enviando…" : "Enviar a mi profe"}
            </button>
          </div>
        </Sheet>
      )}
    </section>
  );
}

/** Perfil: lista de próximos turnos. */
export function UpcomingAppointments({ clientId }: { clientId: string | null }) {
  const q = useClientAppointments(clientId);
  const list = (q.data?.list ?? []).filter((a) => a.status === "agendado" || a.status === "reprogramacion_pedida");
  if (!q.data) return null;
  return (
    <section aria-labelledby="mis-turnos" className="rounded-lg border border-line bg-surface px-4 py-3">
      <h2 id="mis-turnos" className="label">
        Próximos turnos
      </h2>
      {list.length === 0 ? (
        <p className="mt-2 text-small text-muted">No tenés turnos agendados.</p>
      ) : (
        <ul className="mt-1">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
              <span className="min-w-0 text-small">{appointmentLine(a, q.data!.staff.find((s) => s.id === a.coachId)?.fullName)}</span>
              {a.status !== "agendado" && <StatusPill status={a.status} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
