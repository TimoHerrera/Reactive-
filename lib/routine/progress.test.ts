import { describe, expect, it } from "vitest";
import type { DayTree, RoutineTree, WorkoutSession } from "@/lib/data/types";
import { dayProgress, estimateMinutes, parseSeconds, sessionForDay, suggestedDay, todayLine, weekSummary } from "./progress";

// Lunes 12/10/2026 → semana del 12 al 18.
const TODAY = "2026-10-14"; // miércoles
const at = (date: string, h = 10) => new Date(`${date}T${String(h).padStart(2, "0")}:00:00`).toISOString();

const day = (id: string, label: string, n: number, title = "Tren inferior"): DayTree => ({
  id,
  routineId: "r",
  label,
  title,
  position: 0,
  blocks: [
    {
      id: `b-${id}`,
      dayId: id,
      name: "Bloque principal",
      position: 0,
      items: Array.from({ length: n }, (_, i) => ({
        id: `${id}-i${i}`,
        blockId: `b-${id}`,
        exerciseId: null,
        rawName: `Ej ${i}`,
        position: i,
        sets: 3,
        reps: "10",
        load: null,
        rest: "60 s",
        tempo: null,
        rpeTarget: null,
        rirTarget: null,
        notes: null,
      })),
    },
  ],
});

const tree: RoutineTree = {
  id: "r",
  name: "R",
  clientId: "c",
  isTemplate: false,
  sourceTemplateId: null,
  startsOn: "2026-09-29",
  endsOn: "2026-10-26",
  daysPerWeek: 3,
  clientMessage: null,
  createdBy: null,
  updatedBy: null,
  updatedAt: null,
  publishedAt: at("2026-09-28"),
  createdAt: at("2026-09-28"),
  days: [day("A", "A", 9), day("B", "B", 6, "Agilidad"), day("C", "C", 5)],
};

const s = (id: string, dayId: string, started: string, completed: string | null = null): WorkoutSession => ({
  id,
  clientId: "c",
  routineId: "r",
  dayId,
  startedAt: started,
  completedAt: completed,
});

describe("weekSummary", () => {
  it("cuenta sesiones completadas de esta semana y marca los puntos", () => {
    const sessions = [
      s("1", "A", at("2026-10-12"), at("2026-10-12", 11)), // lunes
      s("2", "B", at("2026-10-07"), at("2026-10-07", 11)), // semana pasada
      s("3", "B", at("2026-10-14", 8)), // hoy, sin completar
    ];
    const w = weekSummary(tree, sessions, TODAY);
    expect(w.completed).toBe(1);
    expect(w.target).toBe(3);
    expect(w.dots.map((d) => d.state)).toEqual(["done", "none", "today", "none", "none", "none", "none"]);
  });
});

describe("sessionForDay y dayProgress", () => {
  it("usa la sesión más reciente de la semana", () => {
    const sessions = [s("old", "A", at("2026-10-05")), s("new", "A", at("2026-10-13"))];
    expect(sessionForDay(sessions, "A", TODAY)?.id).toBe("new");
    expect(sessionForDay(sessions, "B", TODAY)).toBeNull();
  });
  it("«2 de 9 hechos»", () => {
    const checks = [
      { sessionId: "x", itemId: "A-i0", checkedAt: "" },
      { sessionId: "x", itemId: "A-i1", checkedAt: "" },
      { sessionId: "otra", itemId: "A-i2", checkedAt: "" },
    ];
    expect(dayProgress(tree.days[0]!, checks, "x")).toEqual({ done: 2, total: 9 });
    expect(dayProgress(tree.days[0]!, checks, null)).toEqual({ done: 0, total: 9 });
  });
});

describe("suggestedDay", () => {
  it("el primer día no completado de la semana", () => {
    const sessions = [s("1", "A", at("2026-10-12"), at("2026-10-12", 11))];
    expect(suggestedDay(tree, sessions, TODAY)?.label).toBe("B");
  });
  it("si hoy hay uno empezado, ese", () => {
    const sessions = [s("1", "C", at(TODAY, 8))];
    expect(suggestedDay(tree, sessions, TODAY)?.label).toBe("C");
  });
  it("semana completa → Día A", () => {
    const sessions = ["A", "B", "C"].map((d, i) => s(d, d, at("2026-10-12"), at(`2026-10-1${2 + i}`)));
    expect(suggestedDay(tree, sessions, TODAY)?.label).toBe("A");
  });
});

describe("helpers", () => {
  it("parseSeconds", () => {
    expect(parseSeconds("90 s")).toBe(90);
    expect(parseSeconds("2 min")).toBe(120);
    expect(parseSeconds("1:30")).toBe(90);
    expect(parseSeconds("45")).toBe(45);
    expect(parseSeconds("—")).toBeNull();
  });
  it("estimateMinutes da un número razonable y múltiplo de 5", () => {
    const m = estimateMinutes(tree.days[0]!);
    expect(m % 5).toBe(0);
    expect(m).toBeGreaterThanOrEqual(30);
    expect(m).toBeLessThanOrEqual(60);
  });
  it("todayLine", () => {
    expect(todayLine(tree.days[0]!)).toBe("Hoy toca tren inferior. ¡No faltes!");
    expect(todayLine({ ...tree.days[0]!, title: "Agilidad + tren sup." })).toBe("Hoy toca agilidad + tren sup. ¡No faltes!");
  });
});

describe("semana a semana", () => {
  it("lo que completó una semana no cuenta para la siguiente: el lunes todo arranca sin hacer", () => {
    // Semana del 12 al 18: hace los 3 días (el último, el domingo 18 a la noche).
    const sessions = [
      s("a", "A", at("2026-10-12"), at("2026-10-12", 11)),
      s("b", "B", at("2026-10-15"), at("2026-10-15", 11)),
      s("c", "C", at("2026-10-18", 21), at("2026-10-18", 22)),
    ];
    const checks = tree.days.flatMap((d, i) => d.blocks[0]!.items.map((it) => ({ sessionId: ["a", "b", "c"][i]!, itemId: it.id, checkedAt: "" })));

    // Domingo: semana completa.
    const sunday = "2026-10-18";
    expect(weekSummary(tree, sessions, sunday).completed).toBe(3);
    expect(dayProgress(tree.days[2]!, checks, sessionForDay(sessions, "C", sunday)?.id ?? null)).toEqual({ done: 5, total: 5 });

    // Lunes siguiente: nada hecho todavía, se sugiere el Día A.
    const monday = "2026-10-19";
    expect(weekSummary(tree, sessions, monday).completed).toBe(0);
    for (const d of tree.days) {
      const session = sessionForDay(sessions, d.id, monday);
      expect(session).toBeNull();
      expect(dayProgress(d, checks, session?.id ?? null).done).toBe(0);
    }
    expect(suggestedDay(tree, sessions, monday)?.label).toBe("A");
    // El historial no se borra (lo ve el profe).
    expect(sessions).toHaveLength(3);
  });
});
