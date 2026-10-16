// Plantilla descargable (SheetJS). Columnas exactas + 2 filas de ejemplo.
import * as XLSX from "xlsx";
import { FIELD_LABEL, FIELDS } from "./columns";

export const TEMPLATE_HEADERS = FIELDS.map((f) => FIELD_LABEL[f]);

export const TEMPLATE_ROWS: (string | number)[][] = [
  ["A", "Principal", 3, "Sentadilla goblet", 4, "8", "16 kg", "90 s", "7", "3", "Rodillas en la línea de los pies"],
  ["A", "Principal", 4, "RDL", 4, "8", "2 × 14 kg", "90 s", "7-8", "2", ""],
];

export const TEMPLATE_FILENAME = "plantilla_rutina_reactive.xlsx";

export function buildTemplateWorkbook(): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_ROWS]);
  ws["!cols"] = [6, 14, 8, 28, 8, 12, 12, 11, 7, 7, 36].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rutina");
  return wb;
}

/** Descarga la plantilla en el navegador. */
export function downloadTemplate() {
  XLSX.writeFile(buildTemplateWorkbook(), TEMPLATE_FILENAME);
}
