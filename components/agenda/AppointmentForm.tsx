"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { findConflicts, MAX_SERIES, recurringDates, shortDay } from "@/lib/agenda/agenda";
import { DURATIONS, validateAppointment, type EditScope } from "@/lib/agenda/series";
import { baDate, baTime, baTimestamp } from "@/lib/agenda/time";
import { addDays } from "@/lib/dates";
import { APPOINTMENT_TYPE_LABEL, data, type Appointment, type AppointmentType, type Profile } from "@/lib/data";
import { Choice, Field, inputClass } from "./parts";

const TYPES = Object.entries(APPOINTMENT_TYPE_LABEL) as [AppointmentType, string][];
/** Lunes primero (0 = domingo en Date). */
const WEEKDAYS: [number, string][] = [
  [1, "L"],
  [2, "M"],
  [3, "M"],
  [4, "J"],
  [5, "V"],
  [6, "S"],
  [0, "D"],
];
const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

type Props = {
  /** Turno a editar; sin él, se crea uno nuevo. */
  appointment?: Appointment | null;
  clients: Profile[];
  /** Profe por defecto (el usuario; el admin puede elegir otro). */
  coachId: string;
  isAdmin: boolean;
  coaches: Profile[];
  /** Turnos ya cargados (para avisar superposiciones). */
  existing: Appointment[];
  defaultDate: string;
  defaultClientId?: string | null;
  onClose: () => void;
  onSaved: (changed: Appointment[]) => void;
};

/** «+ Turno» / «Editar turno»: paciente, fecha, hora, duración, tipo, nota y «Repetir». */
export function AppointmentForm({ appointment, clients, coachId, isAdmin, coaches, existing, defaultDate, defaultClientId, onClose, onSaved }: Props) {
  const editing = !!appointment;
  const [clientId, setClientId] = useState(appointment?.clientId ?? defaultClientId ?? "");
  const [coach, setCoach] = useState(appointment?.coachId ?? coachId);
  const [date, setDate] = useState(appointment ? baDate(appointment.startsAt) : defaultDate);
  const [time, setTime] = useState(appointment ? baTime(appointment.startsAt) : "09:00");
  const [duration, setDuration] = useState(appointment?.durationMin ?? 60);
  const [type, setType] = useState<AppointmentType>(appointment?.type ?? "kinesiologia");
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [endMode, setEndMode] = useState<"weeks" | "until">("weeks");
  const [weeks, setWeeks] = useState(4);
  const [until, setUntil] = useState(addDays(defaultDate, 27));
  const [scope, setScope] = useState<EditScope>("this");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startsAt = date && /^\d{2}:\d{2}$/.test(time) ? baTimestamp(date, time) : "";
  // Sin días elegidos, se repite el día de la semana de la fecha.
  const days = useMemo(() => (repeat && weekdays.length ? weekdays : [new Date(`${date}T12:00:00`).getDay()]), [repeat, weekdays, date]);
  const dates = useMemo(
    () => (!editing && repeat && date ? recurringDates(date, endMode === "until" ? { weekdays: days, until } : { weekdays: days, weeks }) : [date]),
    [editing, repeat, date, endMode, until, weeks, days],
  );

  // Superposición: contra los turnos cargados del mismo profe (todas las fechas de la serie).
  const conflicts = useMemo(() => {
    if (!startsAt) return [];
    return dates.flatMap((d) => findConflicts({ id: appointment?.id, coachId: coach, startsAt: baTimestamp(d, time), durationMin: duration }, existing));
  }, [dates, time, duration, coach, existing, appointment?.id, startsAt]);
  const nameOf = (id: string) => clients.find((c) => c.id === id)?.fullName ?? "Paciente";

  const save = async () => {
    const problem = validateAppointment({ clientId, coachId: coach, startsAt, durationMin: duration });
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const changed = editing
        ? await data.appointments.update(appointment.id, { startsAt, durationMin: duration, type, notes, coachId: coach }, appointment.seriesId ? scope : "this")
        : await data.appointments.create(
            { clientId, coachId: coach, startsAt, durationMin: duration, type, notes: notes || null },
            repeat ? (endMode === "until" ? { weekdays: days, until } : { weekdays: days, weeks }) : null,
          );
      onSaved(changed);
    } catch (e) {
      setError((e as Error).message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  // Parte de los días que se ven marcados (incluido el día de la fecha, si todavía no eligió ninguno).
  const toggleDay = (d: number) => setWeekdays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);

  return (
    <Sheet title={editing ? "Editar turno" : "Nuevo turno"} subtitle={editing ? nameOf(appointment.clientId) : undefined} onClose={onClose}>
      <div className="space-y-4">
        {!editing && (
          <Field label="Paciente">
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass} data-autofocus>
              <option value="">Elegí un paciente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </Field>
        )}
        {isAdmin && coaches.length > 1 && (
          <Field label="Profe">
            <select value={coach} onChange={(e) => setCoach(e.target.value)} className={inputClass}>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-[1.4fr_1fr] gap-2">
          <Field label="Fecha">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Hora">
            <input type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Duración">
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass}>
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </Field>
        <div>
          <p className="label mb-2 text-[0.6875rem]">Tipo</p>
          <Choice label="Tipo de turno" options={TYPES} value={type} onChange={setType} />
        </div>
        <Field label="Nota (opcional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Ej.: traer estudios" className={inputClass} />
        </Field>

        {!editing && (
          <section className="rounded-md border border-line p-3">
            <label className="flex min-h-[44px] items-center justify-between gap-3">
              <span className="font-semibold">Repetir</span>
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="h-6 w-6 accent-[#2457E6]" />
            </label>
            {repeat && (
              <div className="mt-2 space-y-3">
                <div role="group" aria-label="Días de la semana" className="flex justify-between gap-1">
                  {WEEKDAYS.map(([d, l]) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={days.includes(d)}
                      aria-label={WEEKDAY_NAMES[d]}
                      onClick={() => toggleDay(d)}
                      className={cn("h-11 w-11 rounded-full text-small font-bold", days.includes(d) ? "bg-accent text-ink" : "border border-line text-title")}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <Choice
                  label="Hasta cuándo"
                  options={[
                    ["weeks", "Cantidad de semanas"],
                    ["until", "Hasta una fecha"],
                  ]}
                  value={endMode}
                  onChange={setEndMode}
                />
                {endMode === "weeks" ? (
                  <Field label="Semanas">
                    <input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))} className={inputClass} />
                  </Field>
                ) : (
                  <Field label="Hasta (inclusive)">
                    <input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} className={inputClass} />
                  </Field>
                )}
                <p className="text-small text-muted" aria-live="polite">
                  Se crean {dates.length} turnos
                  {dates.length ? `: del ${shortDay(dates[0]!)} al ${shortDay(dates.at(-1)!)}` : ""}.
                  {dates.length >= MAX_SERIES ? ` (tope de ${MAX_SERIES})` : ""}
                </p>
              </div>
            )}
          </section>
        )}

        {editing && appointment.seriesId && (
          <div>
            <p className="label mb-2 text-[0.6875rem]">Es un turno que se repite. Aplicar a…</p>
            <Choice
              label="Alcance del cambio"
              options={[
                ["this", "Solo este"],
                ["following", "Este y los siguientes"],
              ]}
              value={scope}
              onChange={setScope}
            />
          </div>
        )}

        {conflicts.length > 0 && (
          <p role="alert" className="rounded-md border border-warning/60 bg-warning/10 px-4 py-3 text-small">
            <strong className="text-warning">Se superpone</strong> con {conflicts.length === 1 ? "otro turno" : `${conflicts.length} turnos`}:{" "}
            {conflicts
              .slice(0, 3)
              .map((c) => `${nameOf(c.clientId)} (${shortDay(baDate(c.startsAt))} ${baTime(c.startsAt)})`)
              .join(", ")}
            {conflicts.length > 3 ? "…" : ""}. Podés guardarlo igual.
          </p>
        )}
        {error && (
          <p role="alert" className="text-small font-medium text-danger-ink">
            ✕ {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="h-12 w-full rounded-full bg-accent font-bold text-ink hover:bg-[#2b60f0] disabled:opacity-50"
        >
          {saving ? "Guardando…" : editing ? "Guardar cambios" : dates.length > 1 ? `Agendar ${dates.length} turnos` : "Agendar turno"}
        </button>
      </div>
    </Sheet>
  );
}
