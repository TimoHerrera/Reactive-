import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildSeed } from "@/lib/data/seed";
import { mapColumns } from "./columns";
import { buildMatcher } from "./match";
import { parseDay, parseSets, parseSheet, rowsLabel } from "./parse";
import { buildTemplateWorkbook, TEMPLATE_HEADERS } from "./template";
import { importToDraft, nameFromFile } from "./toDraft";
import { sheetToRows } from "./read";

const { exercises } = buildSeed("2026-10-11");
const match = buildMatcher(exercises);
const H = ["Día", "Bloque", "Orden", "Ejercicio", "Series", "Reps", "Carga", "Descanso", "Notas"];

describe("columnas", () => {
  it("reconoce las 9 columnas de la plantilla, sin importar acentos ni mayúsculas", () => {
    const c = mapColumns(["DIA", " bloque ", "Orden", "ejercicio", "SERIES", "Reps", "Carga", "Descanso", "Notas"]);
    expect(c.recognized).toHaveLength(9);
    expect(c.missingRequired).toEqual([]);
  });

  it("columna «Nombre» en vez de «Ejercicio»: error con sugerencia", () => {
    const res = parseSheet([["Día", "Bloque", "Orden", "Nombre", "Series", "Reps"], ["A", "Principal", 1, "Sentadilla goblet", 4, 8]]);
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatchObject({
      title: "Falta la columna «Ejercicio»",
      detail: "Encontramos «Nombre» en su lugar. Renombrala o usá la plantilla.",
    });
  });

  it("encuentra los encabezados aunque haya un título arriba", () => {
    const res = parseSheet([["Rutina de Sofía"], [], H, ["A", "Principal", 1, "Hip thrust", 3, "10", "", "", ""]]);
    expect(res.ok).toBe(true);
    expect(res.rows[0]!.row).toBe(4);
  });
});

describe("series y días", () => {
  it("«tres» → 3 con aviso; «3 a 4» → error con número de fila", () => {
    expect(parseSets("tres")).toEqual({ ok: true, value: 3, converted: true });
    expect(parseSets("4")).toEqual({ ok: true, value: 4 });
    expect(parseSets("")).toEqual({ ok: true, value: null });
    expect(parseSets("3 a 4").ok).toBe(false);

    const rows = [H, ["A", "Principal", 1, "Sentadilla goblet", "tres", "8"]];
    for (let i = 0; i < 12; i++) rows.push(["A", "Principal", i + 2, "Hip thrust", 3, "10"]);
    rows.push(["A", "Principal", 20, "Nordic", "3 a 4", "5"]); // fila 15
    const res = parseSheet(rows);
    expect(res.rows[0]!.sets).toBe(3);
    expect(res.warnings.some((w) => w.title === "Fila 2 · «Series»" && w.detail.includes("tres"))).toBe(true);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]!.title).toBe("Fila 15 · «Series» tiene que ser un número");
    expect(res.errors[0]!.detail).toContain("«3 a 4»");
  });

  it("filas sin Día: advertencia y van al Día A", () => {
    const res = parseSheet([
      H,
      ["B", "Principal", 1, "Hip thrust", 3, "10"],
      ["", "Principal", 2, "Plancha", 3, "30 s"],
      ["", "Core", 3, "Pallof", 3, "10"],
    ]);
    expect(res.ok).toBe(true);
    expect(res.warnings[0]).toMatchObject({ title: "Filas 3–4 sin «Día»", detail: "Las vamos a poner en el Día A si no las corregís." });
    expect(res.days.map((d) => d.label)).toEqual(["A", "B"]);
    expect(res.days[0]!.blocks.map((b) => b.name)).toEqual(["Bloque principal", "Core"]);
  });

  it("parseDay y rowsLabel", () => {
    expect(parseDay("Día b")).toBe("B");
    expect(parseDay("2")).toBe("B");
    expect(parseDay("Lunes")).toBeNull();
    expect(rowsLabel([20, 21, 22])).toBe("Filas 20–22");
    expect(rowsLabel([3, 7, 9])).toBe("Filas 3, 7 y 9");
  });

  it("ordena por «Orden» y agrupa por bloque", () => {
    const res = parseSheet([
      H,
      ["A", "Principal", 4, "RDL", 4, "8"],
      ["A", "Entrada en calor", 1, "Movilidad de flexores de cadera", 2, "45 s"],
      ["A", "Principal", 3, "Sentadilla goblet", 4, "8"],
    ]);
    const day = res.days[0]!;
    expect(day.blocks.map((b) => b.name)).toEqual(["Entrada en calor", "Bloque principal"]);
    expect(day.blocks[1]!.rows.map((r) => r.exercise)).toEqual(["Sentadilla goblet", "RDL"]);
  });
});

describe("matching (casos del diseño)", () => {
  it("«RDL c/ mancuernas» → revisar: Peso muerto rumano", () => {
    const m = match("RDL c/ mancuernas");
    expect(m.status).toBe("revisar");
    expect(m.exercise?.name).toBe("Peso muerto rumano");
  });

  it("«Copenhague» → revisar: Copenhagen plank", () => {
    const m = match("Copenhague");
    expect(m.status).toBe("revisar");
    expect(m.exercise?.name).toBe("Copenhagen plank");
  });

  it("«Salto al cajón unipodal» → no encontrado", () => {
    expect(match("Salto al cajón unipodal").status).toBe("no-encontrado");
  });

  it("igualdad exacta con nombre o alias (sin acentos ni mayúsculas) → reconocido", () => {
    expect(match("sentadilla GOBLET")).toMatchObject({ status: "ok", via: "nombre" });
    expect(match("Nordic curl")).toMatchObject({ status: "ok", via: "alias" });
    expect(match("Nordic curl").exercise?.name).toBe("Nordic hamstring");
    expect(match("Curl nordico").exercise?.name).toBe("Nordic hamstring");
    expect(match("RDL").exercise?.name).toBe("Peso muerto rumano");
    expect(match("  Estocada Búlgara. ")).toMatchObject({ status: "ok" });
  });

  it("errores de tipeo → revisar", () => {
    expect(match("Sentadila goblet")).toMatchObject({ status: "revisar" });
    expect(match("Sentadila goblet").exercise?.name).toBe("Sentadilla goblet");
  });

  it("no inventa coincidencias con textos que no tienen nada que ver", () => {
    expect(match("Burpees").status).toBe("no-encontrado");
    expect(match("Bicicleta fija 10 min").status).toBe("no-encontrado");
  });
});

describe("plantilla y archivo", () => {
  it("la plantilla tiene las columnas exactas y 2 filas de ejemplo, y se puede volver a leer", () => {
    expect(TEMPLATE_HEADERS).toEqual(H);
    const buf = XLSX.write(buildTemplateWorkbook(), { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const rows = sheetToRows(buf, false);
    expect(rows[0]).toEqual(H);
    const res = parseSheet(rows);
    expect(res.ok).toBe(true);
    expect(res.rows).toHaveLength(2);
    expect(res.rows.map((r) => match(r.exercise).status)).toEqual(["ok", "ok"]);
  });

  it("lee CSV", () => {
    const csv = "Día,Bloque,Orden,Ejercicio,Series,Reps\nA,Principal,1,Hip thrust,4,10\nA,Principal,2,Copenhague,3,20 s\n";
    const res = parseSheet(sheetToRows(csv, true));
    expect(res.ok).toBe(true);
    expect(res.rows.map((r) => r.exercise)).toEqual(["Hip thrust", "Copenhague"]);
  });

  it("arma el borrador para «Asignar y publicar»", () => {
    const res = parseSheet([H, ["A", "Principal", 1, "RDL c/ mancuernas", 4, "8", "2×14 kg", "90 s"], ["B", "Core", 1, "Salto al cajón unipodal", 3, "5"]]);
    const draft = importToDraft(
      res.days,
      (row) => {
        const m = match(row.exercise);
        return m.status === "ok" || m.status === "revisar" ? { exerciseId: m.exercise!.id, name: m.exercise!.name } : { exerciseId: null, name: row.exercise };
      },
      { fileName: "readaptacion_martina_f2.xlsx", today: "2026-09-29" },
    );
    expect(draft.name).toBe("Readaptacion martina f2");
    expect(draft.origin).toBe("excel");
    expect(draft.days.map((d) => d.label)).toEqual(["A", "B"]);
    expect(draft.days[0]!.blocks[0]!.items[0]).toMatchObject({ rawName: "Peso muerto rumano", sets: 4, load: "2×14 kg" });
    expect(draft.days[1]!.blocks[0]!.items[0]).toMatchObject({ exerciseId: null, rawName: "Salto al cajón unipodal" });
    expect(nameFromFile("rutina.csv")).toBe("Rutina");
  });
});

describe("planillas de ejemplo (docs/ejemplos)", () => {
  const load = async (name: string) => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const buf = readFileSync(resolve(__dirname, "../../docs/ejemplos", name));
    return parseSheet(sheetToRows(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), false));
  };

  it("readaptacion_martina_f2.xlsx: 12 reconocidos, 2 a revisar, 1 no encontrado", async () => {
    const res = await load("readaptacion_martina_f2.xlsx");
    expect(res.ok).toBe(true);
    expect(res.days.map((d) => d.label)).toEqual(["A", "B", "C"]);
    const statuses = res.rows.map((r) => match(r.exercise).status);
    expect(statuses.filter((s) => s === "ok")).toHaveLength(12);
    expect(statuses.filter((s) => s === "revisar")).toHaveLength(2);
    expect(statuses.filter((s) => s === "no-encontrado")).toHaveLength(1);
  });

  it("rutina_sofia_LCA.xlsx: los 3 problemas del diseño", async () => {
    const res = await load("rutina_sofia_LCA.xlsx");
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.title)).toEqual(["Falta la columna «Ejercicio»", "Fila 14 · «Series» tiene que ser un número"]);
    expect(res.errors[0]!.detail).toContain("«Nombre»");
    expect(res.warnings.map((w) => w.title)).toEqual(["Filas 20–22 sin «Día»"]);
  });
});

describe("formato por bloques (una hoja por día)", () => {
  const BH = (name: string) => [name, "Repeticiones", "Series", "Carga", "Pausa"];
  const sheets = [
    {
      name: "Dia 1",
      rows: [
        ["Rutina Ana Ejemplo"],
        ["Oct-26"],
        [],
        ["Movilidad misma de siempre"],
        BH("Entrada en calor"),
        ["Abdominales bisagra con disco", "12", "3", "5kg", ""],
        ["", "", "", "", "2 minutos"],
        [],
        BH("Bloque 1"),
        ["Sentadilla goblet", "8", "4", "16kg", ""],
        ["Hip trhust", "10", "4", "20kg", "60 s"],
        ["", "", "", "", "2 minutos"],
      ],
    },
    { name: "Dia 2", rows: [BH("Entrada en calor"), ["Plancha Copenhague", "15 segundos por lado", "tres", "", ""], ["", "", "", "", "90 segundos"]] },
    { name: "Dia 3", rows: [["Activacion de cadera", "Repeticiones", "Series", "Pausa", ""], ["Banda lateral", "10 por pierna", "4", "", ""], ["", "", "", "2 minutos", ""]] },
  ];

  it("detecta el formato y arma un día por hoja con sus bloques", async () => {
    const { parseWorkbook } = await import("./workbook");
    const res = parseWorkbook(sheets);
    expect(res.ok).toBe(true);
    expect(res.format).toBe("bloques");
    expect(res.suggestedName).toBe("Rutina Ana Ejemplo");
    expect(res.days.map((d) => d.label)).toEqual(["A", "B", "C"]);
    expect(res.days[0]!.blocks.map((b) => b.name)).toEqual(["Entrada en calor", "Bloque 1"]);
    expect(res.days[2]!.blocks.map((b) => b.name)).toEqual(["Activacion de cadera"]);
    expect(res.rows.map((r) => r.id)).toContain("Dia 2:2");
  });

  it("lee reps, series y carga, y la fila de pausa completa el descanso", async () => {
    const { parseWorkbook } = await import("./workbook");
    const res = parseWorkbook(sheets);
    const [goblet, hip] = res.days[0]!.blocks[1]!.rows;
    expect(goblet).toMatchObject({ exercise: "Sentadilla goblet", reps: "8", sets: 4, load: "16kg", rest: "2 minutos" });
    expect(hip!.rest).toBe("60 s"); // no pisa un descanso propio
    expect(res.days[2]!.blocks[0]!.rows[0]!.rest).toBe("2 minutos"); // «Pausa» en otra columna
    expect(res.days[1]!.blocks[0]!.rows[0]!.sets).toBe(3); // «tres»
  });

  it("avisa el texto que queda afuera de los bloques", async () => {
    const { parseWorkbook } = await import("./workbook");
    const res = parseWorkbook(sheets);
    const loose = res.warnings.find((w) => w.title.includes("fuera de los bloques"))!;
    expect(loose.detail).toContain("«Movilidad misma de siempre»");
    expect(loose.detail).not.toContain("Rutina Ana Ejemplo");
  });

  it("matchea contra la biblioteca: typos y alias a revisar", async () => {
    const { parseWorkbook } = await import("./workbook");
    const res = parseWorkbook(sheets);
    const status = (name: string) => match(res.rows.find((r) => r.exercise === name)!.exercise);
    expect(status("Sentadilla goblet").status).toBe("ok");
    expect(status("Hip trhust")).toMatchObject({ status: "revisar" });
    expect(status("Hip trhust").exercise?.name).toBe("Hip thrust");
    expect(status("Plancha Copenhague").exercise?.name).toBe("Copenhagen plank");
  });

  it("la plantilla de Reactive sigue teniendo prioridad y «Nombre» sigue siendo error", async () => {
    const { parseWorkbook } = await import("./workbook");
    expect(parseWorkbook([{ name: "Hoja1", rows: [H, ["A", "Principal", 1, "Hip thrust", 3, "10"]] }]).format).toBe("tabla");
    const bad = parseWorkbook([{ name: "Hoja1", rows: [["Día", "Bloque", "Nombre", "Series", "Reps"], ["A", "Principal", "Hip thrust", 3, "10"]] }]);
    expect(bad.format).toBe("tabla");
    expect(bad.errors[0]!.title).toBe("Falta la columna «Ejercicio»");
  });

  it("lee el archivo de ejemplo por bloques", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const { workbookToSheets } = await import("./read");
    const { parseWorkbook } = await import("./workbook");
    const buf = readFileSync(resolve(__dirname, "../../docs/ejemplos/rutina_por_bloques.xlsx"));
    const res = parseWorkbook(workbookToSheets(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), false));
    expect(res.format).toBe("bloques");
    expect(res.days).toHaveLength(3);
    expect(res.rows).toHaveLength(8);
  });
});

describe("similitud de texto completo", () => {
  it("no sugiere por pedazos de palabras («Prensa» ≠ «Copenhagen plank»)", () => {
    expect(match("Prensa").status).toBe("no-encontrado");
    expect(match("Sillon de cuadriceps").status).toBe("no-encontrado");
  });
});

describe("sugerencias para vincular después", () => {
  it("encuentra el mismo ejercicio con el nombre un poco cambiado", async () => {
    const { suggestExercises } = await import("./match");
    const names = (raw: string) => suggestExercises(raw, exercises).map((s) => s.exercise.name);
    expect(names("Hip trhust isometrico")[0]).toBe("Hip thrust");
    expect(names("Sentadilla goblet con kettbell")[0]).toBe("Sentadilla goblet");
    expect(names("Plancha Copenhague")[0]).toBe("Copenhagen plank");
    expect(names("Peso muerto rumano con barra")[0]).toBe("Peso muerto rumano");
    expect(names("Flexiones de brazo en rodillas")[0]).toBe("Flexiones de brazos");
  });

  it("no sugiere cualquier cosa", async () => {
    const { suggestExercises } = await import("./match");
    expect(suggestExercises("Sillon de cuadriceps", exercises)).toEqual([]);
    expect(suggestExercises("Burpees", exercises)).toEqual([]);
  });
});
