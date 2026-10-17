"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppointmentCard } from "@/components/agenda/AppointmentCard";
import { AppointmentForm } from "@/components/agenda/AppointmentForm";
import { StatusPill, WhatsAppButton, WhatsAppSheet } from "@/components/agenda/parts";
import { CoachFilterChips, useCoachFilter } from "@/components/coach/CoachFilter";
import { CoachMenu } from "@/components/coach/CoachMenu";
import { InlineLoading } from "@/components/Loading";
import { QueryError } from "@/components/QueryError";
import { useSession } from "@/components/SessionProvider";
import { LogoMark } from "@/components/ui";
import { cn } from "@/lib/cn";
import { appointmentReminderText, byStart, longDay, onDate, shortDay, weekOf } from "@/lib/agenda/agenda";
import type { EditScope } from "@/lib/agenda/series";
import { baDate, baTime, baToday } from "@/lib/agenda/time";
import { addDays, startOfWeek } from "@/lib/dates";
import { APPOINTMENT_TYPE_LABEL, data, type Appointment, type AppointmentStatus, type Profile } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

type View = "dia" | "semana";
const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Agenda del profe: vista Día (lista por horario) y Semana, «+ Turno», reprogramaciones y recordatorios de mañana. */
export function AgendaView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useSession();
  const filter = useCoachFilter();
  const today = baToday();
  const date = isDate(params.get("fecha")) ? params.get("fecha")! : today;
  const view: View = params.get("vista") === "semana" ? "semana" : "dia";
  const monday = startOfWeek(date);

  const [form, setForm] = useState<{ appointment: Appointment | null } | null>(null);
  const [wa, setWa] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const go = (next: { fecha?: string; vista?: View }) => {
    const q = new URLSearchParams(params.toString());
    if (next.fecha) q.set("fecha", next.fecha);
    if (next.vista) q.set("vista", next.vista);
    router.replace(`/coach/agenda?${q.toString()}`, { scroll: false });
  };

  // Semana visible + desde hoy (para «mañana» y los pedidos de reprogramación).
  const q = useQuery(async () => {
    const from = monday < today ? monday : today;
    const to = addDays(monday, 6) > addDays(today, 1) ? addDays(monday, 6) : addDays(today, 1);
    const [appointments, clients, staff, pending, settings] = await Promise.all([
      data.appointments.list({ from, to }),
      data.profiles.listClients(),
      data.profiles.listStaff(),
      data.appointments.list({ from: today }),
      data.settings.get(),
    ]);
    const merged = new Map([...appointments, ...pending].map((a) => [a.id, a]));
    return { appointments: [...merged.values()].sort(byStart), clients, staff, template: settings.appointmentTemplate };
  }, [monday, today]);

  const all = useMemo(
    () => (q.data?.appointments ?? []).filter((a) => !filter.coachId || a.coachId === filter.coachId),
    [q.data, filter.coachId],
  );
  const clientById = useMemo(() => new Map((q.data?.clients ?? []).map((c) => [c.id, c] as [string, Profile])), [q.data]);
  const staffById = useMemo(() => new Map((q.data?.staff ?? []).map((c) => [c.id, c] as [string, Profile])), [q.data]);
  const nameOf = (id: string) => clientById.get(id)?.fullName ?? "Paciente";

  const requests = all.filter((a) => a.status === "reprogramacion_pedida");
  const tomorrow = addDays(today, 1);
  const tomorrowList = onDate(all, tomorrow).filter((a) => a.status === "agendado" || a.status === "reprogramacion_pedida");
  const dayList = onDate(all, date);
  const week = weekOf(all, date);

  const replace = (changed: Appointment[]) =>
    q.setData((prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.appointments.map((a) => [a.id, a]));
      for (const c of changed) byId.set(c.id, c);
      return { ...prev, appointments: [...byId.values()].sort(byStart) };
    });

  const setStatus = async (a: Appointment, status: AppointmentStatus, scope: EditScope) => {
    setBusy(a.id);
    try {
      replace(await data.appointments.update(a.id, { status }, scope));
    } finally {
      setBusy(null);
    }
  };

  const activeClients = (q.data?.clients ?? [])
    .filter((c) => !c.disabledAt && (!filter.coachId || c.coachId === filter.coachId))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));

  const card = (a: Appointment) => (
    <AppointmentCard
      key={a.id}
      appointment={a}
      clientName={nameOf(a.clientId)}
      coachName={staffById.get(a.coachId)?.fullName}
      showCoach={filter.isAdmin && !filter.coachId}
      busy={busy === a.id}
      onStatus={(s, scope) => void setStatus(a, s, scope)}
      onEdit={() => setForm({ appointment: a })}
      onWhatsApp={() => setWa(a)}
    />
  );

  return (
    <div className="pb-28">
      <header className="bg-grid px-gutter pb-4 pt-8">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <LogoMark className="h-7 w-6 text-ink" />
            <span className="label">Modo profe</span>
          </span>
          <CoachMenu />
        </div>
        <h1 className="display mt-4 text-display-xl text-title">Agenda</h1>
      </header>

      <CoachFilterChips filter={filter} className="mb-3" />

      {/* Navegación */}
      <div className="sticky top-0 z-20 border-b border-line bg-bg/95 px-gutter py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Vista" className="flex rounded-full border border-line p-1">
            {(["dia", "semana"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => go({ vista: v })}
                className={cn("h-9 rounded-full px-3 text-small font-bold", view === v ? "bg-ink text-bg" : "text-title")}
              >
                {v === "dia" ? "Día" : "Semana"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" aria-label={view === "dia" ? "Día anterior" : "Semana anterior"} onClick={() => go({ fecha: addDays(date, view === "dia" ? -1 : -7) })} className="flex h-11 w-11 items-center justify-center rounded-full text-[1.25rem] hover:bg-surface-2">
              ‹
            </button>
            <button type="button" onClick={() => go({ fecha: today })} disabled={date === today} className="h-11 rounded-full border border-line px-4 text-small font-bold disabled:opacity-40">
              Hoy
            </button>
            <button type="button" aria-label={view === "dia" ? "Día siguiente" : "Semana siguiente"} onClick={() => go({ fecha: addDays(date, view === "dia" ? 1 : 7) })} className="flex h-11 w-11 items-center justify-center rounded-full text-[1.25rem] hover:bg-surface-2">
              ›
            </button>
          </div>
        </div>
        <p className="mt-1 text-body font-semibold capitalize" aria-live="polite">
          {view === "dia" ? `${date === today ? "Hoy · " : ""}${longDay(date)}` : `Semana del ${shortDay(monday)} al ${shortDay(addDays(monday, 6))}`}
        </p>
      </div>

      <div className="space-y-4 px-gutter pt-4">
        {q.error && !q.data && <QueryError what="la agenda" onRetry={() => void q.reload()} />}
        {!q.data && !q.error && <InlineLoading />}

        {requests.length > 0 && (
          <section aria-labelledby="pedidos" className="rounded-lg border border-warning/70 bg-warning/10 p-4">
            <h2 id="pedidos" className="text-title-sm text-warning">
              Reprogramaciones pedidas ({requests.length})
            </h2>
            <ul className="mt-2 space-y-2">
              {requests.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-small">
                    <strong>{nameOf(a.clientId)}</strong> · {shortDay(baDate(a.startsAt))} {baTime(a.startsAt)}
                    {a.reschedulePreference ? ` · prefiere ${a.reschedulePreference}` : ""}
                  </span>
                  <button type="button" onClick={() => setForm({ appointment: a })} className="h-11 shrink-0 rounded-full bg-ink px-4 text-small font-bold text-bg">
                    Reprogramar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {q.data && view === "dia" && (
          <section aria-label="Turnos del día" className="space-y-3">
            {dayList.length === 0 ? (
              <p className="rounded-lg border-2 border-dashed border-line p-6 text-center text-small text-muted">Sin turnos este día.</p>
            ) : (
              dayList.map(card)
            )}
          </section>
        )}

        {q.data && view === "semana" && (
          <section aria-label="Turnos de la semana" className="space-y-2">
            {week.map((d) => (
              <div key={d.date} className={cn("rounded-lg border bg-surface", d.date === today ? "border-accent" : "border-line")}>
                <button
                  type="button"
                  onClick={() => go({ fecha: d.date, vista: "dia" })}
                  className="flex min-h-[48px] w-full items-center justify-between px-4 text-left"
                >
                  <span className="font-bold capitalize">{shortDay(d.date)}</span>
                  <span className="text-small text-muted">{d.items.filter((a) => a.status !== "cancelado").length || "Sin"} turnos</span>
                </button>
                {d.items.length > 0 && (
                  <ul className="border-t border-line">
                    {d.items.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => setForm({ appointment: a })}
                          className={cn("flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-2", a.status === "cancelado" && "opacity-60")}
                        >
                          <span className="w-12 shrink-0 font-bold tabular-nums">{baTime(a.startsAt)}</span>
                          <span className="min-w-0 flex-1 truncate text-small">
                            {nameOf(a.clientId)} · {APPOINTMENT_TYPE_LABEL[a.type]}
                          </span>
                          {a.status !== "agendado" && <StatusPill status={a.status} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {q.data && (
          <section aria-labelledby="manana" className="pt-2">
            <h2 id="manana" className="display text-h2 text-title">
              Turnos de mañana
            </h2>
            <p className="text-small text-muted">Recordales por WhatsApp. El mensaje se puede editar antes de mandarlo.</p>
            {tomorrowList.length === 0 ? (
              <p className="mt-2 text-small text-muted">Mañana no hay turnos.</p>
            ) : (
              <ul className="mt-2 rounded-lg border border-line bg-surface px-4">
                {tomorrowList.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{nameOf(a.clientId)}</span>
                      <span className="block text-small text-muted">
                        {baTime(a.startsAt)} · {APPOINTMENT_TYPE_LABEL[a.type]}
                      </span>
                    </span>
                    <WhatsAppButton onClick={() => setWa(a)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* + Turno */}
      <button
        type="button"
        onClick={() => setForm({ appointment: null })}
        className="display fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-[max(16px,calc(50%-224px))] z-30 h-14 rounded-full bg-accent px-6 text-button text-ink shadow-[0_8px_24px_rgba(0,0,0,.5)]"
      >
        + Turno
      </button>

      {form && user && (
        <AppointmentForm
          appointment={form.appointment}
          clients={activeClients}
          coachId={filter.coachId ?? user.id}
          isAdmin={filter.isAdmin}
          coaches={filter.coaches}
          existing={q.data?.appointments ?? []}
          defaultDate={date}
          onClose={() => setForm(null)}
          onSaved={(changed) => {
            replace(changed);
            setForm(null);
            const first = changed[0];
            if (first && !form.appointment) go({ fecha: baDate(first.startsAt) });
          }}
        />
      )}

      {wa && (
        <WhatsAppSheet
          title="Recordar turno"
          to={nameOf(wa.clientId)}
          phone={clientById.get(wa.clientId)?.phone ?? null}
          initialText={appointmentReminderText(wa, { clientName: nameOf(wa.clientId), coachName: staffById.get(wa.coachId)?.fullName, today, template: q.data?.template })}
          onClose={() => setWa(null)}
        />
      )}
    </div>
  );
}
