import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/data/seed";
import { exerciseMeta, formatDuration, groupByRegion, inRegion, searchExercises } from "./exercises";

const { exercises } = buildSeed("2026-10-11");
const names = (q: string) => searchExercises(exercises, q).map((h) => h.exercise.name);

describe("searchExercises", () => {
  it("busca por nombre sin acentos ni mayúsculas", () => {
    expect(names("bulgara")).toEqual(["Estocada búlgara"]);
    expect(names("SENTADILLA")[0]).toBe("Sentadilla goblet");
  });

  it("busca por alias e informa cuál matcheó", () => {
    const [hit] = searchExercises(exercises, "rdl");
    expect(hit!.exercise.name).toBe("Peso muerto rumano");
    expect(hit!.matchedAlias).toBe("RDL");
    expect(names("curl nordico")).toContain("Nordic hamstring");
  });

  it("busca por músculo", () => {
    const res = names("isquiotibiales");
    expect(res).toContain("Nordic hamstring");
    expect(res).toContain("Peso muerto rumano");
  });

  it("requiere todas las palabras", () => {
    expect(names("sentadilla banco")).toEqual(["Sentadilla unipodal al banco"]);
  });

  it("prioriza coincidencias en el nombre", () => {
    expect(names("nordic")[0]).toBe("Nordic hamstring");
  });

  it("sin búsqueda devuelve todo", () => {
    expect(searchExercises(exercises, "  ")).toHaveLength(exercises.length);
  });
});

describe("helpers", () => {
  it("formatDuration", () => {
    expect(formatDuration(31)).toBe("0:31");
    expect(formatDuration(65.4)).toBe("1:05");
    expect(formatDuration(null)).toBe("");
  });

  it("exerciseMeta", () => {
    const rdl = exercises.find((e) => e.name === "Peso muerto rumano")!;
    expect(exerciseMeta(rdl)).toBe("Fuerza · Isquios · Mancuernas");
  });

  it("inRegion", () => {
    const goblet = exercises.find((e) => e.name === "Sentadilla goblet")!;
    expect(inRegion(goblet, "Piernas")).toBe(true);
    expect(inRegion(goblet, "Tren superior")).toBe(false);
  });
});

describe("zonas (biblioteca del profe)", () => {
  const it_ = (...m: string[]) => ({ exercise: { muscleGroups: m } });

  it("secciones en el orden de los chips, sin vacías; los que no tienen zona van a «Otros»", () => {
    const groups = groupByRegion([it_("Core"), it_("Cuádriceps"), it_("Gemelos"), it_()]);
    expect(groups.map((g) => [g.region, g.items.length])).toEqual([
      ["Piernas", 2],
      ["Core", 1],
      ["Otros", 1],
    ]);
  });

  it("un ejercicio aparece en cada zona que trabaja, y cada sección cuenta lo mismo que su chip", () => {
    const hipThrust = it_("Glúteos", "Isquiotibiales");
    const groups = groupByRegion([hipThrust]);
    expect(groups.map((g) => g.region)).toEqual(["Piernas", "Glúteos"]);

    const db = buildSeed("2026-10-11");
    const items = db.exercises.map((e) => ({ exercise: e }));
    for (const g of groupByRegion(items)) {
      if (g.region === "Otros") continue;
      expect(g.items.length).toBe(db.exercises.filter((e) => inRegion(e, g.region as Exclude<typeof g.region, "Otros">)).length);
    }
    expect(groupByRegion(items).some((g) => g.region === "Otros")).toBe(false); // todo el seed tiene zona
  });
});
