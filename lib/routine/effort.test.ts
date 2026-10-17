import { describe, expect, it } from "vitest";
import { effortLabel, normalizeRir, normalizeRpe, parseRir, parseRpe, rpeExceeded } from "./effort";

describe("rangos de RPE y RIR", () => {
  it("valor único y rangos con distintos separadores", () => {
    expect(parseRpe("7")).toEqual({ min: 7, max: 7 });
    expect(parseRpe("7-8")).toEqual({ min: 7, max: 8 });
    expect(parseRpe("7 a 8")).toEqual({ min: 7, max: 8 });
    expect(parseRpe("7–8")).toEqual({ min: 7, max: 8 });
    expect(parseRpe("7,5")).toEqual({ min: 7.5, max: 7.5 });
    expect(parseRir("1-2")).toEqual({ min: 1, max: 2 });
    expect(parseRir("0")).toEqual({ min: 0, max: 0 });
  });

  it("rechaza fuera de escala, invertidos y texto", () => {
    expect(parseRpe("0")).toBeNull();
    expect(parseRpe("11")).toBeNull();
    expect(parseRpe("8-7")).toBeNull();
    expect(parseRpe("muy duro")).toBeNull();
    expect(parseRpe("")).toBeNull();
    expect(parseRir("-1")).toBeNull();
  });

  it("normaliza para guardar", () => {
    expect(normalizeRpe(" 7 a 8 ")).toBe("7-8");
    expect(normalizeRpe("7,5")).toBe("7.5");
    expect(normalizeRir("2")).toBe("2");
    expect(normalizeRpe("duro")).toBe("duro");
  });

  it("etiqueta para la card", () => {
    expect(effortLabel({ rpeTarget: "8", rirTarget: "2" })).toBe("RPE 8 · RIR 2");
    expect(effortLabel({ rpeTarget: "7-8", rirTarget: null })).toBe("RPE 7-8");
    expect(effortLabel({ rpeTarget: null, rirTarget: null })).toBeNull();
  });

  it("alerta si el RPE real supera al tope del objetivo por 2 o más", () => {
    expect(rpeExceeded(9, "7")).toBe(true);
    expect(rpeExceeded(9, "7-8")).toBe(false);
    expect(rpeExceeded(10, "7-8")).toBe(true);
    expect(rpeExceeded(8, "7")).toBe(false);
    expect(rpeExceeded(10, null)).toBe(false);
    expect(rpeExceeded(null, "7")).toBe(false);
  });
});
