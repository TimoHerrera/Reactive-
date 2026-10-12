import { describe, expect, it } from "vitest";
import type { Routine } from "@/lib/data/types";
import { replacementInfo } from "./replace";

const TODAY = "2026-10-11";
const r = (p: Partial<Routine>): Routine => ({
  id: "r",
  name: "Fase 1",
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
  ...p,
});

describe("replacementInfo", () => {
  it("sin rutina", () => {
    expect(replacementInfo([], TODAY)).toMatchObject({ kind: "none", note: "Sin rutina" });
  });
  it("vencida (como en el diseño: «Reemplaza a «Fase 1» (vencida)»)", () => {
    const info = replacementInfo([r({ startsOn: "2026-09-01", endsOn: "2026-09-28" })], TODAY);
    expect(info.kind).toBe("expired");
    expect(info.note).toBe("Reemplaza a «Fase 1» (vencida)");
  });
  it("por vencer («Rutina vence jue 15/10»)", () => {
    const info = replacementInfo([r({ endsOn: "2026-10-15" })], TODAY);
    expect(info.kind).toBe("expiring");
    expect(info.note).toBe("Rutina vence jue 15/10");
  });
  it("activa", () => {
    const info = replacementInfo([r({ name: "Fase 2" })], TODAY);
    expect(info.kind).toBe("active");
    expect(info.note).toBe("Reemplaza a «Fase 2» (vigente hasta 26/10)");
  });
  it("ignora la rutina que se está editando y las plantillas o borradores", () => {
    const list = [r({ id: "edit" }), r({ id: "tpl", isTemplate: true }), r({ id: "draft", publishedAt: null })];
    expect(replacementInfo(list, TODAY, "edit").kind).toBe("none");
  });
});
