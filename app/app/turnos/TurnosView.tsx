"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { appointmentLine, downloadIcs } from "@/components/agenda/NextAppointmentCard";
import { Choice, Field, StatusPill } from "@/components/agenda/parts";
import { PickClientNotice, ViewAsBanner, ViewAsNoAccess } from "@/components/client/ViewAsBanner";
import { useClientRoutine } from "@/components/client/useClientRoutine";
import { InlineLoading, Loading } from "@/components/Loading";
import { QueryError } from "@/components/QueryError";
import { Sheet } from "@/components/ui/Sheet";
import { IconCheck } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { byStart, longDay, UPCOMING } from "@/lib/agenda/agenda";
import { bookableDays, canClientCancel, cancelRule, type FreeSlot } from "@/lib/agenda/booking";
import { baDate, baToday } from "@/lib/agenda/time";
import { addDays, parseISODate } from "@/lib/dates";
import { APPOINTMENT_TYPE_LABEL, data, type Appointment, type AppointmentType } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

const WD = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const area = "w-full rounded-md border border-line bg-bg px-3 py-2 text-body text-ink outline-none placeholder:text-muted/70 focus:border-accent";

/** Turnos del paciente: reservar un horario libre con su profe y ver/cancelar sus próximos turnos. Mobile first. */
export function TurnosView() {
  const r = useClientRoutine();
  const clientId = r.clientId;
  const coach = r.data?.coach ?? null;
  const coachId = r.data?.client?.coachId ?? null;
  const today = baToday();

  const q = useQuery(async () => {
    if (!clientId || !coachId) return null;
    const schedule = await data.booking.getSchedule(coachId);
    const last = addDays(today, schedule.settings.maxDaysAhead);
    const [busy, mine] = await Promise.all([
      schedule.settings.enabled ? data.booking.busy(coachId, today, last) : Promise.resolve([]),
      data.appointments.list({ clientId, from: today }),
    ]);
    return { schedule, busy, mine: mine.sort(byStart) };
  }, [clientId, coachId, today]);

  const settings = q.data?.schedule.settings;
  const [type, setType] = useState<AppointmentType | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<FreeSlot | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const days = useMemo(() => (q.data ? bookableDays({ schedule: q.data.schedule, busy: q.data.busy, now: new Date() }) : []), [q.data]);
  const withSlots = days.filter((d) => d.slots.length > 0);
  const selected = days.find((d) => d.date === day);

  // Primer tipo habilitado y primer día con horarios libres.
  useEffect(() => {
    if (settings && (!type || !settings.types.includes(type))) setType(settings.types[0] ?? null);
  }, [settings, type]);
  useEffect(() => {
    if (!day || !withSlots.some((d) => d.date === day)) setDay(withSlots[0]?.date ?? null);
  }, [withSlots, day]);

  if (r.viewingAs && !r.clientId) return <PickClientNotice />;
  if (r.noAccess) return <ViewAsNoAccess />;
  if (r.loading) return <Loading />;

  const coachName = coach?.fullName ?? "tu profe";
  const upcoming = (q.data?.mine ?? []).filter((a) => UPCOMING.includes(a.status) && new Date(a.startsAt).getTime() > Date.now() - 30 * 60_000);
  const summary = slot && type ? `${longDay(baDate(slot.startsAt))} · ${slot.time} · ${APPOINTMENT_TYPE_LABEL[type]}` : "";

  const book = async () => {
    if (!slot || !type) return;
    setSaving(true);
    setError(null);
    try {
      const a = await data.booking.book({ startsAt: slot.startsAt, type, notes });
      setBooked(a);
      setSlot(null);
      setNotes("");
      void q.reload();
    } catch (e) {
      setError((e as Error).message || "No se pudo reservar.");
      void q.reload(); // el horario puede haberse ocupado: refrescamos los libres
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    setCancelError(null);
    try {
      await data.booking.cancel(id);
      setCancelId(null);
      void q.reload();
    } catch (e) {
      setCancelError((e as Error).message || "No se pudo cancelar.");
    }
  };

  const morning = (selected?.slots ?? []).filter((s) => s.time < "13:00");
  const afternoon = (selected?.slots ?? []).filter((s) => s.time >= "13:00");
  const slotGrid = (label: string, list: FreeSlot[]) =>
    list.length > 0 && (
      <div>
        <p className="label mb-2">{label}</p>
        <div role="radiogroup" aria-label={`Horarios de la ${label.toLowerCase()}`} className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4">
          {list.map((s) => (
            <button
              key={s.startsAt}
              type="button"
              role="radio"
              aria-checked={slot?.startsAt === s.startsAt}
              disabled={r.readOnly}
              onClick={() => setSlot(slot?.startsAt === s.startsAt ? null : s)}
              className={cn(
                "h-12 rounded-md border text-body font-bold tabular-nums transition-colors disabled:opacity-60",
                slot?.startsAt === s.startsAt ? "border-accent bg-accent text-ink" : "border-line bg-surface hover:border-accent/60",
              )}
            >
              {s.time}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className={cn("pb-10", slot && "pb-40")}>
      {r.viewingAs && <ViewAsBanner client={r.data?.client ?? null} />}
      <header className="bg-grid px-gutter pb-5 pt-10">
        <p className="label">Turnos</p>
        <h1 className="display mt-2 text-display-xl">Reservá tu turno</h1>
        <p className="mt-2 text-body text-title">{coach ? `Con ${coach.fullName}${coach.title ? ` · ${coach.title}` : ""}` : "Todavía no tenés un profe asignado."}</p>
      </header>

      <div className="space-y-5 px-gutter">
        {q.error && !q.data && <QueryError what="los turnos" onRetry={() => void q.reload()} />}
        {!q.data && !q.error && coachId && <InlineLoading />}

        {q.data && !settings?.enabled && (
          <section className="rounded-lg border border-line bg-surface p-4">
            <p className="text-title-sm">{coachName.split(" ")[0]} todavía no habilitó las reservas online.</p>
            <p className="mt-1 text-small text-muted">Pedile el turno por WhatsApp y te lo agenda.</p>
            <Link href="/app/profe" className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-line px-4 text-small font-bold hover:bg-surface-2">
              Escribirle
            </Link>
          </section>
        )}

        {q.data && settings?.enabled && (
          <section aria-labelledby="reservar" className="space-y-5">
            <h2 id="reservar" className="sr-only">
              Reservar
            </h2>
            {r.readOnly && <p className="rounded-md bg-surface-2 px-3 py-2 text-small text-muted">Vista del paciente: las reservas las hace el paciente desde su cuenta.</p>}

            {settings.types.length > 1 && type && (
              <div>
                <p className="label mb-2">Tipo de turno</p>
                <Choice label="Tipo de turno" options={settings.types.map((t) => [t, APPOINTMENT_TYPE_LABEL[t]] as [AppointmentType, string])} value={type} onChange={(t) => setType(t)} />
              </div>
            )}

            {withSlots.length === 0 ? (
              <p className="rounded-lg border-2 border-dashed border-line p-6 text-center text-small text-muted">
                No hay horarios libres en los próximos {settings.maxDaysAhead} días. Escribile a {coachName.split(" ")[0]}.
              </p>
            ) : (
              <>
                <div>
                  <p className="label mb-2">Día</p>
                  <div role="radiogroup" aria-label="Día" className="no-scrollbar -mx-gutter flex snap-x gap-2 overflow-x-auto px-gutter pb-1">
                    {days.map((d) => {
                      const date = parseISODate(d.date);
                      const free = d.slots.length;
                      return (
                        <button
                          key={d.date}
                          type="button"
                          role="radio"
                          aria-checked={day === d.date}
                          aria-label={`${longDay(d.date)}: ${free ? `${free} ${free === 1 ? "horario libre" : "horarios libres"}` : "sin horarios"}`}
                          disabled={!free}
                          onClick={() => (setDay(d.date), setSlot(null))}
                          className={cn(
                            "flex h-[84px] w-[68px] shrink-0 snap-start flex-col items-center justify-center rounded-lg border transition-colors disabled:opacity-35",
                            day === d.date ? "border-accent bg-accent text-ink" : "border-line bg-surface hover:border-accent/60",
                          )}
                        >
                          <span className="text-caption font-bold uppercase tracking-wider">{d.date === today ? "hoy" : WD[date.getDay()]}</span>
                          <span className="display text-[1.75rem] leading-none">{date.getDate()}</span>
                          <span className={cn("mt-1 text-[0.6875rem]", day === d.date ? "text-ink" : "text-muted")}>{free ? `${free} libres` : "—"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selected && (
                  <div className="space-y-4">
                    <p className="text-title-sm capitalize">{longDay(selected.date)}</p>
                    {slotGrid("Mañana", morning)}
                    {slotGrid("Tarde", afternoon)}
                  </div>
                )}
              </>
            )}

            <p className="text-caption text-muted">
              Turnos de {settings.slotMinutes} min · {settings.autoConfirm ? "quedan reservados al instante" : `los confirma ${coachName.split(" ")[0]}`} · {cancelRule(settings)}
            </p>
          </section>
        )}

        {q.data && (
          <section aria-labelledby="mis-turnos" className="pt-1">
            <h2 id="mis-turnos" className="display text-h2 text-title">
              Mis turnos
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-small text-muted">No tenés turnos próximos.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
                {upcoming.map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-body">{appointmentLine(a, coach?.fullName)}</span>
                      <StatusPill status={a.status} />
                    </div>
                    {a.status === "pendiente" && <p className="mt-1 text-small text-muted">Esperando que {coachName.split(" ")[0]} lo confirme.</p>}
                    {!r.readOnly && settings && canClientCancel(a, settings) && (
                      cancelId === a.id ? (
                        <div className="mt-2 rounded-md border border-line p-3">
                          <p className="text-small font-semibold">¿Cancelar este turno?</p>
                          {cancelError && (
                            <p role="alert" className="mt-1 text-small text-danger-ink">
                              ✕ {cancelError}
                            </p>
                          )}
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={() => void cancel(a.id)} className="min-h-[44px] rounded-full border border-danger/60 px-4 text-small font-bold text-danger-ink">
                              Sí, cancelar
                            </button>
                            <button type="button" onClick={() => setCancelId(null)} className="min-h-[44px] rounded-full border border-line px-4 text-small font-bold">
                              Volver
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => (setCancelId(a.id), setCancelError(null))} className="mt-2 min-h-[44px] rounded-full border border-line px-4 text-small font-semibold hover:bg-surface-2">
                          Cancelar turno
                        </button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Barra fija con el horario elegido (arriba de la tab bar) */}
      {slot && type && !r.readOnly && (
        <div className="fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 px-gutter pb-3">
          <div className="mx-auto flex max-w-[448px] items-center gap-3 rounded-lg border border-accent/60 bg-surface-2 p-3 shadow-[0_12px_32px_rgba(0,0,0,.55)]">
            <span className="min-w-0 flex-1 text-small font-semibold capitalize leading-snug">{summary}</span>
            <button type="button" onClick={() => (setConfirming(true), setError(null))} className="h-12 shrink-0 rounded-full bg-accent px-5 font-bold text-ink">
              Reservar
            </button>
          </div>
        </div>
      )}

      {(confirming || booked) && (
        <Sheet
          title={booked ? (booked.status === "agendado" ? "¡Turno reservado!" : "¡Pedido enviado!") : "Confirmar turno"}
          subtitle={booked ? appointmentLine(booked, coach?.fullName) : <span className="capitalize">{summary}</span>}
          onClose={() => (setConfirming(false), setBooked(null))}
        >
          {booked ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-md bg-success/10 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-ink">
                  <IconCheck className="h-5 w-5" />
                </span>
                <p className="text-small">
                  {booked.status === "agendado" ? "Ya está en tu agenda y en la de tu profe." : `${coachName.split(" ")[0]} lo va a confirmar. Lo ves en «Mis turnos».`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => downloadIcs(booked, coach?.fullName ?? null)} className="min-h-[48px] rounded-full border border-line px-3 text-small font-semibold hover:bg-surface-2">
                  Agregar a mi calendario
                </button>
                <button type="button" onClick={() => (setConfirming(false), setBooked(null))} className="min-h-[48px] rounded-full bg-accent px-3 font-bold text-ink">
                  Listo
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Algo que tu profe tenga que saber (opcional)">
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Ej.: traigo los estudios" className={area} />
              </Field>
              {settings && (
                <ul className="space-y-1 text-small text-muted">
                  <li>{settings.autoConfirm ? "Queda reservado al instante." : `Queda pendiente hasta que ${coachName.split(" ")[0]} lo confirme.`}</li>
                  <li>{cancelRule(settings)} Mientras no esté confirmado, lo podés retirar cuando quieras.</li>
                </ul>
              )}
              {error && (
                <p role="alert" className="text-small font-medium text-danger-ink">
                  ✕ {error}
                </p>
              )}
              <button type="button" onClick={() => void book()} disabled={saving || !slot} className="h-12 w-full rounded-full bg-accent font-bold text-ink disabled:opacity-50">
                {saving ? "Reservando…" : "Confirmar reserva"}
              </button>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
