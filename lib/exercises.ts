import { normalizeText } from "@/lib/text";
import type { Exercise } from "@/lib/data/types";

/** Filtros de la biblioteca (cliente y profe): región → grupos musculares. */
export const REGIONS = {
  Piernas: ["Cuádriceps", "Isquiotibiales", "Aductores", "Gemelos", "Tobillo", "Cadera"],
  Glúteos: ["Glúteos"],
  Core: ["Core"],
  "Tren superior": ["Espalda", "Pecho", "Hombros", "Brazos", "Cervical"],
} as const;

export type Region = keyof typeof REGIONS;
export const REGION_NAMES = Object.keys(REGIONS) as Region[];

export function inRegion(e: Pick<Exercise, "muscleGroups">, region: Region): boolean {
  const muscles: readonly string[] = REGIONS[region];
  return e.muscleGroups.some((m) => muscles.includes(m));
}

export const OTHER_REGION = "Otros" as const;

/**
 * Secciones por zona, en el orden de los chips (y «Otros» al final, para los que no tienen zona), sin
 * secciones vacías. Un ejercicio aparece en cada zona que trabaja (hip thrust: Glúteos y Piernas), igual
 * que en los chips: así la cantidad de cada sección coincide con la del chip.
 */
export function groupByRegion<T extends { exercise: Pick<Exercise, "muscleGroups"> }>(
  items: T[],
): { region: Region | typeof OTHER_REGION; items: T[] }[] {
  const groups: { region: Region | typeof OTHER_REGION; items: T[] }[] = REGION_NAMES.map((region) => ({
    region,
    items: items.filter((it) => inRegion(it.exercise, region)),
  }));
  groups.push({ region: OTHER_REGION, items: items.filter((it) => !REGION_NAMES.some((r) => inRegion(it.exercise, r))) });
  return groups.filter((g) => g.items.length > 0);
}

/** «0:31» */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Abreviaturas del diseño en la lista del profe («Isquios»). */
const SHORT: Record<string, string> = { Isquiotibiales: "Isquios" };

/** «Fuerza · Isquios · Mancuernas» */
export function exerciseMeta(e: Pick<Exercise, "category" | "muscleGroups" | "equipment">): string {
  return [e.category, e.muscleGroups[0] && (SHORT[e.muscleGroups[0]] ?? e.muscleGroups[0]), e.equipment]
    .filter(Boolean)
    .join(" · ");
}

export type SearchHit = { exercise: Exercise; matchedAlias: string | null };

/**
 * Búsqueda por nombre, alias o músculo, sin importar acentos ni mayúsculas.
 * Todas las palabras de la búsqueda tienen que aparecer (en cualquier campo).
 * Orden: empieza con el nombre > contiene el nombre > alias > músculo.
 */
export function searchExercises(list: Exercise[], query: string): SearchHit[] {
  const q = normalizeText(query);
  if (!q) return list.map((exercise) => ({ exercise, matchedAlias: null }));
  const terms = q.split(" ");

  const scored: { hit: SearchHit; score: number }[] = [];
  for (const e of list) {
    const name = normalizeText(e.name);
    const aliases = e.aliases.map((a) => ({ raw: a, n: normalizeText(a) }));
    const muscles = e.muscleGroups.map(normalizeText);
    const haystack = [name, ...aliases.map((a) => a.n), ...muscles].join(" ");
    if (!terms.every((t) => haystack.includes(t))) continue;

    let score = 0;
    let matchedAlias: string | null = null;
    if (name.startsWith(q)) score = 4;
    else if (name.includes(q)) score = 3;
    else {
      const alias = aliases.find((a) => a.n.includes(q));
      if (alias) {
        score = 2;
        matchedAlias = alias.raw;
      } else if (muscles.some((m) => m.includes(q))) score = 1;
      else score = 0.5;
    }
    scored.push({ hit: { exercise: e, matchedAlias }, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.hit.exercise.name.localeCompare(b.hit.exercise.name, "es"))
    .map((s) => s.hit);
}
