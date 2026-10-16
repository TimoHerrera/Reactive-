// RPE y RIR objetivo (texto que acepta rangos: «7», «7-8», «1-2») y comparación con lo registrado.
import type { RoutineItem } from "@/lib/data/types";

export type Range = { min: number; max: number };

export const RPE_HELP = "RPE: qué tan duro fue, de 1 a 10. RIR: cuántas repeticiones te quedaron en el tanque.";

/** Si el RPE real supera al objetivo por esto o más, se avisa al profe. */
export const RPE_ALERT_DELTA = 2;

/**
 * «7» · «7-8» · «7 a 8» · «7–8» · «7,5» → rango. Fuera de [lo, hi], invertido o con texto → null.
 * Admite medios puntos (escala RPE de 0,5).
 */
export function parseRange(text: string | null | undefined, lo: number, hi: number): Range | null {
  const t = (text ?? "").trim().toLowerCase().replace(/,/g, ".");
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(?:(?:-|–|—|a|\/)\s*(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] !== undefined ? Number(m[2]) : min;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max || min < lo || max > hi) return null;
  return { min, max };
}

export const parseRpe = (text: string | null | undefined) => parseRange(text, 1, 10);
export const parseRir = (text: string | null | undefined) => parseRange(text, 0, 10);

/** Forma canónica para guardar: «7 a 8» → «7-8»; «7,5» → «7.5». Texto inválido → tal cual (recortado). */
export function normalizeRange(text: string | null | undefined, lo: number, hi: number): string {
  const r = parseRange(text, lo, hi);
  if (!r) return (text ?? "").trim();
  return r.min === r.max ? String(r.min) : `${r.min}-${r.max}`;
}
export const normalizeRpe = (text: string | null | undefined) => normalizeRange(text, 1, 10);
export const normalizeRir = (text: string | null | undefined) => normalizeRange(text, 0, 10);

/** «RPE 8 · RIR 2» para la card del cliente (null si no hay ninguno). */
export function effortLabel(item: Pick<RoutineItem, "rpeTarget" | "rirTarget">): string | null {
  const parts = [item.rpeTarget && `RPE ${item.rpeTarget}`, item.rirTarget && `RIR ${item.rirTarget}`].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** ¿El RPE real supera al objetivo (su tope) por 2 o más? Sin objetivo válido → false. */
export function rpeExceeded(actual: number | null | undefined, target: string | null | undefined): boolean {
  const r = parseRpe(target);
  return actual != null && !!r && actual - r.max >= RPE_ALERT_DELTA;
}
