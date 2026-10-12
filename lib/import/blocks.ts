// Formato «por bloques» (como arman muchos profes sus planillas):
//   - una hoja por día («Dia 1», «Dia 2»…);
//   - cada bloque arranca con una fila «Bloque 1 | Repeticiones | Series | Carga | Pausa»;
//   - abajo, una fila por ejercicio; una fila sin ejercicio con la pausa («2 minutos») cierra el bloque;
//   - arriba puede haber título, fecha o indicaciones sueltas.
import { normalizeText } from "@/lib/text";
import { isKnownHeader, mapColumns, type ColumnMap } from "./columns";
import { parseBlock, parseSets, type Issue, type ParsedDay, type ParsedRow, type ParseResult } from "./parse";

export type SheetRows = { name: string; rows: unknown[][] };

const LABELS = "ABCDEFG";
const str = (v: unknown) => String(v ?? "").trim();

/** Fila de encabezado de bloque: 1ª celda = nombre del bloque y ≥ 2 columnas reconocidas a la derecha. */
export function blockHeader(row: unknown[]): { name: string; map: ColumnMap } | null {
  const first = str(row[0]);
  if (!first || isKnownHeader(first)) return null;
  const rest = mapColumns(row.slice(1));
  const useful = rest.recognized.filter((f) => f === "reps" || f === "series" || f === "carga" || f === "descanso" || f === "notas");
  if (useful.length < 2) return null;
  const map: ColumnMap = {};
  for (const f of rest.recognized) map[f] = rest.map[f]! + 1;
  return { name: first, map };
}

export function looksLikeBlockFormat(sheets: SheetRows[]): boolean {
  return sheets.some((s) => s.rows.some((r) => blockHeader(r ?? []) !== null));
}

/** «Dia 2» → B; si no hay número, por orden. */
function dayLabel(sheetName: string, index: number, used: Set<string>): string {
  const n = parseInt(normalizeText(sheetName).match(/(\d+)/)?.[1] ?? "", 10);
  const byName = n >= 1 && n <= 7 ? LABELS[n - 1]! : null;
  if (byName && !used.has(byName)) return byName;
  return [...LABELS].find((l) => !used.has(l)) ?? LABELS[index % 7]!;
}

const isGenericDayName = (name: string) => /^(dia|day|hoja|sheet)\s*\d+$/.test(normalizeText(name));

export function parseBlockSheets(sheets: SheetRows[]): ParseResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const rows: ParsedRow[] = [];
  const days: ParsedDay[] = [];
  const used = new Set<string>();
  let suggestedName: string | undefined;

  sheets.forEach((sheet, si) => {
    const label = dayLabel(sheet.name, si, used);
    let current: { name: string; map: ColumnMap; rows: ParsedRow[] } | null = null;
    const blocks: { name: string; rows: ParsedRow[] }[] = [];
    const loose: string[] = [];

    sheet.rows.forEach((r, i) => {
      const row = r ?? [];
      if (!row.some((c) => str(c))) return;
      const rowNumber = i + 1;

      const header = blockHeader(row);
      if (header) {
        current = { name: parseBlock(header.name), map: header.map, rows: [] };
        blocks.push(current);
        return;
      }
      if (!current) {
        loose.push(row.map(str).filter(Boolean).join(" "));
        return;
      }
      const block: { name: string; map: ColumnMap; rows: ParsedRow[] } = current;
      const at = (i?: number) => (i === undefined ? "" : str(row[i]));
      const exercise = str(row[0]);

      if (!exercise) {
        // Fila de pausa del bloque: «2 minutos» → descanso de los ejercicios que no tienen uno.
        const pause = at(block.map.descanso) || row.map(str).filter(Boolean).join(" ");
        if (pause) for (const it of block.rows) if (!it.rest) it.rest = pause;
        return;
      }

      const rawSets = at(block.map.series);
      const sets = parseSets(rawSets);
      if (!sets.ok) {
        errors.push({
          kind: "error",
          title: `${sheet.name} · Fila ${rowNumber} · «Series» tiene que ser un número`,
          detail: `Dice «${rawSets}». Escribí un número entero, por ejemplo 3.`,
          rows: [rowNumber],
        });
      } else if (sets.converted && sets.value) {
        warnings.push({ kind: "warning", title: `${sheet.name} · Fila ${rowNumber} · «Series»`, detail: `Decía «${rawSets}»: lo tomamos como ${sets.value}.`, rows: [rowNumber] });
      }

      const parsed: ParsedRow = {
        id: `${sheet.name}:${rowNumber}`,
        sheet: sheet.name,
        row: rowNumber,
        day: label,
        block: block.name,
        order: null,
        exercise,
        sets: sets.ok ? sets.value : null,
        reps: at(block.map.reps),
        load: at(block.map.carga),
        rest: at(block.map.descanso),
        notes: at(block.map.notas),
      };
      block.rows.push(parsed);
      rows.push(parsed);
    });

    // El primer texto suelto de la primera hoja suele ser el título («Rutina …»).
    if (si === 0 && loose[0] && !suggestedName && /^rutina\b/i.test(loose[0])) suggestedName = loose.shift();
    if (loose.length) {
      warnings.push({
        kind: "warning",
        title: `${sheet.name}: texto fuera de los bloques`,
        detail: `${loose.map((l) => `«${l}»`).join(", ")}. No se importa; si es una indicación, sumala como nota.`,
      });
    }

    const nonEmpty = blocks.filter((b) => b.rows.length > 0);
    if (nonEmpty.length) {
      used.add(label);
      days.push({ label, title: isGenericDayName(sheet.name) ? "" : sheet.name, blocks: nonEmpty });
    }
  });

  days.sort((a, b) => a.label.localeCompare(b.label));
  if (!errors.length && rows.length === 0) {
    errors.push({ kind: "error", title: "No hay ejercicios", detail: "Encontramos los bloques pero ninguna fila con ejercicios." });
  }
  return {
    ok: errors.length === 0,
    format: "bloques",
    suggestedName,
    columns: mapColumns([]),
    errors,
    warnings,
    rows,
    days,
  };
}
