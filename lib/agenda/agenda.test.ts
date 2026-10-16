import { describe, expect, it } from "vitest";
import type { Appointment } from "@/lib/data/types";
import { normalizeArPhone, whatsappUrl } from "@/lib/phone";
import { appointmentIcs, appointmentReminderText, findConflicts, nextAppointment, recurringDates, relativeDay } from "./agenda";
import { applyPatch, buildAppointments } from "./series";
import { baDate, baTime, baTimestamp } from "./time";

let n = 0;
const ctx = { newId: () => `id-${++n}`, createdBy: "nico", now: "2026-10-01T00:00:00Z" };
const appt = (p: Partial<Appointment> & { date: string; time: string }): Appointment => ({
  id: p.id ?? `a-${++n}`,
  clientId: "martina",
  coachId: "nico",
  startsAt: baTimestamp(p.date, p.time),
  durationMin: 60,
  type: "kinesiologia",
  status: "agendado",
  notes: null,
  seriesId: null,
  createdBy: "nico",
  createdAt: "",
  rescheduleReason: null,
  reschedulePreference: null,
  rescheduleRequestedAt: null,
  ...p,
});

describe("hora de Buenos Aires", () => {
  it("18:00 en Buenos Aires es 21:00 UTC, sin importar la zona del navegador", () => {
    const ts = baTimestamp("2026-10-16", "18:00");
    expect(ts).toBe("2026-10-16T21:00:00.000Z");
    expect(baDate(ts)).toBe("2026-10-16");
    expect(baTime(ts)).toBe("18:00");
  });
  it("un turno a las 22:30 sigue siendo del mismo día (aunque en UTC ya sea el siguiente)", () => {
    expect(baDate(baTimestamp("2026-10-16", "22:30"))).toBe("2026-10-16");
  });
});

describe("turnos recurrentes", () => {
  it("lunes y jueves durante 3 semanas, desde un jueves (no incluye el lunes anterior)", () => {
    // 15/10/2026 es jueves.
    expect(recurringDates("2026-10-15", { weekdays: [1, 4], weeks: 3 })).toEqual([
      "2026-10-15",
      "2026-10-19",
      "2026-10-22",
      "2026-10-26",
      "2026-10-29",
    ]);
  });
  it("con fecha de fin (inclusive)", () => {
    expect(recurringDates("2026-10-15", { weekdays: [4], until: "2026-11-05" })).toEqual(["2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05"]);
  });
  it("domingo cuenta como fin de semana", () => {
    expect(recurringDates("2026-10-12", { weekdays: [0], weeks: 1 })).toEqual(["2026-10-18"]);
  });
  it("arma la serie con la misma hora y un mismo series_id", () => {
    const list = buildAppointments(
      { clientId: "martina", coachId: "nico", startsAt: baTimestamp("2026-10-15", "18:00"), durationMin: 60, type: "kinesiologia", notes: " " },
      { weekdays: [4], weeks: 3 },
      ctx,
    );
    expect(list.map((a) => [baDate(a.startsAt), baTime(a.startsAt)])).toEqual([
      ["2026-10-15", "18:00"],
      ["2026-10-22", "18:00"],
      ["2026-10-29", "18:00"],
    ]);
    expect(new Set(list.map((a) => a.seriesId)).size).toBe(1);
    expect(list[0]!.seriesId).not.toBeNull();
    expect(list[0]!.notes).toBeNull();
  });
  it("un turno suelto no tiene serie", () => {
    const [one] = buildAppointments(
      { clientId: "m", coachId: "nico", startsAt: baTimestamp("2026-10-15", "09:00"), durationMin: 45, type: "entrenamiento", notes: null },
      null,
      ctx,
    );
    expect(one!.seriesId).toBeNull();
  });
});

describe("editar un turno recurrente", () => {
  const s = "serie-1";
  const all = [
    appt({ id: "x1", date: "2026-10-15", time: "18:00", seriesId: s }),
    appt({ id: "x2", date: "2026-10-22", time: "18:00", seriesId: s }),
    appt({ id: "x3", date: "2026-10-29", time: "18:00", seriesId: s }),
  ];
  it("«solo este»: cambia uno", () => {
    const out = applyPatch(all, "x2", { startsAt: baTimestamp("2026-10-23", "10:00") }, "this");
    expect(out.map((a) => a.id)).toEqual(["x2"]);
    expect(baDate(out[0]!.startsAt)).toBe("2026-10-23");
  });
  it("«este y los siguientes»: nueva hora en cada fecha, tipo y duración", () => {
    const out = applyPatch(all, "x2", { startsAt: baTimestamp("2026-10-22", "19:30"), type: "entrenamiento", durationMin: 45 }, "following");
    expect(out.map((a) => [a.id, baDate(a.startsAt), baTime(a.startsAt), a.type, a.durationMin])).toEqual([
      ["x2", "2026-10-22", "19:30", "entrenamiento", 45],
      ["x3", "2026-10-29", "19:30", "entrenamiento", 45],
    ]);
  });
  it("cancelar «este y los siguientes»", () => {
    expect(applyPatch(all, "x1", { status: "cancelado" }, "following").map((a) => a.status)).toEqual(["cancelado", "cancelado", "cancelado"]);
  });
  it("mover un turno con reprogramación pedida lo vuelve a «agendado» y limpia el pedido", () => {
    const req = appt({ id: "r", date: "2026-10-20", time: "08:00", status: "reprogramacion_pedida", rescheduleReason: "Examen", reschedulePreference: "Tarde" });
    const [out] = applyPatch([req], "r", { startsAt: baTimestamp("2026-10-20", "18:00") });
    expect(out).toMatchObject({ status: "agendado", rescheduleReason: null, reschedulePreference: null });
  });
});

describe("superposición", () => {
  const list = [appt({ id: "a", date: "2026-10-16", time: "18:00" }), appt({ id: "b", date: "2026-10-16", time: "20:00", status: "cancelado" })];
  it("detecta el turno que se pisa", () => {
    expect(findConflicts({ coachId: "nico", startsAt: baTimestamp("2026-10-16", "18:30"), durationMin: 45 }, list).map((x) => x.id)).toEqual(["a"]);
  });
  it("turnos seguidos no se pisan; los cancelados y los de otro profe no cuentan; al editar no choca consigo mismo", () => {
    expect(findConflicts({ coachId: "nico", startsAt: baTimestamp("2026-10-16", "19:00"), durationMin: 60 }, list)).toEqual([]);
    expect(findConflicts({ coachId: "nico", startsAt: baTimestamp("2026-10-16", "20:00"), durationMin: 60 }, list)).toEqual([]);
    expect(findConflicts({ coachId: "caro", startsAt: baTimestamp("2026-10-16", "18:00"), durationMin: 60 }, list)).toEqual([]);
    expect(findConflicts({ id: "a", coachId: "nico", startsAt: baTimestamp("2026-10-16", "18:15"), durationMin: 60 }, list)).toEqual([]);
  });
});

describe("próximo turno", () => {
  it("el próximo agendado (o con reprogramación pedida), sin cancelados", () => {
    const list = [
      appt({ id: "x", date: "2026-10-20", time: "10:00" }),
      appt({ id: "y", date: "2026-10-18", time: "10:00", status: "cancelado" }),
      appt({ id: "z", date: "2026-10-19", time: "10:00", status: "reprogramacion_pedida" }),
    ];
    expect(nextAppointment(list, new Date("2026-10-16T15:00:00Z"))?.id).toBe("z");
  });
});

describe("WhatsApp", () => {
  it("teléfonos argentinos → 549 + área + número", () => {
    expect(normalizeArPhone("+54 9 11 5555-0101")).toBe("5491155550101");
    expect(normalizeArPhone("011 15 5555-0101")).toBe("5491155550101");
    expect(normalizeArPhone("11 5555-0112")).toBe("5491155550112");
    expect(normalizeArPhone("(0351) 15 123-4567")).toBe("5493511234567");
    expect(normalizeArPhone("5491155550101")).toBe("5491155550101");
    expect(normalizeArPhone("+54 11 5555-0101")).toBe("5491155550101");
    expect(normalizeArPhone("15 5555-0101")).toBeNull(); // sin código de área
    expect(normalizeArPhone("")).toBeNull();
  });
  it("mensaje del recordatorio y link", () => {
    const a = appt({ date: "2026-10-16", time: "18:00" });
    const text = appointmentReminderText(a, { clientName: "Martina G.", today: "2026-10-15" });
    expect(text).toBe("¡Hola Martina! Te recordamos tu turno de Kinesiología mañana viernes 16/10 a las 18:00 en Reactive. ¿Nos confirmás? 💪");
    expect(whatsappUrl("011 15 5555-0101", text)).toBe(`https://wa.me/5491155550101?text=${encodeURIComponent(text)}`);
    expect(whatsappUrl(null, text)).toBeNull();
  });
  it("«hoy», «mañana» o «el jueves»", () => {
    expect(relativeDay("2026-10-15", "2026-10-15")).toBe("hoy jueves 15/10");
    expect(relativeDay("2026-10-22", "2026-10-15")).toBe("el jueves 22/10");
  });
});

describe(".ics", () => {
  it("evento con inicio, fin en UTC y título", () => {
    const ics = appointmentIcs(appt({ id: "abc", date: "2026-10-16", time: "18:00", notes: "Traé banda; y toalla" }), {
      coachName: "Nico R.",
      now: new Date("2026-10-01T00:00:00Z"),
    });
    expect(ics).toContain("DTSTART:20261016T210000Z");
    expect(ics).toContain("DTEND:20261016T220000Z");
    expect(ics).toContain("SUMMARY:Kinesiología con Nico R. · Reactive");
    expect(ics).toContain("DESCRIPTION:Traé banda\\; y toalla");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
