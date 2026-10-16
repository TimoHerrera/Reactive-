// Borrador de rutina: lo usan la carga manual (F4), las plantillas, duplicar/editar y la importación de Excel (F5).
// Funciones puras e inmutables; las pantallas guardan el borrador en sessionStorage.
import { addDays, todayISO } from "@/lib/dates";
import type { Exercise, RoutineItem, RoutineTree } from "@/lib/data/types";
import { hasVideo } from "@/lib/data/types";
import { normalizeRir, normalizeRpe } from "./effort";

export type DraftItem = {
  key: string;
  /** id real si viene de una rutina existente (editar conserva el historial). */
  id?: string;
  exerciseId: string | null;
  rawName: string;
  sets: number | null;
  reps: string;
  load: string;
  rest: string;
  tempo: string;
  rpeTarget: string;
  rirTarget: string;
  notes: string;
};

export type DraftBlock = { key: string; id?: string; name: string; items: DraftItem[] };
export type DraftDay = { key: string; id?: string; label: string; title: string; blocks: DraftBlock[] };

export type DraftOrigin = "manual" | "template" | "duplicate" | "edit" | "excel";

export type RoutineDraft = {
  /** Solo en «edit»: la rutina que se está editando. */
  routineId?: string;
  origin: DraftOrigin;
  name: string;
  clientIds: string[];
  startsOn: string;
  endsOn: string;
  daysPerWeek: number;
  clientMessage: string;
  sourceTemplateId: string | null;
  saveAsTemplate: boolean;
  /** «edit» de una plantilla: se guarda como plantilla, sin clientes. */
  isTemplate?: boolean;
  /** Nombre del archivo (importación de Excel). */
  fileName?: string;
  days: DraftDay[];
};

let counter = 0;
export const newKey = (p = "k") => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const DAY_LABELS = "ABCDEFG".split("");
export const DEFAULT_BLOCKS = ["Entrada en calor", "Bloque principal", "Accesorios"];

/** Fin a partir de inicio + semanas (29/9 + 4 semanas → 26/10). */
export function endFromWeeks(startsOn: string, weeks: number): string {
  return addDays(startsOn, weeks * 7 - 1);
}

export function newDay(label: string, title = ""): DraftDay {
  return { key: newKey("d"), label, title, blocks: DEFAULT_BLOCKS.map((name) => ({ key: newKey("b"), name, items: [] })) };
}

export function emptyDraft(today: string = todayISO()): RoutineDraft {
  return {
    origin: "manual",
    name: "",
    clientIds: [],
    startsOn: today,
    endsOn: endFromWeeks(today, 4),
    daysPerWeek: 3,
    clientMessage: "",
    sourceTemplateId: null,
    saveAsTemplate: false,
    days: ["A", "B", "C"].map((l) => newDay(l)),
  };
}

export function itemCount(day: DraftDay): number {
  return day.blocks.reduce((n, b) => n + b.items.length, 0);
}

/** Ajusta la cantidad de días (crea o quita del final). */
export function setDaysPerWeek(d: RoutineDraft, n: number): RoutineDraft {
  const count = Math.max(1, Math.min(DAY_LABELS.length, n));
  const days = d.days.slice(0, count);
  while (days.length < count) days.push(newDay(DAY_LABELS[days.length]!));
  return { ...d, daysPerWeek: count, days };
}

/** Días que se perderían al bajar a `n` (para avisar). */
export function daysLostWith(d: RoutineDraft, n: number): DraftDay[] {
  return d.days.slice(n).filter((day) => itemCount(day) > 0);
}

const relabel = (days: DraftDay[]) => days.map((day, i) => ({ ...day, label: DAY_LABELS[i] ?? day.label }));

export function addDay(d: RoutineDraft): RoutineDraft {
  if (d.days.length >= DAY_LABELS.length) return d;
  const days = [...d.days, newDay(DAY_LABELS[d.days.length]!)];
  return { ...d, days, daysPerWeek: days.length };
}

export function removeDay(d: RoutineDraft, dayKey: string): RoutineDraft {
  if (d.days.length <= 1) return d;
  const days = relabel(d.days.filter((x) => x.key !== dayKey));
  return { ...d, days, daysPerWeek: days.length };
}

/** Copia del día con claves nuevas (sin ids: es contenido nuevo). */
export function duplicateDay(d: RoutineDraft, dayKey: string): RoutineDraft {
  const src = d.days.find((x) => x.key === dayKey);
  if (!src || d.days.length >= DAY_LABELS.length) return d;
  const copy: DraftDay = {
    key: newKey("d"),
    label: DAY_LABELS[d.days.length]!,
    title: src.title,
    blocks: src.blocks.map((b) => ({
      key: newKey("b"),
      name: b.name,
      items: b.items.map((it) => ({ ...it, key: newKey("i"), id: undefined })),
    })),
  };
  const days = [...d.days, copy];
  return { ...d, days, daysPerWeek: days.length };
}

const mapDay = (d: RoutineDraft, dayKey: string, fn: (day: DraftDay) => DraftDay): RoutineDraft => ({
  ...d,
  days: d.days.map((x) => (x.key === dayKey ? fn(x) : x)),
});
const mapBlock = (d: RoutineDraft, dayKey: string, blockKey: string, fn: (b: DraftBlock) => DraftBlock) =>
  mapDay(d, dayKey, (day) => ({ ...day, blocks: day.blocks.map((b) => (b.key === blockKey ? fn(b) : b)) }));

export function renameDay(d: RoutineDraft, dayKey: string, title: string): RoutineDraft {
  return mapDay(d, dayKey, (day) => ({ ...day, title }));
}

export function addBlock(d: RoutineDraft, dayKey: string, name: string): RoutineDraft {
  return mapDay(d, dayKey, (day) => ({ ...day, blocks: [...day.blocks, { key: newKey("b"), name, items: [] }] }));
}

export function removeBlock(d: RoutineDraft, dayKey: string, blockKey: string): RoutineDraft {
  return mapDay(d, dayKey, (day) => ({ ...day, blocks: day.blocks.filter((b) => b.key !== blockKey) }));
}

export function blankItem(exercise: Pick<Exercise, "id" | "name"> | null, rawName?: string): DraftItem {
  return {
    key: newKey("i"),
    exerciseId: exercise?.id ?? null,
    rawName: exercise?.name ?? rawName ?? "",
    sets: 3,
    reps: "",
    load: "",
    rest: "",
    tempo: "",
    rpeTarget: "",
    rirTarget: "",
    notes: "",
  };
}

export function addItem(d: RoutineDraft, dayKey: string, blockKey: string, item: DraftItem): RoutineDraft {
  return mapBlock(d, dayKey, blockKey, (b) => ({ ...b, items: [...b.items, item] }));
}

export function updateItem(d: RoutineDraft, dayKey: string, itemKey: string, patch: Partial<DraftItem>): RoutineDraft {
  return mapDay(d, dayKey, (day) => ({
    ...day,
    blocks: day.blocks.map((b) => ({ ...b, items: b.items.map((it) => (it.key === itemKey ? { ...it, ...patch } : it)) })),
  }));
}

export function removeItem(d: RoutineDraft, dayKey: string, itemKey: string): RoutineDraft {
  return mapDay(d, dayKey, (day) => ({
    ...day,
    blocks: day.blocks.map((b) => ({ ...b, items: b.items.filter((it) => it.key !== itemKey) })),
  }));
}

/** Mueve un ítem dentro del día (mismo bloque u otro) a la posición `toIndex` del bloque destino. */
export function moveItem(d: RoutineDraft, dayKey: string, itemKey: string, toBlockKey: string, toIndex: number): RoutineDraft {
  return mapDay(d, dayKey, (day) => {
    let moving: DraftItem | null = null;
    const without = day.blocks.map((b) => {
      const i = b.items.findIndex((it) => it.key === itemKey);
      if (i < 0) return b;
      moving = b.items[i]!;
      return { ...b, items: b.items.filter((_, j) => j !== i) };
    });
    if (!moving) return day;
    return {
      ...day,
      blocks: without.map((b) => {
        if (b.key !== toBlockKey) return b;
        const items = [...b.items];
        items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, moving!);
        return { ...b, items };
      }),
    };
  });
}

/** Busca en qué bloque está un ítem. */
export function findItem(day: DraftDay, itemKey: string): { block: DraftBlock; index: number } | null {
  for (const block of day.blocks) {
    const index = block.items.findIndex((it) => it.key === itemKey);
    if (index >= 0) return { block, index };
  }
  return null;
}

export function draftStats(d: RoutineDraft, exercises: Pick<Exercise, "id" | "videoPath" | "youtubeUrl">[]) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const items = d.days.flatMap((day) => day.blocks.flatMap((b) => b.items));
  return {
    days: d.days.length,
    items: items.length,
    withVideo: items.filter((it) => it.exerciseId && hasVideo(byId.get(it.exerciseId))).length,
    unlinked: items.filter((it) => !it.exerciseId).length,
  };
}

export type StepErrors = Partial<Record<"name" | "dates" | "days" | "items", string>>;

export function validateData(d: RoutineDraft): StepErrors {
  const e: StepErrors = {};
  if (!d.name.trim()) e.name = "Poné un nombre para la rutina.";
  if (!d.startsOn || !d.endsOn) e.dates = "Elegí inicio y fin.";
  else if (d.endsOn < d.startsOn) e.dates = "El fin tiene que ser después del inicio.";
  return e;
}

export function validateDays(d: RoutineDraft): StepErrors {
  const e: StepErrors = {};
  const empty = d.days.filter((day) => itemCount(day) === 0);
  if (d.days.length === 0) e.days = "Agregá al menos un día.";
  else if (empty.length) e.items = `${empty.map((x) => `Día ${x.label}`).join(", ")} no tiene ejercicios.`;
  return e;
}

const nn = (s: string) => (s.trim() ? s.trim() : null);

/** Borrador → árbol para guardar. `keepIds` conserva ids (editar); si no, todo es nuevo. */
export function draftToTree(
  d: RoutineDraft,
  opts: { clientId: string | null; isTemplate: boolean; publishedAt: string | null; routineId?: string; keepIds?: boolean },
): RoutineTree {
  const routineId = opts.routineId ?? "";
  return {
    id: routineId,
    name: d.name.trim(),
    clientId: opts.isTemplate ? null : opts.clientId,
    isTemplate: opts.isTemplate,
    sourceTemplateId: d.sourceTemplateId,
    startsOn: opts.isTemplate ? null : d.startsOn,
    endsOn: opts.isTemplate ? null : d.endsOn,
    daysPerWeek: d.days.length,
    clientMessage: nn(d.clientMessage),
    // Autor y editor los fija la capa de datos con el usuario logueado (nunca el formulario).
    createdBy: null,
    updatedBy: null,
    updatedAt: null,
    publishedAt: opts.publishedAt,
    createdAt: "",
    days: d.days.map((day, di) => {
      const dayId = opts.keepIds ? (day.id ?? "") : "";
      return {
        id: dayId,
        routineId,
        label: day.label,
        title: day.title.trim(),
        position: di,
        blocks: day.blocks
          .filter((b) => b.items.length > 0)
          .map((b, bi) => {
            const blockId = opts.keepIds ? (b.id ?? "") : "";
            return {
              id: blockId,
              dayId,
              name: b.name,
              position: bi,
              items: b.items.map(
                (it, ii): RoutineItem => ({
                  id: opts.keepIds ? (it.id ?? "") : "",
                  blockId,
                  exerciseId: it.exerciseId,
                  rawName: it.rawName.trim(),
                  position: ii,
                  sets: it.sets,
                  reps: nn(it.reps),
                  load: nn(it.load),
                  rest: nn(it.rest),
                  tempo: nn(it.tempo),
                  rpeTarget: nn(normalizeRpe(it.rpeTarget)),
                  rirTarget: nn(normalizeRir(it.rirTarget)),
                  notes: nn(it.notes),
                }),
              ),
            };
          }),
      };
    }),
  };
}

/** Árbol → borrador. `mode` define si se conservan ids/cliente/fechas. */
export function treeToDraft(t: RoutineTree, mode: "edit" | "duplicate" | "template", today: string = todayISO()): RoutineDraft {
  const keep = mode === "edit";
  const start = keep && t.startsOn ? t.startsOn : today;
  const weeks =
    t.startsOn && t.endsOn ? Math.max(1, Math.round((new Date(t.endsOn).getTime() - new Date(t.startsOn).getTime()) / 6.048e8)) : 4;
  return {
    routineId: keep ? t.id : undefined,
    origin: mode,
    name: mode === "duplicate" ? `${t.name} (copia)` : t.name,
    clientIds: keep && t.clientId ? [t.clientId] : [],
    startsOn: start,
    endsOn: keep && t.endsOn ? t.endsOn : endFromWeeks(start, weeks),
    daysPerWeek: t.days.length || t.daysPerWeek,
    clientMessage: t.clientMessage ?? "",
    sourceTemplateId: mode === "template" ? t.id : t.sourceTemplateId,
    saveAsTemplate: false,
    isTemplate: keep ? t.isTemplate : false,
    days: t.days.map((day) => ({
      key: newKey("d"),
      id: keep ? day.id : undefined,
      label: day.label,
      title: day.title,
      blocks: day.blocks.map((b) => ({
        key: newKey("b"),
        id: keep ? b.id : undefined,
        name: b.name,
        items: b.items.map((it) => ({
          key: newKey("i"),
          id: keep ? it.id : undefined,
          exerciseId: it.exerciseId,
          rawName: it.rawName,
          sets: it.sets,
          reps: it.reps ?? "",
          load: it.load ?? "",
          rest: it.rest ?? "",
          tempo: it.tempo ?? "",
          rpeTarget: it.rpeTarget ?? "",
          rirTarget: it.rirTarget ?? "",
          notes: it.notes ?? "",
        })),
      })),
    })),
  };
}

/** «3 × 8 c/lado» para la card colapsada. */
export function itemSummary(it: DraftItem): string {
  const sr = it.sets && it.reps ? `${it.sets} × ${it.reps}` : it.reps || (it.sets ? `${it.sets} series` : "");
  return [sr, it.load, it.rpeTarget && `RPE ${it.rpeTarget}`, it.rirTarget && `RIR ${it.rirTarget}`].filter(Boolean).join(" · ");
}

/**
 * Vincula un ítem a un ejercicio de la biblioteca y, de paso, todos los ítems sin vincular
 * con el mismo texto (ej. «Banda lateral» repetida en varios días).
 */
export function linkItems(
  d: RoutineDraft,
  itemKey: string,
  exercise: Pick<Exercise, "id" | "name">,
  normalize: (s: string) => string,
): RoutineDraft {
  const target = d.days.flatMap((day) => day.blocks.flatMap((b) => b.items)).find((it) => it.key === itemKey);
  if (!target) return d;
  const raw = normalize(target.rawName);
  return {
    ...d,
    days: d.days.map((day) => ({
      ...day,
      blocks: day.blocks.map((b) => ({
        ...b,
        items: b.items.map((it) =>
          it.key === itemKey || (!it.exerciseId && normalize(it.rawName) === raw)
            ? { ...it, exerciseId: exercise.id, rawName: exercise.name }
            : it,
        ),
      })),
    })),
  };
}
