"use client";

import { useMemo, useState } from "react";
import { hasVideo, type Exercise } from "@/lib/data";
import { suggestExercises } from "@/lib/import/match";
import { ExercisePicker } from "./ExercisePicker";

/**
 * Vincular un ítem a la biblioteca después de cargarlo (o cambiar el ejercicio).
 * Sugiere parecidos («iguales con el nombre un poco cambiado»), deja buscar otro o crearlo.
 */
export function LinkPanel({
  rawName,
  linked,
  exercises,
  onLink,
  onCreate,
}: {
  rawName: string;
  linked: Exercise | null;
  exercises: Exercise[];
  onLink: (ex: Exercise) => Promise<void> | void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(!linked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestions = useMemo(
    () => (linked ? [] : suggestExercises(rawName, exercises, 3)),
    [rawName, exercises, linked],
  );

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (linked && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-11 text-small font-semibold text-title underline underline-offset-4">
        Cambiar ejercicio
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-warning/50 bg-warning/5 p-3">
      {linked ? (
        <p className="text-small text-title">Elegí otro ejercicio de la biblioteca:</p>
      ) : (
        <p className="text-small text-title">
          <strong className="text-warning">Sin vincular:</strong> «{rawName}» no está unido a la biblioteca, así que no muestra video.
        </p>
      )}

      {suggestions.length > 0 && (
        <div>
          <p className="label">¿Es alguno de estos?</p>
          <ul className="mt-2 space-y-2">
            {suggestions.map((s) => (
              <li key={s.exercise.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => onLink(s.exercise))}
                  className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-md bg-ink px-3 py-2 text-left text-bg disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-small font-bold">Vincular a {s.exercise.name}</span>
                    {s.matchedText !== s.exercise.name && <span className="block truncate text-caption">Alias: {s.matchedText}</span>}
                  </span>
                  <span className="shrink-0 text-caption font-bold">{hasVideo(s.exercise) ? "▶ con video" : "sin video"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="label mb-2">{suggestions.length ? "¿Otro? Buscalo" : "Buscalo en la biblioteca"}</p>
        <ExercisePicker
          exercises={exercises}
          placeholder="Nombre, alias o músculo"
          onPick={(ex) => {
            if (ex) void run(() => onLink(ex));
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!linked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => onCreate(rawName))}
            className="h-11 rounded-full border border-line px-4 text-small font-semibold hover:bg-surface-2 disabled:opacity-50"
          >
            {busy ? "Guardando…" : `Crear «${rawName}» en la biblioteca`}
          </button>
        )}
        {linked && (
          <button type="button" onClick={() => setOpen(false)} className="h-11 text-small text-muted underline">
            Cancelar
          </button>
        )}
      </div>
      <p className="text-caption text-muted">Al vincular, guardamos «{rawName}» como alias: la próxima vez se reconoce solo.</p>
      {error && <p className="text-small text-danger-ink">✕ {error}</p>}
    </div>
  );
}
