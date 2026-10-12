// Resultado de la importación → borrador de rutina (para seguir en «Asignar y publicar»).
import { todayISO } from "@/lib/dates";
import { emptyDraft, newKey, type RoutineDraft } from "@/lib/routine/draft";
import type { ParsedDay, ParsedRow } from "./parse";

/** «readaptacion_martina_f2.xlsx» → «Readaptacion martina f2» */
export function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Rutina importada";
}

export function importToDraft(
  days: ParsedDay[],
  linkOf: (row: ParsedRow) => { exerciseId: string | null; name: string },
  opts: { fileName: string; clientIds?: string[]; today?: string; name?: string },
): RoutineDraft {
  const base = emptyDraft(opts.today ?? todayISO());
  return {
    ...base,
    origin: "excel",
    name: opts.name?.trim() || nameFromFile(opts.fileName),
    fileName: opts.fileName,
    clientIds: opts.clientIds ?? [],
    daysPerWeek: days.length,
    days: days.map((d) => ({
      key: newKey("d"),
      label: d.label,
      title: d.title ?? "",
      blocks: d.blocks.map((b) => ({
        key: newKey("b"),
        name: b.name,
        items: b.rows.map((r) => {
          const link = linkOf(r);
          return {
            key: newKey("i"),
            exerciseId: link.exerciseId,
            rawName: link.exerciseId ? link.name : r.exercise,
            sets: r.sets,
            reps: r.reps,
            load: r.load,
            rest: r.rest,
            tempo: "",
            notes: r.notes,
          };
        }),
      })),
    })),
  };
}
