import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/data/seed";
import { exerciseMeta, formatDuration, inRegion, searchExercises } from "./exercises";

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
