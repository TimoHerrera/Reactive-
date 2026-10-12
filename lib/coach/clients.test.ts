import { describe, expect, it } from "vitest";
import { buildSeed, IDS } from "@/lib/data/seed";
import { matchesClient, routineProgress, summarizeClient } from "./clients";

const TODAY = "2026-10-11";
const db = buildSeed(TODAY, new Date("2026-10-11T15:00:00"));
const sum = (id: string) =>
  summarizeClient(db.profiles.find((p) => p.id === id)!, db.routines.filter((r) => r.clientId === id), TODAY);

describe("resumen de cliente (subtítulos del diseño)", () => {
  it("activa: caso · rutina", () => {
    expect(sum(IDS.martina)).toMatchObject({ filter: "activa", subtitle: "Lesión deportiva · Readaptación – Fase 2" });
    expect(sum(IDS.tomas).subtitle).toBe("Rendimiento · Pretemporada rugby");
  });
  it("por vencer: caso · detalle · vence jue 15/10", () => {
    expect(sum(IDS.sofia)).toMatchObject({ filter: "por-vencer", subtitle: "Postquirúrgico · LCA Fase 3 · vence jue 15/10" });
    expect(sum(IDS.valentina).subtitle).toBe("Lesión deportiva · Hombro · vence vie 16/10");
  });
  it("sin rutina: caso · detalle", () => {
    expect(sum(IDS.lucas)).toMatchObject({ filter: "sin-rutina", subtitle: "Rendimiento · Evaluación pendiente" });
  });
  it("busca por nombre, objetivo o caso sin acentos", () => {
    expect(matchesClient(sum(IDS.martina), "futbol")).toBe(true);
    expect(matchesClient(sum(IDS.sofia), "lca")).toBe(true);
    expect(matchesClient(sum(IDS.sofia), "postquirurgico")).toBe(true);
    expect(matchesClient(sum(IDS.martina), "rugby")).toBe(false);
  });
  it("progreso de sesiones de la rutina", () => {
    const fase2 = db.routines[0]!;
    expect(routineProgress(fase2, db.workoutSessions)).toEqual({ done: 3, planned: 12, weeks: 4 });
  });
});
