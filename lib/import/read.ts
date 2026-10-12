// Archivo (.xlsx / .csv) → filas, con SheetJS.
import * as XLSX from "xlsx";

export const MAX_IMPORT_MB = 5;
export const ACCEPT_IMPORT = ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

export type FileCheck = { ok: true } | { ok: false; error: string };

export function checkImportFile(file: { name: string; size: number }): FileCheck {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["xlsx", "xls", "csv"].includes(ext)) return { ok: false, error: "Subí un archivo .xlsx o .csv." };
  if (file.size > MAX_IMPORT_MB * 1024 * 1024) {
    return { ok: false, error: `El archivo pesa más de ${MAX_IMPORT_MB} MB. ¿Seguro que es la rutina? Probá con la plantilla.` };
  }
  return { ok: true };
}

function readBook(data: ArrayBuffer | string, isCsv: boolean): XLSX.WorkBook {
  return isCsv
    ? XLSX.read(typeof data === "string" ? data : new TextDecoder("utf-8").decode(data), { type: "string", raw: false })
    : XLSX.read(data, { type: "array" });
}

const toRows = (ws: XLSX.WorkSheet) => XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "", blankrows: true });

/** Todas las hojas (en orden) como filas de texto. Las hojas vacías se descartan. */
export function workbookToSheets(data: ArrayBuffer | string, isCsv: boolean): { name: string; rows: unknown[][] }[] {
  const wb = readBook(data, isCsv);
  return wb.SheetNames.map((name) => ({ name, rows: toRows(wb.Sheets[name]!) })).filter((s) =>
    s.rows.some((r) => r.some((c) => String(c ?? "").trim())),
  );
}

/** Lee la primera hoja como filas de texto. */
export function sheetToRows(data: ArrayBuffer | string, isCsv: boolean): unknown[][] {
  return workbookToSheets(data, isCsv)[0]?.rows ?? [];
}

/** Lee el archivo con progreso real (FileReader). */
export function readFile(file: File, onProgress?: (fraction: number) => void): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsArrayBuffer(file);
  });
}
