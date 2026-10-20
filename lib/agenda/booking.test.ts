import { describe, expect, it } from "vitest";
import type { CoachSchedule } from "@/lib/data/types";
import { bookableDays, bookedAppointment, canClientCancel, checkBooking, dayRulesText, defaultBookingSettings, freeSlots, validateSchedule } from "./booking";
import { baTimestamp } from "./time";

// Lunes 19/10/2026, 07:00 en Buenos Aires.
const NOW = new Date("2026-10-19T07:00:00-03:00");
const rule = (weekday: number, startTime: string, endTime: string, id = `${weekday}${startTime}`) => ({ id, coachId: "nico", weekday, startTime, endTime });

function schedule(p: Partial<CoachSchedule["settings"]> = {}, extra: Partial<CoachSchedule> = {}): CoachSchedule {
  return {
    settings: { ...defaultBookingSettings("nico"), enabled: true, minNoticeHours: 2, ...p },
    rules: [rule(1, "08:00", "12:00"), rule(1, "15:00", "17:00"), rule(3, "09:00", "11:00")],
    timeOff: [],
    ...extra,
  };
}

describe("horarios libres", () => {
  it("parte las franjas en turnos y respeta la anticipación mínima", () => {
    // Hoy lunes: 8 y 9 quedan antes de las 9:00 (7:00 + 2 h) → desde las 9.
    const slots = freeSlots({ date: "2026-10-19", schedule: schedule(), busy: [], now: NOW });
    expect(slots.map((s) => s.time)).toEqual(["09:00", "10:00", "11:00", "15:00", "16:00"]);
    expect(slots[0]!.startsAt).toBe(baTimestamp("2026-10-19", "09:00"));
  });

  it("turnos de 45 min: solo los que entran completos en la franja", () => {
    const slots = freeSlots({ date: "2026-10-21", schedule: schedule({ slotMinutes: 45 }), busy: [], now: NOW });
    expect(slots.map((s) => s.time)).toEqual(["09:00", "09:45"]); // 10:30 + 45 > 11:00
  });

  it("saca los ocupados (también los que se pisan en parte)", () => {
    const busy = [
      { startsAt: baTimestamp("2026-10-26", "10:00"), durationMin: 60 },
      { startsAt: baTimestamp("2026-10-26", "15:30"), durationMin: 30 },
    ];
    const slots = freeSlots({ date: "2026-10-26", schedule: schedule(), busy, now: NOW });
    expect(slots.map((s) => s.time)).toEqual(["08:00", "09:00", "11:00", "16:00"]);
  });

  it("días bloqueados, días sin franjas, fuera de rango y reservas apagadas", () => {
    const off = schedule({}, { timeOff: [{ id: "t", coachId: "nico", date: "2026-10-26", reason: "Feriado" }] });
    expect(freeSlots({ date: "2026-10-26", schedule: off, busy: [], now: NOW })).toEqual([]);
    expect(freeSlots({ date: "2026-10-20", schedule: schedule(), busy: [], now: NOW })).toEqual([]); // martes
    expect(freeSlots({ date: "2026-12-07", schedule: schedule({ maxDaysAhead: 30 }), busy: [], now: NOW })).toEqual([]);
    expect(freeSlots({ date: "2026-10-26", schedule: schedule({ enabled: false }), busy: [], now: NOW })).toEqual([]);
  });

  it("los próximos días, de hoy al tope", () => {
    const days = bookableDays({ schedule: schedule({ maxDaysAhead: 7 }), busy: [], now: NOW });
    expect(days).toHaveLength(8);
    expect(days.filter((d) => d.slots.length).map((d) => d.date)).toEqual(["2026-10-19", "2026-10-21", "2026-10-26"]);
  });
});

describe("reservar y cancelar", () => {
  it("valida el horario, el tipo y que esté habilitado", () => {
    const s = schedule();
    expect(checkBooking({ startsAt: baTimestamp("2026-10-21", "10:00"), type: "kinesiologia", schedule: s, busy: [], now: NOW })).toBeNull();
    expect(checkBooking({ startsAt: baTimestamp("2026-10-21", "10:30"), type: "kinesiologia", schedule: s, busy: [], now: NOW })).toMatch(/no está disponible/);
    expect(checkBooking({ startsAt: baTimestamp("2026-10-21", "10:00"), type: "mep_sport", schedule: s, busy: [], now: NOW })).toMatch(/tipo/);
    expect(checkBooking({ startsAt: baTimestamp("2026-10-21", "10:00"), type: "kinesiologia", schedule: schedule({ enabled: false }), busy: [], now: NOW })).toMatch(/habilitó/);
    const busy = [{ startsAt: baTimestamp("2026-10-21", "10:00"), durationMin: 60 }];
    expect(checkBooking({ startsAt: baTimestamp("2026-10-21", "10:00"), type: "kinesiologia", schedule: s, busy, now: NOW })).toMatch(/no está disponible/);
  });

  it("queda por confirmar o agendado según la regla del profe", () => {
    const base = { id: "a", clientId: "m", coachId: "nico", startsAt: baTimestamp("2026-10-21", "10:00"), type: "kinesiologia" as const, notes: "  Traigo estudios ", now: "" };
    const pend = bookedAppointment({ ...base, settings: schedule().settings });
    expect(pend).toMatchObject({ status: "pendiente", durationMin: 60, createdBy: "m", notes: "Traigo estudios" });
    expect(bookedAppointment({ ...base, settings: schedule({ autoConfirm: true }).settings }).status).toBe("agendado");
  });

  it("cancelar solo antes del plazo y si no pasó nada todavía", () => {
    const a = { status: "agendado" as const, startsAt: baTimestamp("2026-10-20", "10:00") }; // 27 h después
    expect(canClientCancel(a, { cancelHours: 24 }, NOW)).toBe(true);
    expect(canClientCancel(a, { cancelHours: 48 }, NOW)).toBe(false);
    expect(canClientCancel({ ...a, status: "pendiente" }, { cancelHours: 48 }, NOW)).toBe(true); // sin confirmar: hasta que empiece
    expect(canClientCancel({ ...a, status: "pendiente", startsAt: baTimestamp("2026-10-19", "06:00") }, { cancelHours: 0 }, NOW)).toBe(false);
    expect(canClientCancel({ ...a, status: "asistio" }, { cancelHours: 0 }, NOW)).toBe(false);
  });
});

describe("validar horarios del profe", () => {
  it("franjas válidas y reglas dentro de los límites", () => {
    expect(validateSchedule(schedule())).toBeNull();
    expect(validateSchedule(schedule({}, { rules: [rule(1, "08:00", "08:30")] }))).toMatch(/más corta que un turno/);
    expect(validateSchedule(schedule({}, { rules: [rule(1, "08:00", "12:00", "a"), rule(1, "11:00", "13:00", "b")] }))).toMatch(/Lunes: hay franjas que se pisan/);
    expect(validateSchedule(schedule({}, { rules: [rule(1, "8:00", "12:00")] }))).toMatch(/revisá los horarios/);
    expect(validateSchedule(schedule({ types: [] }))).toMatch(/tipo/);
    expect(validateSchedule(schedule({ maxDaysAhead: 0 }))).toMatch(/1 a 90/);
    expect(dayRulesText(schedule().rules, 1)).toBe("08:00–12:00 · 15:00–17:00");
    expect(dayRulesText(schedule().rules, 2)).toBe("Sin atención");
  });
});
