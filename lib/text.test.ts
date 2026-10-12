import { describe, expect, it } from "vitest";
import { normalizeHeader, normalizeText } from "./text";

describe("normalizeText", () => {
  it("saca acentos, mayúsculas y puntuación", () => {
    expect(normalizeText("RDL c/ Mancuernas")).toBe("rdl c mancuernas");
    expect(normalizeText("  Copenhague. ")).toBe("copenhague");
    expect(normalizeText("Estocada búlgara")).toBe("estocada bulgara");
    expect(normalizeText("Curl nórdico")).toBe("curl nordico");
  });
});

describe("normalizeHeader", () => {
  it("normaliza encabezados", () => {
    expect(normalizeHeader("  Día ")).toBe("dia");
    expect(normalizeHeader("DESCANSO")).toBe("descanso");
    expect(normalizeHeader("Ejercicio   principal")).toBe("ejercicio principal");
  });
});
