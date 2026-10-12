import { describe, expect, it } from "vitest";
import { clientRoutineFilter, routineStatus } from "./status";
import type { Routine } from "@/lib/data/types";

const base: Routine = {
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
  publishedAt: "2026-09-28T12:00:00Z",
  createdAt: "2026-09-28T12:00:00Z",
};

describe("routineStatus", () => {
  it("activa dentro de la vigencia", () => {
    expect(routineStatus(base, "2026-10-11")).toBe("activa");
  });
  it("por vencer a 7 días o menos", () => {
    expect(routineStatus(base, "2026-10-19")).toBe("por-vencer");
    expect(routineStatus(base, "2026-10-26")).toBe("por-vencer");
    expect(routineStatus(base, "2026-10-18")).toBe("activa");
  });
  it("vencida después del fin", () => {
    expect(routineStatus(base, "2026-10-27")).toBe("vencida");
  });
  it("plantilla, borrador y programada", () => {
    expect(routineStatus({ ...base, isTemplate: true }, "2026-10-11")).toBe("plantilla");
    expect(routineStatus({ ...base, publishedAt: null }, "2026-10-11")).toBe("borrador");
    expect(routineStatus(base, "2026-09-20")).toBe("programada");
  });
});

describe("clientRoutineFilter", () => {
  it("sin rutina, activa o por vencer", () => {
    expect(clientRoutineFilter([], "2026-10-11")).toBe("sin-rutina");
    expect(clientRoutineFilter([base], "2026-10-11")).toBe("activa");
    expect(clientRoutineFilter([{ ...base, endsOn: "2026-10-15" }], "2026-10-11")).toBe("por-vencer");
    expect(clientRoutineFilter([{ ...base, endsOn: "2026-10-01" }], "2026-10-11")).toBe("sin-rutina");
  });
});
