// @vitest-environment happy-dom
// Reservas online: el paciente reserva solo con su profe, sin dobles reservas; el profe edita sus horarios
// (el admin, los de cualquiera). Mismas reglas que 0013_reservas.sql.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baTimestamp } from "@/lib/agenda/time";
import { DEMO_PASSWORD, IDS } from "@/lib/data/seed";
import { mockDataSource as data } from "./index";
import { getDb, resetMockDb } from "./store";

const as = async (email: string) => {
  await data.auth.signOut();
  expect(await data.auth.signIn(email, DEMO_PASSWORD)).toMatchObject({ ok: true });
};
const MARTINA = "martina@reactive.test";
const SOFIA = "sofia@reactive.test";
const BRUNO = "bruno@reactive.test";
const NICO = "nico@reactive.test";
const CARO = "caro@reactive.test";
const ADMIN = "admin@reactive.test";

// Lunes 19/10/2026 08:00 (Buenos Aires). Nico atiende de lunes a viernes, 8–12 y 15–19.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T08:00:00-03:00"));
  await data.auth.signOut();
  resetMockDb();
});
afterEach(() => vi.useRealTimers());

const WED = "2026-10-21";

describe("reservas online", () => {
  it("la paciente reserva un horario libre con su profe y queda por confirmar", async () => {
    await as(MARTINA);
    const s = await data.booking.getSchedule(IDS.nico);
    expect(s.settings.enabled).toBe(true);
    const a = await data.booking.book({ startsAt: baTimestamp(WED, "09:00"), type: "kinesiologia", notes: "Traigo estudios" });
    expect(a).toMatchObject({ coachId: IDS.nico, clientId: IDS.martina, status: "pendiente", durationMin: 60, createdBy: IDS.martina });
    // Ya no está libre para otro paciente de Nico.
    await as(SOFIA);
    await expect(data.booking.book({ startsAt: baTimestamp(WED, "09:00"), type: "kinesiologia" })).rejects.toThrow(/no está disponible/);
    const busy = await data.booking.busy(IDS.nico, WED, WED);
    expect(busy.some((b) => b.startsAt === baTimestamp(WED, "09:00"))).toBe(true);
    expect(Object.keys(busy[0]!)).toEqual(["startsAt", "durationMin"]); // sin datos de otros pacientes
  });

  it("valida franja, tipo, anticipación y reservas apagadas", async () => {
    await as(MARTINA);
    await expect(data.booking.book({ startsAt: baTimestamp(WED, "13:00"), type: "kinesiologia" })).rejects.toThrow(/no está disponible/);
    await expect(data.booking.book({ startsAt: baTimestamp(WED, "09:30"), type: "kinesiologia" })).rejects.toThrow(/no está disponible/);
    await expect(data.booking.book({ startsAt: baTimestamp("2026-10-19", "10:00"), type: "kinesiologia" })).rejects.toThrow(/no está disponible/); // < 12 h
    await expect(data.booking.book({ startsAt: baTimestamp(WED, "09:00"), type: "mep_sport" })).rejects.toThrow(/tipo/);
    await as(BRUNO); // su profe (Caro) no tiene reservas online
    await expect(data.booking.book({ startsAt: baTimestamp(WED, "09:00"), type: "kinesiologia" })).rejects.toThrow(/habilitó/);
    await expect(data.booking.getSchedule(IDS.nico)).rejects.toThrow(/acceso/);
  });

  it("el profe confirma; la paciente cancela dentro del plazo y el horario se libera", async () => {
    await as(MARTINA);
    const a = await data.booking.book({ startsAt: baTimestamp(WED, "10:00"), type: "entrenamiento" });
    await as(NICO);
    const [confirmed] = await data.appointments.update(a.id, { status: "agendado" });
    expect(confirmed!.status).toBe("agendado");
    await as(SOFIA);
    await expect(data.booking.cancel(a.id)).rejects.toThrow(/Turno/);
    await as(MARTINA);
    expect((await data.booking.cancel(a.id)).status).toBe("cancelado");
    await as(SOFIA);
    expect((await data.booking.book({ startsAt: baTimestamp(WED, "10:00"), type: "entrenamiento" })).status).toBe("pendiente");
  });

  it("no se cancela pasado el plazo; con confirmación automática queda agendado", async () => {
    await as(NICO);
    const s = await data.booking.getSchedule(IDS.nico);
    const { coachId: _c, updatedAt: _u, ...settings } = s.settings;
    void _c;
    void _u;
    await data.booking.saveSchedule(IDS.nico, { settings: { ...settings, autoConfirm: true, minNoticeHours: 0 }, rules: s.rules, timeOff: s.timeOff });
    await as(MARTINA);
    const a = await data.booking.book({ startsAt: baTimestamp("2026-10-20", "08:00"), type: "kinesiologia" }); // en 24 h
    expect(a.status).toBe("agendado");
    vi.setSystemTime(new Date("2026-10-19T09:00:00-03:00")); // faltan 23 h (< 24 h)
    await expect(data.booking.cancel(a.id)).rejects.toThrow(/ya no se puede cancelar/);
  });

  it("cada profe edita solo sus horarios; el admin, los de cualquiera; con validación", async () => {
    await as(CARO);
    const input = { settings: { enabled: true, autoConfirm: false, slotMinutes: 60, minNoticeHours: 12, maxDaysAhead: 30, cancelHours: 24, types: ["kinesiologia" as const] }, rules: [{ weekday: 2, startTime: "09:00", endTime: "13:00" }], timeOff: [] };
    await expect(data.booking.saveSchedule(IDS.nico, input)).rejects.toThrow(/acceso/);
    expect((await data.booking.saveSchedule(IDS.caro, input)).rules).toHaveLength(1);
    await expect(data.booking.saveSchedule(IDS.caro, { ...input, rules: [...input.rules, { weekday: 2, startTime: "12:00", endTime: "14:00" }] })).rejects.toThrow(/se pisan/);
    await as(ADMIN);
    expect((await data.booking.saveSchedule(IDS.nico, { ...input, timeOff: [{ date: WED, reason: "Feriado" }] })).timeOff).toHaveLength(1);
    await as(MARTINA);
    await expect(data.booking.saveSchedule(IDS.nico, input)).rejects.toThrow(/acceso/);
    expect(getDb().availabilityRules.filter((r) => r.coachId === IDS.nico)).toHaveLength(1);
  });
});
