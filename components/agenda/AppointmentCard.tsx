"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { EditScope } from "@/lib/agenda/series";
import { baTime } from "@/lib/agenda/time";
import { APPOINTMENT_TYPE_LABEL, type Appointment, type AppointmentStatus } from "@/lib/data";
import { StatusPill } from "./parts";

type Props = {
  appointment: Appointment;
  clientName: string;
  coachName?: string | null;
  /** Mostrar el profe (admin viendo a todos). */
  showCoach?: boolean;
  onStatus: (status: AppointmentStatus, scope: EditScope) => void;
  onEdit: () => void;
  onWhatsApp?: () => void;
  busy?: boolean;
};

const btn = "flex min-h-[44px] items-center justify-center rounded-full border border-line px-3 text-small font-semibold hover:bg-surface-2 disabled:opacity-40";

/** Un turno en la lista del día: hora, paciente, tipo, estado y acciones rápidas. */
export function AppointmentCard({ appointment: a, clientName, coachName, showCoach, onStatus, onEdit, onWhatsApp, busy }: Props) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const end = baTime(new Date(new Date(a.startsAt).getTime() + a.durationMin * 60_000).toISOString());
  const past = new Date(a.startsAt).getTime() < Date.now();
  const closed = a.status === "cancelado";

  return (
    <article
      aria-label={`${baTime(a.startsAt)} · ${clientName}`}
      className={cn(
        "rounded-lg border bg-surface p-4",
        a.status === "reprogramacion_pedida" || a.status === "pendiente" ? "border-warning/70" : "border-line",
        closed && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-14 shrink-0">
          <p className="display text-[1.75rem] leading-none tabular-nums">{baTime(a.startsAt)}</p>
          <p className="mt-1 text-caption text-muted tabular-nums">→ {end}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/coach/clientes/${a.clientId}?tab=turnos`} className="min-w-0 truncate text-title-sm underline-offset-4 hover:underline">
              {clientName}
            </Link>
            <StatusPill status={a.status} />
          </div>
          <p className="mt-0.5 text-small text-title">
            {APPOINTMENT_TYPE_LABEL[a.type]} · {a.durationMin} min{a.seriesId ? " · se repite" : ""}
            {showCoach && coachName ? ` · ${coachName}` : ""}
          </p>
          {a.notes && <p className="mt-1 text-small text-muted">{a.notes}</p>}
          {a.status === "pendiente" && (
            <p className="mt-2 rounded-sm bg-warning/10 px-3 py-2 text-small">
              <strong className="text-warning">Reservó online.</strong> Confirmalo o rechazalo.
            </p>
          )}
          {a.status === "reprogramacion_pedida" && (
            <p className="mt-2 rounded-sm bg-warning/10 px-3 py-2 text-small">
              <strong className="text-warning">Pidió reprogramar.</strong>
              {a.rescheduleReason ? ` Motivo: ${a.rescheduleReason}.` : ""}
              {a.reschedulePreference ? ` Prefiere: ${a.reschedulePreference}.` : ""}
            </p>
          )}
        </div>
      </div>

      {confirmCancel ? (
        <div className="mt-3 rounded-md border border-line p-3">
          <p className="text-small font-semibold">¿Cancelar {a.seriesId ? "este turno o también los siguientes" : "el turno"}?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={cn(btn, "text-danger-ink")} disabled={busy} onClick={() => onStatus("cancelado", "this")}>
              {a.seriesId ? "Solo este" : "Sí, cancelar"}
            </button>
            {a.seriesId && (
              <button type="button" className={cn(btn, "text-danger-ink")} disabled={busy} onClick={() => onStatus("cancelado", "following")}>
                Este y los siguientes
              </button>
            )}
            <button type="button" className={btn} onClick={() => setConfirmCancel(false)}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.status === "pendiente" && (
            <>
              <button type="button" className={cn(btn, "border-transparent bg-ink text-bg hover:bg-ink/90")} disabled={busy} onClick={() => onStatus("agendado", "this")}>
                Confirmar
              </button>
              <button type="button" className={btn} disabled={busy} onClick={() => onStatus("cancelado", "this")}>
                Rechazar
              </button>
            </>
          )}
          {(a.status === "agendado" || a.status === "reprogramacion_pedida") && (
            <>
              <button type="button" className={cn(btn, "border-success/60 text-success")} disabled={busy || !past} title={past ? undefined : "Todavía no empezó"} onClick={() => onStatus("asistio", "this")}>
                Asistió
              </button>
              <button type="button" className={btn} disabled={busy || !past} onClick={() => onStatus("ausente", "this")}>
                Ausente
              </button>
              <button type="button" className={btn} disabled={busy} onClick={() => setConfirmCancel(true)}>
                Cancelar
              </button>
            </>
          )}
          {(a.status === "asistio" || a.status === "ausente" || a.status === "cancelado") && (
            <button type="button" className={btn} disabled={busy} onClick={() => onStatus("agendado", "this")}>
              Deshacer
            </button>
          )}
          {a.status === "reprogramacion_pedida" && (
            <button type="button" className={btn} disabled={busy} onClick={() => onStatus("agendado", "this")}>
              Mantener
            </button>
          )}
          <button type="button" className={btn} disabled={busy} onClick={onEdit}>
            {a.status === "reprogramacion_pedida" ? "Reprogramar" : "Editar"}
          </button>
          {onWhatsApp && !closed && (
            <button type="button" className={cn(btn, "border-success/60 text-success")} onClick={onWhatsApp}>
              WhatsApp
            </button>
          )}
        </div>
      )}
    </article>
  );
}
