// @vitest-environment happy-dom
// Agenda: cada profe ve y edita solo los turnos de sus pacientes; el admin, todos; el paciente, los suyos
// (mismas reglas que RLS en 0010_agenda.sql).
import { beforeEach, describe, expect, it } from "vitest";
import { baDate, baTimestamp, baToday } from "@/lib/agenda/time";
import { addDays } from "@/lib/dates";
import { DEMO_PASSWORD, IDS } from "@/lib/data/seed";
import { mockDataSource as data } from "./index";
import { getDb, resetMockDb } from "./store";

const as = async (email: string) => {
  await data.auth.signOut();
  expect(await data.auth.signIn(email, DEMO_PASSWORD)).toMatchObject({ ok: true });
};
const MARTINA = "martina@reactive.test";
const NICO = "nico@reactive.test";
const CARO = "caro@reactive.test";
const ADMIN = "admin@reactive.test";
const inAWeek = (time: string) => baTimestamp(addDays(baToday(), 9), time);

beforeEach(async () => {
  await data.auth.signOut();
  resetMockDb();
});

describe("visibilidad por profe", () => {
  it("Nico ve los de sus pacientes, Caro solo los de Bruno, el admin todos", async () => {
    const total = getDb().appointments.length;
    await as(NICO);
    const nico = await data.appointments.list();
    expect(nico.length).toBeGreaterThan(0);
    expect(nico.some((a) => a.clientId === IDS.bruno)).toBe(false);
    await as(CARO);
    expect(new Set((await data.appointments.list()).map((a) => a.clientId))).toEqual(new Set([IDS.bruno]));
    await as(ADMIN);
    expect(await data.appointments.list()).toHaveLength(total);
  });

  it("el paciente ve solo los suyos", async () => {
    await as(MARTINA);
    const mine = await data.appointments.list();
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((a) => a.clientId === IDS.martina)).toBe(true);
  });

  it("filtro por fechas de Buenos Aires (inclusive)", async () => {
    await as(NICO);
    const today = baToday();
    const list = await data.appointments.list({ from: today, to: today });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => baDate(a.startsAt) === today)).toBe(true);
  });
});

describe("alta y edición", () => {
  it("Nico agenda una serie para Martina (a su nombre, aunque mande otro profe)", async () => {
    await as(NICO);
    const created = await data.appointments.create(
      { clientId: IDS.martina, coachId: IDS.caro, startsAt: inAWeek("09:00"), durationMin: 45, type: "entrenamiento", notes: null },
      { weekdays: [1, 3, 5], weeks: 2 },
    );
    expect(created.length).toBeGreaterThanOrEqual(3);
    expect(created.every((a) => a.coachId === IDS.nico && a.seriesId === created[0]!.seriesId)).toBe(true);
  });

  it("Nico no puede agendar ni editar a un paciente de Caro", async () => {
    await as(NICO);
    await expect(
      data.appointments.create({ clientId: IDS.bruno, coachId: IDS.nico, startsAt: inAWeek("10:00"), durationMin: 60, type: "kinesiologia", notes: null }),
    ).rejects.toThrow();
    const brunos = getDb().appointments.find((a) => a.clientId === IDS.bruno)!;
    await expect(data.appointments.update(brunos.id, { status: "cancelado" })).rejects.toThrow();
  });

  it("el paciente no puede crear turnos", async () => {
    await as(MARTINA);
    await expect(
      data.appointments.create({ clientId: IDS.martina, coachId: IDS.nico, startsAt: inAWeek("10:00"), durationMin: 60, type: "kinesiologia", notes: null }),
    ).rejects.toThrow();
  });

  it("el paciente pide reprogramar y el profe lo ve; mover el turno lo vuelve a «agendado»", async () => {
    await as(MARTINA);
    const next = (await data.appointments.list()).find((a) => a.status === "agendado" && new Date(a.startsAt) > new Date())!;
    const req = await data.appointments.requestReschedule(next.id, { reason: "Viaje", preference: "Viernes a la mañana" });
    expect(req).toMatchObject({ status: "reprogramacion_pedida", rescheduleReason: "Viaje", reschedulePreference: "Viernes a la mañana" });
    await expect(data.appointments.requestReschedule(next.id, { reason: "x", preference: "y" })).rejects.toThrow();

    await as(NICO);
    const pedidos = (await data.appointments.list()).filter((a) => a.status === "reprogramacion_pedida");
    expect(pedidos.map((a) => a.id)).toContain(next.id);
    const [moved] = await data.appointments.update(next.id, { startsAt: baTimestamp(addDays(baDate(next.startsAt), 1), "09:00") });
    expect(moved).toMatchObject({ status: "agendado", rescheduleReason: null });
  });

  it("un paciente no puede pedir reprogramar un turno ajeno", async () => {
    const tomas = getDb().appointments.find((a) => a.clientId === IDS.tomas)!;
    await as(MARTINA);
    await expect(data.appointments.requestReschedule(tomas.id, { reason: "x", preference: "y" })).rejects.toThrow();
  });
});
