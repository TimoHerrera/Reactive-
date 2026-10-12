import { describe, expect, it } from "vitest";
import { buildSeed, IDS } from "@/lib/data/seed";
import {
  addDay,
  addItem,
  blankItem,
  daysLostWith,
  draftStats,
  draftToTree,
  duplicateDay,
  emptyDraft,
  endFromWeeks,
  itemSummary,
  moveItem,
  removeDay,
  removeItem,
  setDaysPerWeek,
  treeToDraft,
  updateItem,
  validateData,
  validateDays,
} from "./draft";
import { routineStatus } from "./status";

const TODAY = "2026-09-29";
const db = buildSeed("2026-10-11");
const ex = (name: string) => db.exercises.find((e) => e.name === name)!;

describe("fechas y días", () => {
  it("atajos de semanas: 29/9 + 4 semanas = 26/10", () => {
    expect(endFromWeeks("2026-09-29", 4)).toBe("2026-10-26");
    expect(endFromWeeks("2026-09-29", 2)).toBe("2026-10-12");
  });

  it("borrador vacío: Día A, B y C con bloques por defecto", () => {
    const d = emptyDraft(TODAY);
    expect(d.days.map((x) => x.label)).toEqual(["A", "B", "C"]);
    expect(d.days[0]!.blocks.map((b) => b.name)).toEqual(["Entrada en calor", "Bloque principal", "Accesorios"]);
    expect(d.endsOn).toBe("2026-10-26");
  });

  it("días por semana crea y quita del final, y avisa qué se pierde", () => {
    let d = emptyDraft(TODAY);
    d = setDaysPerWeek(d, 5);
    expect(d.days.map((x) => x.label)).toEqual(["A", "B", "C", "D", "E"]);
    const e = d.days[4]!;
    d = addItem(d, e.key, e.blocks[1]!.key, blankItem(ex("Hip thrust")));
    expect(daysLostWith(d, 3).map((x) => x.label)).toEqual(["E"]);
    d = setDaysPerWeek(d, 2);
    expect(d.days.map((x) => x.label)).toEqual(["A", "B"]);
    expect(d.daysPerWeek).toBe(2);
  });

  it("+ Día, quitar día (reetiqueta) y duplicar día", () => {
    let d = emptyDraft(TODAY);
    const a = d.days[0]!;
    d = addItem(d, a.key, a.blocks[1]!.key, blankItem(ex("Sentadilla goblet")));
    d = duplicateDay(d, a.key);
    expect(d.days.map((x) => x.label)).toEqual(["A", "B", "C", "D"]);
    expect(d.days[3]!.blocks[1]!.items[0]!.rawName).toBe("Sentadilla goblet");
    expect(d.days[3]!.blocks[1]!.items[0]!.key).not.toBe(d.days[0]!.blocks[1]!.items[0]!.key);
    d = removeDay(d, d.days[1]!.key);
    expect(d.days.map((x) => x.label)).toEqual(["A", "B", "C"]);
    d = addDay(d);
    expect(d.days).toHaveLength(4);
  });
});

describe("ítems", () => {
  it("agregar, editar, mover entre bloques y quitar", () => {
    let d = emptyDraft(TODAY);
    const day = d.days[0]!;
    const [warm, main] = day.blocks;
    const i1 = blankItem(ex("Sentadilla goblet"));
    const i2 = blankItem(ex("Peso muerto rumano"));
    const i3 = blankItem(null, "Salto al cajón unipodal");
    d = addItem(d, day.key, main!.key, i1);
    d = addItem(d, day.key, main!.key, i2);
    d = addItem(d, day.key, warm!.key, i3);
    d = updateItem(d, day.key, i1.key, { sets: 4, reps: "8", load: "16 kg" });
    expect(itemSummary(d.days[0]!.blocks[1]!.items[0]!)).toBe("4 × 8 · 16 kg");

    // reordenar dentro del bloque
    d = moveItem(d, day.key, i2.key, main!.key, 0);
    expect(d.days[0]!.blocks[1]!.items.map((x) => x.rawName)).toEqual(["Peso muerto rumano", "Sentadilla goblet"]);
    // mover a otro bloque
    d = moveItem(d, day.key, i3.key, main!.key, 1);
    expect(d.days[0]!.blocks[0]!.items).toHaveLength(0);
    expect(d.days[0]!.blocks[1]!.items.map((x) => x.rawName)).toEqual([
      "Peso muerto rumano",
      "Salto al cajón unipodal",
      "Sentadilla goblet",
    ]);
    d = removeItem(d, day.key, i3.key);
    expect(d.days[0]!.blocks[1]!.items).toHaveLength(2);
  });
});

describe("validación y estadísticas", () => {
  it("valida nombre, fechas y días vacíos", () => {
    const d = emptyDraft(TODAY);
    expect(validateData(d).name).toBeTruthy();
    expect(validateData({ ...d, name: "X", endsOn: "2026-09-01" }).dates).toBeTruthy();
    expect(validateData({ ...d, name: "X" })).toEqual({});
    expect(validateDays(d).items).toBe("Día A, Día B, Día C no tiene ejercicios.");
  });

  it("cuenta ejercicios y cuántos tienen video", () => {
    let d = emptyDraft(TODAY);
    const day = d.days[0]!;
    d = addItem(d, day.key, day.blocks[1]!.key, blankItem(ex("Sentadilla goblet")));
    d = addItem(d, day.key, day.blocks[1]!.key, blankItem(ex("Activación de tobillo con banda")));
    d = addItem(d, day.key, day.blocks[1]!.key, blankItem(null, "Salto al cajón unipodal"));
    expect(draftStats(d, db.exercises)).toEqual({ days: 3, items: 3, withVideo: 1, unlinked: 1 });
  });
});

describe("conversión árbol ↔ borrador", () => {
  const fase2 = (() => {
    const r = db.routines[0]!;
    const days = db.routineDays.filter((x) => x.routineId === r.id);
    return {
      ...r,
      days: days.map((day) => {
        const blocks = db.routineBlocks.filter((b) => b.dayId === day.id);
        return { ...day, blocks: blocks.map((b) => ({ ...b, items: db.routineItems.filter((i) => i.blockId === b.id) })) };
      }),
    };
  })();

  it("editar conserva ids, cliente y fechas", () => {
    const d = treeToDraft(fase2, "edit");
    expect(d.routineId).toBe(fase2.id);
    expect(d.clientIds).toEqual([IDS.martina]);
    expect(d.startsOn).toBe(fase2.startsOn);
    const t = draftToTree(d, { clientId: IDS.martina, isTemplate: false, publishedAt: fase2.publishedAt, routineId: d.routineId, keepIds: true });
    expect(t.days[0]!.id).toBe(fase2.days[0]!.id);
    expect(t.days[0]!.blocks[0]!.items[0]!.id).toBe(fase2.days[0]!.blocks[0]!.items[0]!.id);
  });

  it("duplicar crea contenido nuevo sin cliente y con «(copia)»", () => {
    const d = treeToDraft(fase2, "duplicate", TODAY);
    expect(d.name).toBe("Readaptación – Fase 2 (copia)");
    expect(d.clientIds).toEqual([]);
    expect(d.startsOn).toBe(TODAY);
    expect(d.endsOn).toBe("2026-10-26"); // misma duración (4 semanas)
    const t = draftToTree(d, { clientId: IDS.lucas, isTemplate: false, publishedAt: "2026-09-29T12:00:00Z" });
    expect(t.id).toBe("");
    expect(t.days.every((x) => x.id === "")).toBe(true);
    expect(routineStatus(t, TODAY)).toBe("activa");
  });

  it("desde plantilla guarda sourceTemplateId; como plantilla no lleva cliente ni fechas", () => {
    const d = treeToDraft({ ...fase2, isTemplate: true, clientId: null }, "template", TODAY);
    expect(d.sourceTemplateId).toBe(fase2.id);
    const t = draftToTree(d, { clientId: IDS.lucas, isTemplate: true, publishedAt: null });
    expect(t.clientId).toBeNull();
    expect(t.startsOn).toBeNull();
    expect(t.isTemplate).toBe(true);
  });

  it("los bloques vacíos no se guardan", () => {
    let d = emptyDraft(TODAY);
    const day = d.days[0]!;
    d = addItem(d, day.key, day.blocks[1]!.key, blankItem(ex("Hip thrust")));
    const t = draftToTree({ ...d, name: "X" }, { clientId: null, isTemplate: true, publishedAt: null });
    expect(t.days[0]!.blocks.map((b) => b.name)).toEqual(["Bloque principal"]);
    expect(t.days[1]!.blocks).toEqual([]);
  });
});
