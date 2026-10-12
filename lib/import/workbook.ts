// Punto de entrada: elige el formato de la planilla y la interpreta.
import { looksLikeBlockFormat, parseBlockSheets, type SheetRows } from "./blocks";
import { parseSheet, type ParseResult } from "./parse";

/**
 * 1) Plantilla de Reactive (una fila por ejercicio, con columna «Ejercicio») en la primera hoja.
 * 2) Si no, formato «por bloques» (una hoja por día, bloques con su fila de títulos).
 * 3) Si no es ninguno, los errores del formato tabla (ej. «Falta la columna Ejercicio»).
 */
export function parseWorkbook(sheets: SheetRows[]): ParseResult {
  const first = parseSheet(sheets[0]?.rows ?? []);
  if (first.columns.map.ejercicio !== undefined) return first;
  const suggestsColumn = first.columns.missingRequired.some((m) => m.suggestion);
  if (!suggestsColumn && looksLikeBlockFormat(sheets)) return parseBlockSheets(sheets);
  return first;
}

export type { SheetRows };
