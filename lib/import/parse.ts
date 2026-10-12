// Lectura de la planilla ya convertida a filas (array de arrays). Puro: no depende de SheetJS.
import { normalizeText } from "@/lib/text";
import { FIELD_LABEL, mapColumns, type ColumnResult, type Field } from "./columns";

export type Issue = {
  kind: "error" | "warning";
  title: string;
  detail: string;
  /** Números de fila de la planilla (1 = primera fila del archivo). */
  rows?: number[];
};

export type ParsedRow = {
  /** Identificador único («Dia 1:14» o «14»). */
  id: string;
  /** Hoja de origen (formato por bloques: una hoja por día). */
  sheet: string | null;
  /** Fila en la planilla (1-based, como la ve el profe en Excel). */
  row: number;
  day: string; // "A"
  block: string; // "Bloque principal"
  order: number | null;
  exercise: string;
  sets: number | null;
  reps: string;
  load: string;
  rest: string;
  notes: string;
};

export type ParsedDay = { label: string; title?: string; blocks: { name: string; rows: ParsedRow[] }[] };

/** «tabla»: plantilla de Reactive (una fila por ejercicio). «bloques»: una hoja por día con bloques. */
export type ImportFormat = "tabla" | "bloques";

export type ParseResult = {
  ok: boolean;
  format: ImportFormat;
  /** Nombre sugerido para la rutina (título de la planilla, si lo hay). */
  suggestedName?: string;
  columns: ColumnResult;
  errors: Issue[];
  warnings: Issue[];
  rows: ParsedRow[];
  days: ParsedDay[];
};

const WORD_NUMBERS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

/** Series: número entero. «tres» → 3 (trivial). Otra cosa → error. */
export function parseSets(value: string): { ok: true; value: number | null; converted?: boolean } | { ok: false } {
  const t = value.trim();
  if (!t) return { ok: true, value: null };
  if (/^\d+([.,]0+)?$/.test(t)) return { ok: true, value: parseInt(t, 10) };
  const w = WORD_NUMBERS[normalizeText(t)];
  if (w) return { ok: true, value: w, converted: true };
  // «4 series», «x4», «4x»
  const m = t.match(/^x?\s*(\d+)\s*(x|series?)?$/i);
  if (m) return { ok: true, value: parseInt(m[1]!, 10), converted: true };
  return { ok: false };
}

/** Día: «A», «Día A», «día b», «1» → «A». */
export function parseDay(value: string): string | null {
  const t = normalizeText(value).replace(/^dia\s*/, "");
  if (!t) return null;
  if (/^[a-g]$/.test(t)) return t.toUpperCase();
  const n = parseInt(t, 10);
  if (n >= 1 && n <= 7) return "ABCDEFG"[n - 1]!;
  return null;
}

const BLOCK_ALIASES: Record<string, string> = {
  "entrada en calor": "Entrada en calor",
  calentamiento: "Entrada en calor",
  "en calor": "Entrada en calor",
  activacion: "Entrada en calor",
  "bloque principal": "Bloque principal",
  principal: "Bloque principal",
  fuerza: "Bloque principal",
  accesorios: "Accesorios",
  accesorio: "Accesorios",
  complementarios: "Accesorios",
  core: "Core",
  "zona media": "Core",
  movilidad: "Movilidad",
  "vuelta a la calma": "Movilidad",
  elongacion: "Movilidad",
};

export function parseBlock(value: string): string {
  const t = normalizeText(value);
  if (!t) return "Bloque principal";
  return BLOCK_ALIASES[t] ?? value.trim().charAt(0).toUpperCase() + value.trim().slice(1);
}

const cell = (row: unknown[], i: number | undefined) => (i === undefined ? "" : String(row[i] ?? "").trim());

/** «Filas 20–22», «Fila 14», «Filas 3, 7 y 9» */
export function rowsLabel(rows: number[]): string {
  if (rows.length === 1) return `Fila ${rows[0]}`;
  const sorted = [...rows].sort((a, b) => a - b);
  const consecutive = sorted.every((r, i) => i === 0 || r === sorted[i - 1]! + 1);
  if (consecutive) return `Filas ${sorted[0]}–${sorted.at(-1)}`;
  return `Filas ${sorted.slice(0, -1).join(", ")} y ${sorted.at(-1)}`;
}

/** Busca la fila de encabezados (puede haber un título arriba): la primera que tenga «Ejercicio» o algún sinónimo, o ≥ 3 celdas. */
function findHeaderRow(aoa: unknown[][]): number {
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const cols = mapColumns(aoa[i] ?? []);
    if (cols.recognized.length >= 2 || cols.missingRequired.some((m) => m.suggestion)) return i;
  }
  return aoa.findIndex((r) => (r ?? []).filter((c) => String(c ?? "").trim()).length >= 3);
}

export function parseSheet(aoa: unknown[][]): ParseResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const headerIdx = findHeaderRow(aoa);
  const columns = mapColumns(headerIdx >= 0 ? (aoa[headerIdx] ?? []) : []);

  if (headerIdx < 0) {
    errors.push({ kind: "error", title: "La planilla está vacía", detail: "No encontramos encabezados ni filas. Usá la plantilla." });
    return { ok: false, format: "tabla", columns, errors, warnings, rows: [], days: [] };
  }

  for (const m of columns.missingRequired) {
    errors.push({
      kind: "error",
      title: `Falta la columna «${FIELD_LABEL[m.field]}»`,
      detail: m.suggestion
        ? `Encontramos «${m.suggestion}» en su lugar. Renombrala o usá la plantilla.`
        : "Agregala o usá la plantilla.",
    });
  }

  const { map } = columns;
  const rows: ParsedRow[] = [];
  const noDay: number[] = [];
  const noExercise: number[] = [];
  const converted: { row: number; from: string; to: number }[] = [];

  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const r = aoa[i] ?? [];
    if (!r.some((c) => String(c ?? "").trim())) continue; // fila vacía
    const rowNumber = i + 1;
    const exercise = map.ejercicio !== undefined ? cell(r, map.ejercicio) : "";
    if (map.ejercicio !== undefined && !exercise) {
      noExercise.push(rowNumber);
      continue;
    }

    const rawDay = cell(r, map.dia);
    let day = parseDay(rawDay);
    if (!day) {
      if (rawDay) {
        errors.push({ kind: "error", title: `${rowsLabel([rowNumber])} · «Día» no es válido`, detail: `Dice «${rawDay}». Escribí A, B, C… o 1, 2, 3.`, rows: [rowNumber] });
      } else noDay.push(rowNumber);
      day = "A";
    }

    const rawSets = cell(r, map.series);
    const sets = parseSets(rawSets);
    if (!sets.ok) {
      errors.push({
        kind: "error",
        title: `${rowsLabel([rowNumber])} · «Series» tiene que ser un número`,
        detail: `Dice «${rawSets}». Escribí un número entero, por ejemplo 3.`,
        rows: [rowNumber],
      });
    } else if (sets.converted && sets.value) converted.push({ row: rowNumber, from: rawSets, to: sets.value });

    const rawOrder = cell(r, map.orden);
    const order = rawOrder && /^\d+$/.test(rawOrder) ? parseInt(rawOrder, 10) : null;

    rows.push({
      id: String(rowNumber),
      sheet: null,
      row: rowNumber,
      day,
      block: parseBlock(cell(r, map.bloque)),
      order,
      exercise,
      sets: sets.ok ? sets.value : null,
      reps: cell(r, map.reps),
      load: cell(r, map.carga),
      rest: cell(r, map.descanso),
      notes: cell(r, map.notas),
    });
  }

  if (noDay.length) {
    warnings.push({
      kind: "warning",
      title: `${rowsLabel(noDay)} sin «Día»`,
      detail: "Las vamos a poner en el Día A si no las corregís.",
      rows: noDay,
    });
  }
  if (noExercise.length) {
    warnings.push({ kind: "warning", title: `${rowsLabel(noExercise)} sin «Ejercicio»`, detail: "Las salteamos.", rows: noExercise });
  }
  for (const c of converted) {
    warnings.push({
      kind: "warning",
      title: `${rowsLabel([c.row])} · «Series»`,
      detail: `Decía «${c.from}»: lo tomamos como ${c.to}.`,
      rows: [c.row],
    });
  }
  if (!errors.length && rows.length === 0) {
    errors.push({ kind: "error", title: "No hay ejercicios", detail: "La planilla tiene encabezados pero ninguna fila con ejercicios." });
  }

  return { ok: errors.length === 0, format: "tabla", columns, errors, warnings, rows, days: groupDays(rows) };
}

/** Agrupa por día (A, B…) y bloque, respetando «Orden» y, si falta, el orden de las filas. */
export function groupDays(rows: ParsedRow[]): ParsedDay[] {
  const labels = [...new Set(rows.map((r) => r.day))].sort();
  return labels.map((label) => {
    const dayRows = rows.filter((r) => r.day === label);
    const blockNames: string[] = [];
    for (const r of dayRows) if (!blockNames.includes(r.block)) blockNames.push(r.block);
    const sorted = (list: ParsedRow[]) =>
      [...list].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.row - b.row);
    // Bloques en el orden en que aparece su primer «Orden» (o su primera fila).
    const blocks = blockNames
      .map((name) => ({ name, rows: sorted(dayRows.filter((r) => r.block === name)) }))
      .sort((a, b) => {
        const fa = a.rows[0]!;
        const fb = b.rows[0]!;
        return (fa.order ?? Infinity) - (fb.order ?? Infinity) || fa.row - fb.row;
      });
    return { label, blocks };
  });
}

export const FIELD_COUNT = 9;
export type { Field };
