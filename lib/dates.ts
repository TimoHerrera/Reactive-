// Fechas «YYYY-MM-DD» en hora local (Buenos Aires). Sin librerías.

const DAY_MS = 86_400_000;

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** b − a en días. */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / DAY_MS);
}

/** Lunes de la semana de la fecha. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  return addDays(iso, -dow);
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAYS_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** «29/9» */
export function formatDM(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISODate(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** «domingo 11 de octubre» */
export function formatLong(iso: string): string {
  const d = parseISODate(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** «jue 15/10» */
export function formatShortWeekday(iso: string): string {
  const d = parseISODate(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${formatDM(iso)}`;
}

/** «agosto 2026» */
export function formatMonthYear(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** «hace 2 h», «Ayer», «hace 3 días» */
export function formatRelative(isoDateTime: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(isoDateTime).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  const days = diffDays(toISODate(new Date(isoDateTime)), toISODate(now));
  if (days === 0) return `hace ${h} h`;
  if (days === 1) return "Ayer";
  return `hace ${days} días`;
}
