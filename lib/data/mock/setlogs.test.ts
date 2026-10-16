// @vitest-environment happy-dom
// Registro real por serie («¿Cómo te fue?»): lo escribe solo el cliente; lo leen él, su profe y el admin
// (mismas reglas que RLS en 0009_planificador.sql).
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PASSWORD, IDS } from "@/lib/data/seed";
import { cleanSetLogs, draftSetLogs, summarizeSession } from "@/lib/routine/setlogs";
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

/** Sesión de hoy de Martina (Día A) y su primer ejercicio sin registro. */
const fixture = () => {
  const db = getDb();
  const logged = new Set(db.setLogs.map((l) => l.itemId));
  const session = db.workoutSessions.find((s) => s.clientId === IDS.martina && db.setLogs.some((l) => l.sessionId === s.id))!;
  const dayBlocks = new Set(db.routineBlocks.filter((b) => b.dayId === session.dayId).map((b) => b.id));
  const item = db.routineItems.find((i) => dayBlocks.has(i.blockId) && !logged.has(i.id))!;
  return { session, item };
};

beforeEach(async () => {
  await data.auth.signOut();
  resetMockDb();
});

describe("guardado de set_logs", () => {
  it("la clienta guarda su registro y lo puede corregir (reemplaza, no duplica)", async () => {
    await as(MARTINA);
    const { session, item } = fixture();
    const rows = draftSetLogs({ sets: 3, reps: "10", load: "Banda" });
    rows[0]!.rpe = 6;
    rows[0]!.note = "  Bien  ";
    const saved = await data.sessions.saveSetLogs(session.id, item.id, rows);
    expect(saved).toHaveLength(3);
    expect(saved[0]).toMatchObject({ setNumber: 1, reps: "10", load: "Banda", rpe: 6, note: "Bien" });

    await data.sessions.saveSetLogs(session.id, item.id, [{ setNumber: 1, reps: "8", load: "Banda", rpe: 7, note: null }]);
    const mine = (await data.sessions.listSetLogs([session.id])).filter((l) => l.itemId === item.id);
    expect(mine).toEqual([expect.objectContaining({ setNumber: 1, reps: "8", rpe: 7 })]);
  });

  it("el profe (ni en «Ver como») no puede escribir el registro", async () => {
    const { session, item } = fixture();
    await as(NICO);
    await expect(data.sessions.saveSetLogs(session.id, item.id, draftSetLogs({ sets: 1, reps: "5", load: null }))).rejects.toThrow();
  });

  it("lo leen la clienta, su profe y el admin; otro profe no ve nada", async () => {
    const { session } = fixture();
    for (const who of [MARTINA, NICO, ADMIN]) {
      await as(who);
      expect((await data.sessions.listSetLogs([session.id])).length).toBeGreaterThan(0);
    }
    await as(CARO);
    expect(await data.sessions.listSetLogs([session.id])).toEqual([]);
  });

  it("la demo trae la alerta: goblet con RPE 9 y objetivo 7", async () => {
    await as(NICO);
    const { session } = fixture();
    const logs = await data.sessions.listSetLogs([session.id]);
    const items = getDb().routineItems.filter((i) => logs.some((l) => l.itemId === i.id));
    const summary = summarizeSession(items, logs);
    expect(summary.filter((s) => s.alert).map((s) => s.maxRpe)).toEqual([9]);
  });
});

describe("filas del panel", () => {
  it("una por serie, precargadas con lo planificado", () => {
    expect(draftSetLogs({ sets: 3, reps: "8", load: "16 kg" })).toEqual([
      { setNumber: 1, reps: "8", load: "16 kg", rpe: null, note: null },
      { setNumber: 2, reps: "8", load: "16 kg", rpe: null, note: null },
      { setNumber: 3, reps: "8", load: "16 kg", rpe: null, note: null },
    ]);
  });

  it("si ya había registro, lo muestra para corregir", () => {
    const prev = [{ sessionId: "s", itemId: "i", setNumber: 1, reps: "6", load: "18 kg", rpe: 9, note: "Pesado", createdAt: "" }];
    expect(draftSetLogs({ sets: 2, reps: "8", load: "16 kg" }, prev)[0]).toEqual({ setNumber: 1, reps: "6", load: "18 kg", rpe: 9, note: "Pesado" });
  });

  it("limpia antes de guardar: RPE fuera de 1–10 → vacío, series renumeradas", () => {
    expect(
      cleanSetLogs([
        { setNumber: 5, reps: " 8 ", load: "", rpe: 11, note: "" },
        { setNumber: 9, reps: "8", load: "16", rpe: 7.4, note: null },
      ]),
    ).toEqual([
      { setNumber: 1, reps: "8", load: null, rpe: null, note: null },
      { setNumber: 2, reps: "8", load: "16", rpe: 7, note: null },
    ]);
  });
});
