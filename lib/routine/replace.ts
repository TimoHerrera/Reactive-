// Qué pasa con la rutina actual de un cliente al publicarle una nueva (puro, sin acceso a datos).
import type { Routine } from "@/lib/data/types";
import { formatDM, formatShortWeekday, todayISO } from "@/lib/dates";
import { routineStatus } from "./status";

export type ReplaceInfo = {
  kind: "none" | "expired" | "active" | "expiring";
  routine: Routine | null;
  /** Texto para la fila del cliente en el paso 3. */
  note: string;
};

/** Qué pasa con la rutina actual del cliente si se le publica una nueva. */
export function replacementInfo(routinesOfClient: Routine[], today: string = todayISO(), editingId?: string): ReplaceInfo {
  const published = routinesOfClient
    .filter((r) => r.publishedAt && !r.isTemplate && r.id !== editingId)
    .sort((a, b) => (b.startsOn ?? "").localeCompare(a.startsOn ?? ""));
  const current = published.find((r) => {
    const s = routineStatus(r, today);
    return s === "activa" || s === "por-vencer" || s === "programada";
  });
  if (current) {
    const s = routineStatus(current, today);
    if (s === "por-vencer" && current.endsOn) {
      return { kind: "expiring", routine: current, note: `Rutina vence ${formatShortWeekday(current.endsOn)}` };
    }
    return { kind: "active", routine: current, note: `Reemplaza a «${current.name}» (vigente hasta ${formatDM(current.endsOn)})` };
  }
  const last = published[0];
  if (last) return { kind: "expired", routine: last, note: `Reemplaza a «${last.name}» (vencida)` };
  return { kind: "none", routine: null, note: "Sin rutina" };
}
