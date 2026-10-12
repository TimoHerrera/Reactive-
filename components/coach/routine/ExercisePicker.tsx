"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { IconSearch } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { hasVideo, type Exercise } from "@/lib/data";
import { searchExercises } from "@/lib/exercises";

/**
 * Autocompletado de la biblioteca: muestra «▶ con video» / «sin video» y el alias que matcheó.
 * Última opción: usar el texto tal cual (queda sin vincular, sin video).
 */
export function ExercisePicker({
  exercises,
  onPick,
  placeholder = "Agregar ejercicio",
}: {
  exercises: Exercise[];
  onPick: (exercise: Exercise | null, rawName: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const hits = useMemo(() => (query.trim() ? searchExercises(exercises, query).slice(0, 6) : []), [exercises, query]);
  const options = query.trim() ? [...hits.map((h) => ({ hit: h })), { raw: query.trim() }] : [];

  const pick = (i: number) => {
    const o = options[i];
    if (!o) return;
    if ("hit" in o) onPick(o.hit.exercise, o.hit.exercise.name);
    else onPick(null, o.raw);
    setQuery("");
    setActive(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && options.length ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="done"
          className="h-12 w-full rounded-md border border-dashed border-accent/70 bg-accent-deep/10 pl-11 pr-4 text-body text-ink outline-none placeholder:text-title focus:border-solid focus:border-accent"
        />
      </div>
      {open && options.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-line bg-surface-2">
          {options.map((o, i) => (
            <li key={i} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={cn("flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left", i === active && "bg-line")}
              >
                {"hit" in o ? (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold">{o.hit.exercise.name}</span>
                      <span className="block truncate text-caption text-muted">
                        {o.hit.matchedAlias ? `Alias: ${o.hit.matchedAlias} · ` : ""}
                        {o.hit.exercise.muscleGroups.slice(0, 2).join(" · ")}
                      </span>
                    </span>
                    {hasVideo(o.hit.exercise) ? (
                      <span className="shrink-0 text-caption font-bold text-success">▶ con video</span>
                    ) : (
                      <span className="shrink-0 text-caption text-muted">sin video</span>
                    )}
                  </>
                ) : (
                  <span className="text-small text-title">
                    + Usar «<strong className="text-ink">{o.raw}</strong>» sin vincular <span className="text-muted">(queda sin video)</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
