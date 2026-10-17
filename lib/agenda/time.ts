// Fecha y hora de la agenda SIEMPRE en hora de Buenos Aires (America/Argentina/Buenos_Aires),
// sin importar la zona del navegador. Argentina no tiene horario de verano: UTC−3 fijo.
export const AGENDA_TZ = "America/Argentina/Buenos_Aires";
const OFFSET = "-03:00";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: AGENDA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(ts: string | Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(typeof ts === "string" ? new Date(ts) : ts).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Fecha «YYYY-MM-DD» en Buenos Aires. */
export function baDate(ts: string | Date): string {
  return parts(ts).date;
}

/** Hora «18:00» en Buenos Aires. */
export function baTime(ts: string | Date): string {
  return parts(ts).time;
}

/** Hoy en Buenos Aires. */
export function baToday(now: Date = new Date()): string {
  return baDate(now);
}

/** «2026-10-16» + «18:00» (hora de Buenos Aires) → timestamp ISO en UTC. */
export function baTimestamp(date: string, time: string): string {
  return new Date(`${date}T${time.length === 5 ? time : time.slice(0, 5)}:00${OFFSET}`).toISOString();
}

/** Inicio del día en Buenos Aires como timestamp (para filtrar rangos). */
export function baStartOfDay(date: string): string {
  return baTimestamp(date, "00:00");
}

/** Minutos desde la medianoche (para ubicar el turno en la grilla). */
export function minutesOfDay(ts: string): number {
  const [h, m] = baTime(ts).split(":").map(Number);
  return h! * 60 + m!;
}
