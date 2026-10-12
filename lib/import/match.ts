// Matching de nombres de la planilla contra la biblioteca de ejercicios.
// 1) Igualdad exacta (normalizada) con el nombre o un alias → reconocido.
// 2) Similitud alta (fuse.js, umbral configurable) o un nombre/alias contenido como palabras → «¿Quisiste decir…?».
// 3) Nada → no encontrado.
import Fuse from "fuse.js";
import type { Exercise } from "@/lib/data/types";
import { normalizeText } from "@/lib/text";

export type MatchStatus = "ok" | "revisar" | "no-encontrado";

export type MatchResult = {
  status: MatchStatus;
  exercise: Exercise | null;
  /** Texto de la biblioteca que coincidió (nombre o alias). */
  matchedText: string | null;
  via: "nombre" | "alias" | null;
  /** 0 = idéntico, 1 = nada que ver (fuse). */
  score: number | null;
};

/** Umbral de similitud de fuse.js (más bajo = más estricto). */
export const DEFAULT_THRESHOLD = 0.35;

type Entry = { text: string; raw: string; exercise: Exercise; via: "nombre" | "alias" };

/** Similitud de texto completo (1 − distancia de edición / largo mayor). Contempla transposiciones. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return 1 - d[m]![n]! / Math.max(m, n);
}

/** Similitud mínima del texto completo para sugerir un «¿Quisiste decir…?». */
export const MIN_SIMILARITY = 0.72;

export function buildMatcher(exercises: Exercise[], opts: { threshold?: number } = {}) {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const entries: Entry[] = exercises.flatMap((e) => [
    { text: normalizeText(e.name), raw: e.name, exercise: e, via: "nombre" as const },
    ...e.aliases.map((a) => ({ text: normalizeText(a), raw: a, exercise: e, via: "alias" as const })),
  ]);
  const exact = new Map<string, Entry>();
  for (const en of entries) if (en.text && !exact.has(en.text)) exact.set(en.text, en);

  const fuse = new Fuse(entries, {
    keys: ["text"],
    includeScore: true,
    threshold,
    ignoreLocation: true,
    minMatchCharLength: 3,
  });

  return function match(raw: string): MatchResult {
    const q = normalizeText(raw);
    if (!q) return { status: "no-encontrado", exercise: null, matchedText: null, via: null, score: null };

    const hit = exact.get(q);
    if (hit) return { status: "ok", exercise: hit.exercise, matchedText: hit.raw, via: hit.via, score: 0 };

    // Nombre o alias contenido como palabras completas («rdl» en «rdl c mancuernas»).
    const padded = ` ${q} `;
    const contained = entries
      .filter((en) => en.text.length >= 3 && padded.includes(` ${en.text} `))
      .sort((a, b) => b.text.length - a.text.length)[0];

    // fuse encuentra candidatos (incluso por pedazos); nos quedamos con el que más se parezca en el texto completo.
    const fuzzyOk =
      fuse
        .search(q, { limit: 8 })
        .filter((r) => (r.score ?? 1) <= threshold && similarity(q, r.item.text) >= MIN_SIMILARITY)
        .sort((a, b) => similarity(q, b.item.text) - similarity(q, a.item.text))[0] ?? null;

    // Un error de tipeo casi idéntico gana; si no, manda el nombre/alias contenido.
    const nearlyIdentical = fuzzyOk && (fuzzyOk.score ?? 1) < 0.15;
    if (contained && !nearlyIdentical) {
      return { status: "revisar", exercise: contained.exercise, matchedText: contained.raw, via: contained.via, score: 0.2 };
    }
    if (fuzzyOk) {
      return {
        status: "revisar",
        exercise: fuzzyOk.item.exercise,
        matchedText: fuzzyOk.item.raw,
        via: fuzzyOk.item.via,
        score: fuzzyOk.score ?? null,
      };
    }
    return { status: "no-encontrado", exercise: null, matchedText: null, via: null, score: null };
  };
}

const STOPWORDS = new Set(["con", "de", "del", "la", "el", "al", "los", "las", "por", "en", "y", "a", "c", "un", "una", "sin"]);
const tokens = (s: string) => s.split(" ").filter((t) => t.length >= 3 && !STOPWORDS.has(t));

export type Suggestion = { exercise: Exercise; matchedText: string; score: number };

/**
 * Ejercicios de la biblioteca parecidos a un texto (para «¿Es alguno de estos?» al vincular).
 * Combina similitud del texto completo, palabras en común y nombre/alias contenido.
 * Encuentra «iguales pero con nombres un poco cambiados» («Hip trhust isometrico» → Hip thrust).
 */
export function suggestExercises(raw: string, exercises: Exercise[], limit = 3, minScore = 0.4): Suggestion[] {
  const q = normalizeText(raw);
  if (!q) return [];
  const qTokens = tokens(q);
  const padded = ` ${q} `;
  const best = new Map<string, Suggestion>();

  for (const e of exercises) {
    for (const text of [e.name, ...e.aliases]) {
      const t = normalizeText(text);
      if (!t) continue;
      const tTokens = tokens(t);
      const shared = tTokens.filter((tok) => qTokens.some((qt) => qt === tok || similarity(qt, tok) >= 0.8)).length;
      const overlap = tTokens.length && qTokens.length ? shared / Math.min(tTokens.length, qTokens.length) : 0;
      const contained = t.length >= 3 && padded.includes(` ${t} `) ? 0.75 : 0;
      // La similitud del texto completo solo cuenta si es casi igual (error de tipeo); si no, deciden las palabras en común.
      const sim = similarity(q, t);
      const score = Math.max(sim >= MIN_SIMILARITY ? sim : 0, overlap * 0.85, contained);
      const prev = best.get(e.id);
      if (score >= minScore && (!prev || score > prev.score)) best.set(e.id, { exercise: e, matchedText: text, score });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, "es")).slice(0, limit);
}
