"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Choice, Field, inputClass } from "@/components/agenda/parts";
import { useCoachFilter } from "@/components/coach/CoachFilter";
import { InlineLoading } from "@/components/Loading";
import { QueryError } from "@/components/QueryError";
import { useSession } from "@/components/SessionProvider";
import { IconArrowLeft } from "@/components/ui/icons";
import { Stepper } from "@/components/ui/Stepper";
import { cn } from "@/lib/cn";
import { longDay } from "@/lib/agenda/agenda";
import { ALL_TYPES, BOOKING_LIMITS, bookableDays, SLOT_MINUTES, validateSchedule, WEEK_ORDER, WEEKDAY_LABEL } from "@/lib/agenda/booking";
import { baToday } from "@/lib/agenda/time";
import { addDays } from "@/lib/dates";
import { APPOINTMENT_TYPE_LABEL, data, type AppointmentType, type BookingSettings, type CoachSchedule } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

type Range = { key: number; weekday: number; startTime: string; endTime: string };
type Off = { key: number; date: string; reason: string };
type Form = { settings: Omit<BookingSettings, "coachId" | "updatedAt">; ranges: Range[]; off: Off[] };

let seq = 0;
const nextKey = () => ++seq;
const card = "rounded-lg border border-line bg-surface p-4";

function toForm(s: CoachSchedule): Form {
  const { coachId: _c, updatedAt: _u, ...settings } = s.settings;
  void _c;
  void _u;
  return {
    settings,
    ranges: s.rules.map((r) => ({ key: nextKey(), weekday: r.weekday, startTime: r.startTime, endTime: r.endTime })),
    off: s.timeOff.map((t) => ({ key: nextKey(), date: t.date, reason: t.reason ?? "" })),
  };
}

/** «Mis horarios»: franjas de atención, reglas de reserva y días bloqueados. El admin elige el profe. */
export function HorariosView() {
  const { user } = useSession();
  const filter = useCoachFilter();
  const isAdmin = user?.role === "admin";
  const [coachId, setCoachId] = useState<string | null>(null);
  const target = coachId ?? user?.id ?? null;
  const today = baToday();

  const q = useQuery(async () => {
    if (!target) return null;
    const [schedule, busy] = await Promise.all([data.booking.getSchedule(target), data.booking.busy(target, today, addDays(today, 7))]);
    return { schedule, busy };
  }, [target, today]);

  const [form, setForm] = useState<Form | null>(null);
  const [newOff, setNewOff] = useState({ date: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) setForm(toForm(q.data.schedule));
  }, [q.data]);

  const asSchedule = (f: Form): CoachSchedule => ({
    settings: { ...f.settings, coachId: target ?? "", updatedAt: null },
    rules: f.ranges.map((r) => ({ id: String(r.key), coachId: target ?? "", weekday: r.weekday, startTime: r.startTime, endTime: r.endTime })),
    timeOff: f.off.map((o) => ({ id: String(o.key), coachId: target ?? "", date: o.date, reason: o.reason || null })),
  });

  // Vista previa: horarios libres en los próximos 7 días con lo que está en pantalla.
  const preview = useMemo(() => {
    if (!form || !q.data) return null;
    const s = asSchedule({ ...form, settings: { ...form.settings, enabled: true, maxDaysAhead: Math.min(7, form.settings.maxDaysAhead) } });
    const days = bookableDays({ schedule: s, busy: q.data.busy, now: new Date() });
    return { total: days.reduce((n, d) => n + d.slots.length, 0), next: days.find((d) => d.slots.length) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, q.data]);

  if (!form) {
    return (
      <div className="px-gutter pt-10">
        {q.error ? <QueryError what="tus horarios" onRetry={() => void q.reload()} /> : <InlineLoading />}
      </div>
    );
  }

  const set = (patch: Partial<Form>) => (setForm({ ...form, ...patch }), setSaved(false), setError(null));
  const setS = (patch: Partial<Form["settings"]>) => set({ settings: { ...form.settings, ...patch } });
  const dayRanges = (w: number) => form.ranges.filter((r) => r.weekday === w).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const updateRange = (key: number, patch: Partial<Range>) => set({ ranges: form.ranges.map((r) => (r.key === key ? { ...r, ...patch } : r)) });
  const addRange = (w: number) => {
    const last = dayRanges(w).at(-1);
    const start = last ? last.endTime : "09:00";
    const h = Math.min(23, Number(start.slice(0, 2)) + 3);
    set({ ranges: [...form.ranges, { key: nextKey(), weekday: w, startTime: start, endTime: `${String(h).padStart(2, "0")}:${start.slice(3)}` }] });
  };
  const copyMonday = () => {
    const mon = dayRanges(1);
    set({ ranges: [...mon, ...[2, 3, 4, 5].flatMap((w) => mon.map((r) => ({ ...r, key: nextKey(), weekday: w }))), ...form.ranges.filter((r) => r.weekday === 0 || r.weekday === 6)] });
  };
  const toggleType = (t: AppointmentType) => setS({ types: form.settings.types.includes(t) ? form.settings.types.filter((x) => x !== t) : [...form.settings.types, t] });

  const save = async () => {
    if (!target) return;
    const invalid = validateSchedule(asSchedule(form));
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(null);
    try {
      const s = await data.booking.saveSchedule(target, {
        settings: form.settings,
        rules: form.ranges.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })),
        timeOff: form.off.map((o) => ({ date: o.date, reason: o.reason.trim() || null })),
      });
      setForm(toForm(s));
      setSaved(true);
    } catch (e) {
      setError((e as Error).message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const coachOptions = filter.coaches.filter((c) => !c.disabledAt).map((c) => [c.id, c.fullName] as [string, string]);

  return (
    <div className="pb-12">
      <header className="bg-grid px-gutter pb-5 pt-6">
        <Link href="/coach/agenda" className="-ml-1 inline-flex min-h-[44px] items-center gap-2 text-body text-title hover:text-ink">
          <IconArrowLeft className="h-5 w-5" /> Agenda
        </Link>
        <h1 className="display mt-2 text-display-xl text-title">Mis horarios</h1>
        <p className="mt-1 text-body text-title">Cuándo te pueden reservar turnos tus pacientes desde la app.</p>
      </header>

      <div className="space-y-3 px-gutter">
        {isAdmin && coachOptions.length > 1 && target && (
          <section className={card}>
            <p className="label mb-2">Horarios de</p>
            <Choice label="Profe" options={coachOptions} value={target} onChange={(id) => (setCoachId(id), setForm(null))} />
          </section>
        )}

        <section className={card}>
          <label className="flex min-h-[44px] items-center justify-between gap-3">
            <span>
              <span className="block text-title-sm">Reservas online</span>
              <span className="block text-small text-muted">{form.settings.enabled ? "Tus pacientes ven tus horarios libres y reservan solos." : "Apagado: los turnos los cargás vos."}</span>
            </span>
            <input type="checkbox" checked={form.settings.enabled} onChange={(e) => setS({ enabled: e.target.checked })} className="h-6 w-6 shrink-0 accent-[#2457E6]" />
          </label>
        </section>

        <section className={card} aria-labelledby="franjas">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="franjas" className="text-title-sm">
              Días y horarios
            </h2>
            {dayRanges(1).length > 0 && (
              <button type="button" onClick={copyMonday} className="min-h-[40px] rounded-full border border-line px-3 text-small font-semibold hover:bg-surface-2">
                Copiar el lunes a toda la semana
              </button>
            )}
          </div>
          <ul className="mt-3 divide-y divide-line">
            {WEEK_ORDER.map((w) => {
              const ranges = dayRanges(w);
              return (
                <li key={w} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={cn("font-bold", !ranges.length && "text-muted")}>{WEEKDAY_LABEL[w]}</span>
                    {!ranges.length ? (
                      <button type="button" onClick={() => addRange(w)} className="min-h-[40px] rounded-full border border-line px-3 text-small font-semibold hover:bg-surface-2">
                        + Atiendo este día
                      </button>
                    ) : (
                      <button type="button" onClick={() => addRange(w)} className="min-h-[40px] px-2 text-small font-semibold text-title hover:underline" aria-label={`Agregar franja el ${WEEKDAY_LABEL[w]?.toLowerCase()}`}>
                        + Franja
                      </button>
                    )}
                  </div>
                  {ranges.map((r) => (
                    <div key={r.key} className="mt-2 flex items-center gap-2">
                      <input
                        type="time"
                        step={900}
                        aria-label={`${WEEKDAY_LABEL[w]}: desde`}
                        value={r.startTime}
                        onChange={(e) => updateRange(r.key, { startTime: e.target.value })}
                        className={cn(inputClass, "h-11 min-w-0 flex-1 px-2 text-center")}
                      />
                      <span className="text-small text-muted">a</span>
                      <input
                        type="time"
                        step={900}
                        aria-label={`${WEEKDAY_LABEL[w]}: hasta`}
                        value={r.endTime}
                        onChange={(e) => updateRange(r.key, { endTime: e.target.value })}
                        className={cn(inputClass, "h-11 min-w-0 flex-1 px-2 text-center")}
                      />
                      <button
                        type="button"
                        onClick={() => set({ ranges: form.ranges.filter((x) => x.key !== r.key) })}
                        aria-label={`Quitar franja de ${r.startTime} a ${r.endTime}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.25rem] text-muted hover:bg-surface-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>

        <section className={cn(card, "space-y-4")} aria-labelledby="turnos">
          <h2 id="turnos" className="text-title-sm">
            Turnos
          </h2>
          <div>
            <p className="label mb-2">Duración</p>
            <Choice label="Duración" options={SLOT_MINUTES.map((m) => [String(m), `${m} min`] as [string, string])} value={String(form.settings.slotMinutes)} onChange={(v) => setS({ slotMinutes: Number(v) })} />
          </div>
          <div>
            <p className="label mb-2">Qué pueden reservar</p>
            <div role="group" aria-label="Tipos reservables" className="flex flex-wrap gap-2">
              {ALL_TYPES.map((t) => {
                const on = form.settings.types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleType(t)}
                    className={cn("min-h-[44px] rounded-full px-4 text-small font-semibold", on ? "bg-accent font-bold text-ink" : "border border-line text-title hover:bg-surface-2")}
                  >
                    {APPOINTMENT_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className={cn(card, "space-y-4")} aria-labelledby="reglas">
          <h2 id="reglas" className="text-title-sm">
            Reglas
          </h2>
          <div>
            <p className="label mb-2">Confirmación</p>
            <Choice
              label="Confirmación"
              options={[
                ["manual", "La confirmo yo"],
                ["auto", "Automática"],
              ]}
              value={form.settings.autoConfirm ? "auto" : "manual"}
              onChange={(v) => setS({ autoConfirm: v === "auto" })}
            />
            <p className="mt-2 text-caption text-muted">{form.settings.autoConfirm ? "La reserva queda agendada al instante." : "Te aparece «Por confirmar» en la Agenda y en Avisos."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Reservar con al menos</span>
            <Stepper label="horas de anticipación" value={form.settings.minNoticeHours} range={BOOKING_LIMITS.minNoticeHours} onChange={(n) => setS({ minNoticeHours: n })} />
            <span>h de anticipación</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Hasta</span>
            <Stepper label="días para adelante" value={form.settings.maxDaysAhead} range={BOOKING_LIMITS.maxDaysAhead} onChange={(n) => setS({ maxDaysAhead: n })} />
            <span>días para adelante</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Cancelar hasta</span>
            <Stepper label="horas antes para cancelar" value={form.settings.cancelHours} range={BOOKING_LIMITS.cancelHours} onChange={(n) => setS({ cancelHours: n })} />
            <span>h antes</span>
          </div>
        </section>

        <section className={cn(card, "space-y-3")} aria-labelledby="bloqueados">
          <h2 id="bloqueados" className="text-title-sm">
            Días bloqueados
          </h2>
          <p className="-mt-2 text-small text-muted">Feriados, vacaciones o cursos: esos días no se puede reservar.</p>
          <div className="grid grid-cols-[1fr_1fr] gap-2 min-[400px]:grid-cols-[150px_1fr]">
            <Field label="Fecha">
              <input type="date" min={today} value={newOff.date} onChange={(e) => setNewOff({ ...newOff, date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Motivo (opcional)">
              <input value={newOff.reason} maxLength={120} onChange={(e) => setNewOff({ ...newOff, reason: e.target.value })} placeholder="Feriado" className={inputClass} />
            </Field>
          </div>
          <button
            type="button"
            disabled={!newOff.date || form.off.some((o) => o.date === newOff.date)}
            onClick={() => (set({ off: [...form.off, { key: nextKey(), ...newOff }].sort((a, b) => a.date.localeCompare(b.date)) }), setNewOff({ date: "", reason: "" }))}
            className="min-h-[44px] rounded-full border border-line px-4 text-small font-bold hover:bg-surface-2 disabled:opacity-40"
          >
            + Bloquear día
          </button>
          {form.off.filter((o) => o.date >= today).length > 0 && (
            <ul className="divide-y divide-line rounded-md border border-line">
              {form.off
                .filter((o) => o.date >= today)
                .map((o) => (
                  <li key={o.key} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 text-small">
                      <strong className="capitalize">{longDay(o.date)}</strong>
                      {o.reason ? ` · ${o.reason}` : ""}
                    </span>
                    <button type="button" onClick={() => set({ off: form.off.filter((x) => x.key !== o.key) })} aria-label={`Desbloquear ${longDay(o.date)}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.25rem] text-muted hover:bg-surface-2">
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {preview && (
          <p className="rounded-lg bg-surface-2 p-4 text-small" role="status">
            <strong>Así lo ven tus pacientes:</strong>{" "}
            {preview.total
              ? `${preview.total} horarios libres en los próximos 7 días${preview.next ? `, el primero el ${longDay(preview.next.date)} a las ${preview.next.slots[0]!.time}` : ""}.`
              : "con esta configuración no hay horarios libres en los próximos 7 días."}
            {!form.settings.enabled && " (Las reservas están apagadas.)"}
          </p>
        )}

        {error && (
          <p role="alert" className="text-small font-medium text-danger-ink">
            ✕ {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-small font-medium text-success">
            Listo, guardado.
          </p>
        )}
        <button type="button" onClick={() => void save()} disabled={saving} className="h-12 w-full rounded-full bg-accent font-bold text-ink disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar horarios"}
        </button>
      </div>
    </div>
  );
}
