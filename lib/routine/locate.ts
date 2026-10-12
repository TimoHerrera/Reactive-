import type { DayTree, RoutineItem, RoutineTree } from "@/lib/data/types";

export type LocatedItem = {
  item: RoutineItem;
  day: DayTree;
  /** Posición 1-based dentro del día («Ejercicio 03 de 09»). */
  index: number;
  total: number;
};

export function itemsOfDay(day: DayTree): RoutineItem[] {
  return day.blocks.flatMap((b) => b.items);
}

export function locateItem(tree: RoutineTree, itemId: string): LocatedItem | null {
  for (const day of tree.days) {
    const items = itemsOfDay(day);
    const i = items.findIndex((it) => it.id === itemId);
    if (i >= 0) return { item: items[i]!, day, index: i + 1, total: items.length };
  }
  return null;
}

/** «4 × 8» */
export function setsReps(item: Pick<RoutineItem, "sets" | "reps">): string {
  if (item.sets && item.reps) return `${item.sets} × ${item.reps}`;
  return item.reps ?? (item.sets ? `${item.sets} series` : "");
}

/** «90 s» → «Desc. 90 s» */
export function restLabel(rest: string | null): string | null {
  return rest ? `Desc. ${rest}` : null;
}
