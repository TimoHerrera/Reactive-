import { describe, expect, it } from "vitest";
import { buildSeed, IDS } from "@/lib/data/seed";
import type { RoutineTree } from "@/lib/data/types";
import { buildActivity, greeting, whenLabel } from "./activity";

const NOW = new Date("2026-10-12T15:00:00");
const TODAY = "2026-10-12";
const db = buildSeed(TODAY, NOW);

const trees = new Map<string, RoutineTree>(
  db.routines.map((r) => {
    const days = db.routineDays.filter((d) => d.routineId === r.id);
    return [
      r.id,
      {
        ...r,
        days: days.map((d) => {
          const blocks = db.routineBlocks.filter((b) => b.dayId === d.id);
          return { ...d, blocks: blocks.map((b) => ({ ...b, items: db.routineItems.filter((i) => i.blockId === b.id) })) };
        }),
      },
    ];
  }),
);

const activity = buildActivity({
  clients: db.profiles.filter((p) => p.role === "client"),
  routines: db.routines,
  trees,
  sessions: db.workoutSessions,
  checks: db.itemChecks,
  views: db.exerciseViews,
  exerciseNames: new Map(db.exercises.map((e) => [e.id, e.name])),
  now: NOW,
});
const text = (i: (typeof activity)[number]) => i.parts.map((p) => p.text).join("");

describe("actividad reciente (seed del diseño)", () => {
  it("Martina completó el Día A (9/9 · hace 2 h)", () => {
    const it = activity.find((a) => a.kind === "completada" && a.clientId === IDS.martina && text(a).includes("Día A"))!;
    expect(text(it)).toBe("Martina G. completó el Día A");
    expect(it.sub).toBe("9/9 ejercicios · hace 2 h");
  });

  it("Tomás marcó parcial en el Día B", () => {
    const it = activity.find((a) => a.kind === "parcial" && a.clientId === IDS.tomas)!;
    expect(text(it)).toMatch(/^Tomás L\. marcó 3 de \d+ en el Día B$/);
    expect(it.sub).toBe("hace 4 h");
  });

  it("rutinas por vencer con el día", () => {
    const sofia = activity.find((a) => a.kind === "vence" && a.clientId === IDS.sofia)!;
    expect(text(sofia)).toBe("La rutina de Sofía R. vence el viernes");
    expect(sofia.sub).toBe("Postquirúrgico · LCA – Fase 3");
  });

  it("Joaquín vio «Nordic hamstring» 3 veces", () => {
    const it = activity.find((a) => a.kind === "vistas")!;
    expect(text(it)).toBe("Joaquín M. vio «Nordic hamstring» 3 veces");
    expect(it.sub).toBe("Ayer · ¿dudas con la técnica?");
  });

  it("ordena de lo más reciente a lo más viejo y limita", () => {
    expect(activity.length).toBeLessThanOrEqual(8);
    expect(activity[0]!.kind).toBe("completada");
  });
});

describe("textos", () => {
  it("whenLabel", () => {
    expect(whenLabel("2026-10-12", TODAY)).toBe("hoy");
    expect(whenLabel("2026-10-13", TODAY)).toBe("mañana");
    expect(whenLabel("2026-10-15", TODAY)).toBe("el jueves");
    expect(whenLabel("2026-10-30", TODAY)).toBe("el 30/10");
  });
  it("greeting", () => {
    expect(greeting("Nico", NOW)).toBe("Buen lunes, Nico.");
  });
});
