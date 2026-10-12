import { describe, expect, it } from "vitest";
import { buildSeed, IDS } from "./seed";
import { clientRoutineFilter, currentRoutine } from "@/lib/routine/status";
import { hasVideo } from "./types";

const TODAY = "2026-10-11";
const db = buildSeed(TODAY, new Date("2026-10-11T15:00:00-03:00"));

describe("seed", () => {
  it("tiene los 8 clientes del diseño con sus filtros (4 activas, 2 por vencer, 2 sin rutina)", () => {
    const clients = db.profiles.filter((p) => p.role === "client");
    expect(clients).toHaveLength(8);
    const count = { activa: 0, "por-vencer": 0, "sin-rutina": 0 };
    for (const c of clients) count[clientRoutineFilter(db.routines.filter((r) => r.clientId === c.id), TODAY)]++;
    expect(count).toEqual({ activa: 4, "por-vencer": 2, "sin-rutina": 2 });
  });

  it("Martina tiene «Readaptación – Fase 2» vigente 29/9 → 26/10 con Días A/B/C", () => {
    const cur = currentRoutine(db.routines.filter((r) => r.clientId === IDS.martina), TODAY)!;
    expect(cur.name).toBe("Readaptación – Fase 2");
    expect(cur.startsOn).toBe("2026-09-29");
    expect(cur.endsOn).toBe("2026-10-26");
    const days = db.routineDays.filter((d) => d.routineId === cur.id).map((d) => d.label);
    expect(days).toEqual(["A", "B", "C"]);
  });

  it("el Día A de Martina tiene 9 ejercicios", () => {
    const dayA = db.routineDays.find((d) => d.routineId === db.routines[0]!.id && d.label === "A")!;
    const blocks = db.routineBlocks.filter((b) => b.dayId === dayA.id).map((b) => b.id);
    expect(db.routineItems.filter((i) => blocks.includes(i.blockId))).toHaveLength(9);
  });

  it("ejercicios con alias del diseño y algunos sin video", () => {
    const byName = (n: string) => db.exercises.find((e) => e.name === n)!;
    expect(byName("Nordic hamstring").aliases).toEqual(["Nordic", "Nordic curl", "Curl nórdico"]);
    expect(byName("Peso muerto rumano").aliases).toContain("RDL");
    expect(hasVideo(byName("Activación de tobillo con banda"))).toBe(false);
    expect(db.exercises.length).toBeGreaterThanOrEqual(15);
    expect(db.exercises.some((e) => e.name === "Salto al cajón unipodal")).toBe(false);
  });

  it("ids únicos y referencias válidas", () => {
    const ids = [...db.profiles, ...db.exercises, ...db.routines, ...db.routineDays, ...db.routineBlocks, ...db.routineItems].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const exIds = new Set(db.exercises.map((e) => e.id));
    expect(db.routineItems.every((i) => i.exerciseId === null || exIds.has(i.exerciseId))).toBe(true);
  });
});
