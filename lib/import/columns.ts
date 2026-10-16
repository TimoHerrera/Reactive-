// Columnas de la planilla: Día | Bloque | Orden | Ejercicio | Series | Reps | Carga | Descanso | RPE | RIR | Observaciones
// RPE y RIR son opcionales: los Excel viejos sin esas columnas se siguen aceptando.
import { normalizeHeader } from "@/lib/text";

export const FIELDS = ["dia", "bloque", "orden", "ejercicio", "series", "reps", "carga", "descanso", "rpe", "rir", "notas"] as const;
export type Field = (typeof FIELDS)[number];

/** Encabezados tal cual en la plantilla. */
export const FIELD_LABEL: Record<Field, string> = {
  dia: "Día",
  bloque: "Bloque",
  orden: "Orden",
  ejercicio: "Ejercicio",
  series: "Series",
  reps: "Reps",
  carga: "Carga",
  descanso: "Descanso",
  rpe: "RPE",
  rir: "RIR",
  notas: "Observaciones",
};

export const REQUIRED: Field[] = ["ejercicio"];

/** Variantes que se aceptan directamente (encabezado normalizado: minúsculas, sin acentos, espacios simples). */
const ACCEPTED: Record<Field, string[]> = {
  dia: ["dia", "day", "dias"],
  bloque: ["bloque", "bloques", "block", "seccion"],
  orden: ["orden", "#", "n", "nro", "n°", "nº", "numero", "order", "posicion"],
  ejercicio: ["ejercicio", "ejercicios", "exercise"],
  series: ["series", "serie", "sets", "set"],
  reps: ["reps", "rep", "repeticiones", "repeticion", "reps / tiempo", "repeticiones / tiempo"],
  carga: ["carga", "peso", "kg", "load"],
  descanso: ["descanso", "desc.", "desc", "pausa", "rest"],
  rpe: ["rpe", "rpe objetivo", "esfuerzo", "esfuerzo percibido", "borg"],
  rir: ["rir", "rir objetivo", "rer", "reps en reserva", "repeticiones en reserva"],
  notas: ["notas", "nota", "observaciones", "obs", "comentarios", "indicaciones"],
};

/** Sinónimos que NO se toman solos: se sugieren cuando falta la columna obligatoria. */
const SUGGEST: Partial<Record<Field, string[]>> = {
  ejercicio: ["nombre", "nombre del ejercicio", "movimiento", "actividad", "descripcion"],
};

/** ¿Es un encabezado conocido (o un sinónimo sugerible)? Sirve para no confundir títulos de bloque con encabezados. */
export function isKnownHeader(text: string): boolean {
  const n = normalizeHeader(text);
  return FIELDS.some((f) => ACCEPTED[f].includes(n) || (SUGGEST[f] ?? []).includes(n));
}

export type ColumnMap = Partial<Record<Field, number>>;

export type ColumnResult = {
  map: ColumnMap;
  recognized: Field[];
  missingRequired: { field: Field; suggestion: string | null }[];
  /** Encabezados que no reconocimos (se ignoran). */
  unknown: string[];
};

export function mapColumns(headers: unknown[]): ColumnResult {
  const map: ColumnMap = {};
  const unknown: string[] = [];
  const raw = headers.map((h) => String(h ?? "").trim());
  raw.forEach((h, i) => {
    if (!h) return;
    const n = normalizeHeader(h);
    const field = FIELDS.find((f) => ACCEPTED[f].includes(n));
    if (field && map[field] === undefined) map[field] = i;
    else if (!field) unknown.push(h);
  });
  const missingRequired = REQUIRED.filter((f) => map[f] === undefined).map((field) => {
    const suggestion = raw.find((h) => h && (SUGGEST[field] ?? []).includes(normalizeHeader(h))) ?? null;
    return { field, suggestion };
  });
  return { map, recognized: FIELDS.filter((f) => map[f] !== undefined), missingRequired, unknown };
}
