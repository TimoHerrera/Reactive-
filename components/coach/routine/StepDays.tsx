"use client";

import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PillButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BLOCK_NAMES, hasVideo, type Exercise } from "@/lib/data";
import {
  addBlock,
  addDay,
  addItem,
  blankItem,
  duplicateDay,
  findItem,
  itemSummary,
  moveItem,
  removeBlock,
  removeDay,
  removeItem,
  renameDay,
  updateItem,
  validateDays,
  type DraftBlock,
  type DraftDay,
  type DraftItem,
  type RoutineDraft,
} from "@/lib/routine/draft";
import { pad2 } from "@/components/ui/ExerciseCard";
import { ExercisePicker } from "./ExercisePicker";
import { WizardFooter } from "./WizardHeader";

type Update = (fn: (d: RoutineDraft) => RoutineDraft) => void;

function VideoTag({ item, exercise }: { item: DraftItem; exercise: Exercise | undefined }) {
  if (!item.exerciseId) return <span className="shrink-0 text-caption font-bold text-warning">sin vincular</span>;
  if (exercise && hasVideo(exercise)) return <span className="shrink-0 text-caption font-bold text-success">▶ con video</span>;
  return <span className="shrink-0 text-caption text-muted">sin video</span>;
}

function SmallField({
  label,
  value,
  onChange,
  numeric,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="label block text-[0.625rem]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={numeric ? "numeric" : undefined}
        placeholder={placeholder}
        className="mt-1 h-11 w-full rounded-sm border border-line bg-bg px-2 text-body font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted/60 focus:border-accent"
      />
    </label>
  );
}

function SortableItem({
  item,
  number,
  exercise,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  number: number;
  exercise: Exercise | undefined;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const name = exercise?.name ?? item.rawName;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-md border bg-surface-2",
        expanded ? "border-ink/70" : "border-line",
        isDragging && "relative z-20 border-accent opacity-90 ring-2 ring-accent",
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover ${name}`}
          className="flex h-14 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
        >
          <svg viewBox="0 0 10 16" className="h-4 w-2.5" fill="currentColor" aria-hidden="true">
            {[2, 8, 14].map((y) => (
              <g key={y}>
                <circle cx="2" cy={y} r="1.6" />
                <circle cx="8" cy={y} r="1.6" />
              </g>
            ))}
          </svg>
        </button>
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-h-[56px] min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-bold">
              {pad2(number)} · {name}
            </span>
            {!expanded && itemSummary(item) && <span className="block truncate text-small text-muted">{itemSummary(item)}</span>}
          </span>
          <VideoTag item={item} exercise={exercise} />
        </button>
      </div>
      {expanded && (
        <div className="space-y-3 px-3 pb-3">
          <div className="grid grid-cols-4 gap-2">
            <SmallField
              label="Series"
              numeric
              value={item.sets?.toString() ?? ""}
              onChange={(v) => {
                const n = parseInt(v, 10);
                onChange({ sets: Number.isFinite(n) && n > 0 ? n : null });
              }}
            />
            <SmallField label="Reps" value={item.reps} onChange={(v) => onChange({ reps: v })} placeholder="8" />
            <SmallField label="Carga" value={item.load} onChange={(v) => onChange({ load: v })} placeholder="16 kg" />
            <SmallField label="Desc." value={item.rest} onChange={(v) => onChange({ rest: v })} placeholder="90 s" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <SmallField label="Tempo" value={item.tempo} onChange={(v) => onChange({ tempo: v })} placeholder="3-1-1" />
            <label className="col-span-3 block">
              <span className="label block text-[0.625rem]">Nota para el cliente</span>
              <input
                value={item.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                placeholder="Ej.: espalda neutra, bajá hasta debajo de la rodilla"
                className="mt-1 h-11 w-full rounded-sm border border-line bg-bg px-2 text-small text-ink outline-none placeholder:text-muted/60 focus:border-accent"
              />
            </label>
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={onRemove} className="h-11 px-1 text-small font-semibold text-danger-ink">
              Quitar
            </button>
            <button type="button" onClick={onToggle} className="h-11 rounded-full bg-ink px-5 text-small font-bold text-bg">
              Listo
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function BlockSection({
  block,
  collapsed,
  onToggle,
  onRemove,
  children,
}: {
  block: DraftBlock;
  collapsed: boolean;
  onToggle: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  // El encabezado también es zona de drop (para soltar en un bloque colapsado o vacío).
  const { setNodeRef, isOver } = useDroppable({ id: `drop-${block.key}` });
  return (
    <section ref={setNodeRef} className={cn("rounded-lg border bg-surface", isOver ? "border-accent" : "border-line")}>
      <div className="flex items-center">
        <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="flex min-h-[56px] flex-1 items-center justify-between gap-3 px-4 text-left">
          <h3 className={cn("display text-[1.5rem]", collapsed ? "text-muted" : "text-title")}>{block.name}</h3>
          <span className="shrink-0 text-small text-muted">
            {block.items.length} {block.items.length === 1 ? "ejercicio" : "ejercicios"} {collapsed ? "▾" : "▴"}
          </span>
        </button>
        {block.items.length === 0 && (
          <button type="button" onClick={onRemove} aria-label={`Quitar bloque ${block.name}`} className="mr-2 flex h-11 w-11 items-center justify-center text-muted hover:text-ink">
            ✕
          </button>
        )}
      </div>
      {!collapsed && <div className="space-y-3 px-3 pb-3">{children}</div>}
    </section>
  );
}

export function StepDays({
  draft,
  update,
  exercises,
  onNext,
  onSaveTemplate,
  saving,
}: {
  draft: RoutineDraft;
  update: Update;
  exercises: Exercise[];
  onNext: () => void;
  onSaveTemplate: () => void;
  saving: boolean;
}) {
  const [dayKey, setDayKey] = useState(draft.days[0]?.key ?? "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [addingBlock, setAddingBlock] = useState(false);
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  // Al agregar o duplicar un día, saltamos a ese día nuevo.
  const prevCount = useRef(draft.days.length);
  useEffect(() => {
    if (draft.days.length > prevCount.current) setDayKey(draft.days[draft.days.length - 1]!.key);
    prevCount.current = draft.days.length;
  }, [draft.days]);

  const day: DraftDay | undefined = draft.days.find((d) => d.key === dayKey) ?? draft.days[0];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!day) return null;

  const containerOf = (id: string): string | null => {
    if (id.startsWith("drop-")) return id.slice(5);
    return findItem(day, id)?.block.key ?? null;
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = containerOf(String(active.id));
    const to = containerOf(String(over.id));
    if (!from || !to || from === to) return;
    const target = day.blocks.find((b) => b.key === to)!;
    const overIndex = target.items.findIndex((it) => it.key === over.id);
    update((d) => moveItem(d, day.key, String(active.id), to, overIndex >= 0 ? overIndex : target.items.length));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const to = containerOf(String(over.id));
    if (!to) return;
    const target = day.blocks.find((b) => b.key === to)!;
    const overIndex = target.items.findIndex((it) => it.key === over.id);
    update((d) => moveItem(d, day.key, String(active.id), to, overIndex >= 0 ? overIndex : target.items.length));
  };

  const next = () => {
    const e = validateDays(draft);
    const msg = e.days ?? e.items ?? null;
    setError(msg);
    if (!msg) onNext();
  };

  const missingBlocks = BLOCK_NAMES.filter((n) => !day.blocks.some((b) => b.name === n));
  let n = 0;

  return (
    <>
      {/* Tabs de días */}
      <div className="px-gutter pt-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="Días">
          {draft.days.map((d) => (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={d.key === day.key}
              onClick={() => {
                setDayKey(d.key);
                setExpanded(null);
              }}
              className={cn(
                "display h-12 shrink-0 rounded-md px-4 text-[1.25rem]",
                d.key === day.key ? "bg-accent text-ink" : "border border-line bg-surface-2",
              )}
            >
              Día {d.label}
            </button>
          ))}
          {draft.days.length < 7 && (
            <button
              type="button"
              onClick={() => {
                update(addDay);
                setDayKey("");
              }}
              className="h-12 shrink-0 rounded-md border border-dashed border-muted px-4 text-small font-semibold text-title"
            >
              + Día
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-1 text-body font-bold">
            Día {day.label} ·
            <input
              value={day.title}
              onChange={(e) => update((d) => renameDay(d, day.key, e.target.value))}
              placeholder="Ponele un nombre"
              aria-label={`Nombre del Día ${day.label}`}
              className="h-11 min-w-0 flex-1 rounded-sm bg-transparent px-1 font-normal text-title outline-none placeholder:text-muted/70 focus:bg-surface"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              update((d) => duplicateDay(d, day.key));
              setDayKey("");
            }}
            disabled={draft.days.length >= 7}
            className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line px-3 text-small font-semibold hover:bg-surface-2 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </svg>
            Duplicar día
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-3 border-t border-line px-gutter pb-36 pt-4">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragOver={onDragOver} onDragEnd={onDragEnd}>
          {day.blocks.map((block) => {
            const isCollapsed = collapsed[block.key] ?? false;
            return (
              <BlockSection
                key={block.key}
                block={block}
                collapsed={isCollapsed}
                onToggle={() => setCollapsed((c) => ({ ...c, [block.key]: !isCollapsed }))}
                onRemove={() => update((d) => removeBlock(d, day.key, block.key))}
              >
                <SortableContext id={block.key} items={block.items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
                  {block.items.length > 0 && (
                    <ul className="space-y-2">
                      {block.items.map((item) => {
                        n += 1;
                        return (
                          <SortableItem
                            key={item.key}
                            item={item}
                            number={n}
                            exercise={item.exerciseId ? byId.get(item.exerciseId) : undefined}
                            expanded={expanded === item.key}
                            onToggle={() => setExpanded((k) => (k === item.key ? null : item.key))}
                            onChange={(patch) => update((d) => updateItem(d, day.key, item.key, patch))}
                            onRemove={() => update((d) => removeItem(d, day.key, item.key))}
                          />
                        );
                      })}
                    </ul>
                  )}
                </SortableContext>
                <ExercisePicker
                  exercises={exercises}
                  onPick={(ex, raw) => {
                    const it = blankItem(ex, raw);
                    update((d) => addItem(d, day.key, block.key, it));
                    setExpanded(it.key);
                  }}
                />
              </BlockSection>
            );
          })}
        </DndContext>

        {addingBlock ? (
          <div className="flex flex-wrap gap-2">
            {missingBlocks.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  update((d) => addBlock(d, day.key, name));
                  setAddingBlock(false);
                }}
                className="h-11 rounded-full border border-line px-4 text-small font-semibold hover:bg-surface-2"
              >
                {name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const name = window.prompt("Nombre del bloque");
                if (name?.trim()) update((d) => addBlock(d, day.key, name.trim()));
                setAddingBlock(false);
              }}
              className="h-11 rounded-full border border-dashed border-line px-4 text-small font-semibold"
            >
              Otro…
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingBlock(true)} className="h-11 text-small font-semibold text-title underline underline-offset-4">
            + Bloque
          </button>
        )}

        {draft.days.length > 1 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`¿Quitar el Día ${day.label} y sus ejercicios?`)) {
                update((d) => removeDay(d, day.key));
                setDayKey("");
              }
            }}
            className="block h-11 text-small font-semibold text-danger-ink"
          >
            Quitar Día {day.label}
          </button>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-danger bg-danger/10 px-4 py-3 text-small font-medium text-danger-ink">
            ✕ {error}
          </p>
        )}
      </div>

      <WizardFooter>
        <button
          type="button"
          onClick={onSaveTemplate}
          disabled={saving}
          className="h-14 flex-[0_0_42%] rounded-full border-2 border-line px-3 text-small font-bold leading-tight text-ink hover:bg-surface-2 disabled:opacity-50"
        >
          Guardar como plantilla
        </button>
        <PillButton arrow className="flex-1" onClick={next}>
          Siguiente
        </PillButton>
      </WizardFooter>
    </>
  );
}
