"use client";

import { useMemo, useState } from "react";
import { ExercisePicker } from "@/components/coach/routine/ExercisePicker";
import { ImportPreviewTable, PillButton, type PreviewRow, type PreviewRowStatus } from "@/components/ui";
import { cn } from "@/lib/cn";
import { EXERCISE_CATEGORIES, hasVideo, type Exercise, type ExerciseCategory } from "@/lib/data";
import type { MatchResult } from "@/lib/import/match";
import { rowsLabel, type ParseResult, type ParsedRow } from "@/lib/import/parse";

/** «Fila 5», «Filas 20–22» o, con varias hojas, «Dia 1 · Fila 7 · Dia 2 · Fila 4». */
export function locationLabel(rows: ParsedRow[]): string {
  const bySheet = new Map<string | null, number[]>();
  for (const r of rows) bySheet.set(r.sheet, [...(bySheet.get(r.sheet) ?? []), r.row]);
  return [...bySheet.entries()].map(([sheet, nums]) => (sheet ? `${sheet} · ${rowsLabel(nums)}` : rowsLabel(nums))).join(" · ");
}
import { normalizeText } from "@/lib/text";

/** Decisión del profe para un texto de la planilla (aplica a todas las filas con ese texto). */
export type Resolution = { exerciseId: string | null };

export type RowState = { status: PreviewRowStatus; exercise: Exercise | null; suggestion: Exercise | null };

export function rowState(
  row: ParsedRow,
  matches: Map<string, MatchResult>,
  resolutions: Record<string, Resolution>,
  byId: Map<string, Exercise>,
): RowState {
  const key = normalizeText(row.exercise);
  const res = resolutions[key];
  if (res) {
    const ex = res.exerciseId ? (byId.get(res.exerciseId) ?? null) : null;
    if (!ex) return { status: "sin-vincular", exercise: null, suggestion: null };
    return { status: hasVideo(ex) ? "ok-video" : "ok-sin-video", exercise: ex, suggestion: null };
  }
  const m = matches.get(key);
  const ex = m?.exercise ? (byId.get(m.exercise.id) ?? m.exercise) : null;
  if (m?.status === "ok" && ex) return { status: hasVideo(ex) ? "ok-video" : "ok-sin-video", exercise: ex, suggestion: null };
  if (m?.status === "revisar" && ex) return { status: "revisar", exercise: null, suggestion: ex };
  return { status: "no-encontrado", exercise: null, suggestion: null };
}

function QuickCreate({
  defaultName,
  onCreate,
  onCancel,
}: {
  defaultName: string;
  onCreate: (name: string, category: ExerciseCategory) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState<ExerciseCategory>("Fuerza");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 space-y-3 rounded-md border border-line bg-bg p-3">
      <p className="label">Crear ejercicio nuevo</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Nombre del ejercicio"
        className="h-11 w-full rounded-sm border border-line bg-surface px-3 text-body text-ink outline-none focus:border-accent"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Categoría">
        {EXERCISE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={cn("h-11 rounded-full px-3 text-small font-semibold", category === c ? "bg-accent text-ink" : "border border-line text-title")}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="text-caption text-muted">El video se lo subís después desde Ejercicios.</p>
      {error && <p className="text-small text-danger-ink">✕ {error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-full border border-line text-small font-semibold">
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onCreate(name.trim(), category);
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
          className="h-11 flex-1 rounded-full bg-ink text-small font-bold text-bg disabled:opacity-50"
        >
          {busy ? "Creando…" : "Crear y vincular"}
        </button>
      </div>
    </div>
  );
}

function ResolveCard({
  raw,
  rows,
  suggestion,
  exercises,
  onLink,
  onLeave,
  onCreate,
}: {
  raw: string;
  rows: ParsedRow[];
  suggestion: Exercise | null;
  exercises: Exercise[];
  onLink: (ex: Exercise) => Promise<void>;
  onLeave: () => void;
  onCreate: (name: string, category: ExerciseCategory) => Promise<void>;
}) {
  const [mode, setMode] = useState<"idle" | "pick" | "create">("idle");
  const [busy, setBusy] = useState(false);
  const review = !!suggestion;
  const link = async (ex: Exercise) => {
    setBusy(true);
    await onLink(ex);
  };
  return (
    <li className={cn("rounded-lg border-2 bg-surface p-4", review ? "border-warning" : "border-danger")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn("label", review ? "!text-warning" : "!text-danger-ink")}>{review ? "¿Quisiste decir…?" : "No está en la biblioteca"}</p>
        <p className="shrink-0 text-right text-small text-muted">{locationLabel(rows)}</p>
      </div>
      <p className="mt-2 text-title-sm">«{raw}»</p>
      <p className="mt-1 text-small text-title">
        {review
          ? `Encontramos un ejercicio parecido en la biblioteca. Si lo vinculás, guardamos «${raw}» como alias.`
          : "Vinculalo a uno que ya exista o crealo ahora (después le podés subir el video)."}
      </p>

      {mode === "idle" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {review ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void link(suggestion!)}
              className="min-h-[48px] rounded-full bg-ink px-3 py-2 text-small font-bold leading-tight text-bg disabled:opacity-50"
            >
              Vincular a {suggestion!.name}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode("pick")}
              className="min-h-[48px] rounded-full bg-ink px-3 py-2 text-small font-bold leading-tight text-bg"
            >
              Vincular a uno existente
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode(review ? "pick" : "create")}
            className="min-h-[48px] rounded-full border border-line px-3 py-2 text-small font-bold leading-tight"
          >
            {review ? "Elegir otro" : "Crear ejercicio nuevo"}
          </button>
        </div>
      )}
      {mode === "pick" && (
        <div className="mt-3 space-y-2">
          <ExercisePicker
            exercises={exercises}
            placeholder="Buscá el ejercicio"
            onPick={(ex) => {
              if (ex) void link(ex);
              else onLeave();
            }}
          />
          <div className="flex justify-between">
            <button type="button" onClick={() => setMode("idle")} className="h-11 text-small text-muted underline">
              Volver
            </button>
            {review && (
              <button type="button" onClick={() => setMode("create")} className="h-11 text-small font-semibold underline">
                Crear ejercicio nuevo
              </button>
            )}
          </div>
        </div>
      )}
      {mode === "create" && <QuickCreate defaultName={raw} onCreate={onCreate} onCancel={() => setMode("idle")} />}
      {mode === "idle" && (
        <button type="button" onClick={onLeave} className="mt-2 h-11 text-small text-muted underline underline-offset-4">
          Dejar sin vincular
        </button>
      )}
    </li>
  );
}

export function ImportPreview({
  parse,
  matches,
  resolutions,
  exercises,
  onLink,
  onLeave,
  onCreate,
  onContinue,
}: {
  parse: ParseResult;
  matches: Map<string, MatchResult>;
  resolutions: Record<string, Resolution>;
  exercises: Exercise[];
  onLink: (raw: string, ex: Exercise) => Promise<void>;
  onLeave: (raw: string) => void;
  onCreate: (raw: string, name: string, category: ExerciseCategory) => Promise<void>;
  onContinue: () => void;
}) {
  const [bulkBusy, setBulkBusy] = useState(false);
  const [day, setDay] = useState(parse.days[0]?.label ?? "A");
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const states = useMemo(
    () => new Map(parse.rows.map((r) => [r.id, rowState(r, matches, resolutions, byId)])),
    [parse.rows, matches, resolutions, byId],
  );

  const counts = { ok: 0, revisar: 0, no: 0 };
  for (const s of states.values()) {
    if (s.status === "ok-video" || s.status === "ok-sin-video") counts.ok++;
    else if (s.status === "revisar") counts.revisar++;
    else if (s.status === "no-encontrado") counts.no++;
  }

  // Tarjetas: un texto por tarjeta (aplica a todas sus filas).
  const pending = useMemo(() => {
    const groups = new Map<string, { raw: string; rows: ParsedRow[]; suggestion: Exercise | null }>();
    for (const r of parse.rows) {
      const s = states.get(r.id)!;
      if (s.status !== "revisar" && s.status !== "no-encontrado") continue;
      const key = normalizeText(r.exercise);
      const g = groups.get(key) ?? { raw: r.exercise, rows: [], suggestion: s.suggestion };
      g.rows.push(r);
      groups.set(key, g);
    }
    return [...groups.values()]; // en el orden de la planilla
  }, [parse.rows, states]);

  const notFound = pending.filter((p) => !p.suggestion);
  const current = parse.days.find((d) => d.label === day) ?? parse.days[0];
  const tableRows: PreviewRow[] = (current?.blocks ?? []).flatMap((b) =>
    b.rows.map((r, i) => {
      const s = states.get(r.id)!;
      return {
        key: r.id,
        day: r.day,
        order: r.order ?? i + 1,
        block: b.name.replace("Bloque principal", "Principal"),
        sets: r.sets ?? "—",
        exercise: s.exercise && normalizeText(s.exercise.name) !== normalizeText(r.exercise) ? `${r.exercise} → ${s.exercise.name}` : r.exercise,
        reps: r.reps,
        load: r.load,
        status: s.status,
        suggestion: s.suggestion?.name,
      };
    }),
  );

  return (
    <div className="pb-40">
      <div className="px-gutter pt-5">
        <h1 className="display text-display-section">Vista previa</h1>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { n: counts.ok, label: "reconocidos", cls: "border-success/50 bg-success/10 text-success" },
            { n: counts.revisar, label: "a revisar", cls: "border-warning/50 bg-warning/10 text-warning" },
            { n: counts.no, label: "no encontrados", cls: "border-danger/50 bg-danger/10 text-danger-ink" },
          ].map((c) => (
            <div key={c.label} className={cn("rounded-md border p-3", c.cls)}>
              <p className="display text-h1 leading-none">{c.n}</p>
              <p className="mt-1 text-caption text-title">{c.label}</p>
            </div>
          ))}
        </div>

        {parse.warnings.length > 0 && (
          <ul className="mt-4 space-y-2">
            {parse.warnings.map((w, i) => (
              <li key={i} className="rounded-md border border-warning/60 bg-surface px-3 py-2 text-small">
                <strong className="text-warning">! {w.title}</strong> <span className="text-muted">— {w.detail}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Días">
          {parse.days.map((d) => {
            const n = d.blocks.reduce((acc, b) => acc + b.rows.length, 0);
            return (
              <button
                key={d.label}
                type="button"
                role="tab"
                aria-selected={d.label === current?.label}
                onClick={() => setDay(d.label)}
                className={cn(
                  "display h-11 shrink-0 rounded-full px-4 text-[1.125rem]",
                  d.label === current?.label ? "bg-accent text-ink" : "border border-line bg-surface-2",
                )}
              >
                Día {d.label} · {n}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-5 border-t border-line px-gutter pt-5">
        {pending.length > 0 && (
          <section aria-labelledby="resolver">
            <h2 id="resolver" className="display text-h2 text-title">
              Resolvé antes de publicar
            </h2>
            {notFound.length >= 3 && (
              <div className="mt-3 rounded-lg border border-line bg-surface p-4">
                <p className="text-small text-title">
                  Hay {notFound.length} ejercicios que no están en la biblioteca. Podés resolverlos de una:
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={async () => {
                      setBulkBusy(true);
                      for (const p of notFound) await onCreate(p.raw, p.raw, "Fuerza").catch(() => undefined);
                      setBulkBusy(false);
                    }}
                    className="min-h-[48px] rounded-full bg-ink px-3 py-2 text-small font-bold leading-tight text-bg disabled:opacity-50"
                  >
                    {bulkBusy ? "Creando…" : `Crear los ${notFound.length} en la biblioteca`}
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => notFound.forEach((p) => onLeave(p.raw))}
                    className="min-h-[48px] rounded-full border border-line px-3 py-2 text-small font-bold leading-tight disabled:opacity-50"
                  >
                    Dejar todos sin vincular
                  </button>
                </div>
                <p className="mt-2 text-caption text-muted">Se crean como «Fuerza» y sin video; después los completás desde Ejercicios.</p>
              </div>
            )}
            <ul className="mt-3 space-y-3">
              {pending.map((p) => (
                <ResolveCard
                  key={normalizeText(p.raw)}
                  raw={p.raw}
                  rows={p.rows}
                  suggestion={p.suggestion}
                  exercises={exercises}
                  onLink={(ex) => onLink(p.raw, ex)}
                  onLeave={() => onLeave(p.raw)}
                  onCreate={(name, cat) => onCreate(p.raw, name, cat)}
                />
              ))}
            </ul>
          </section>
        )}

        <section aria-label={`Ejercicios del Día ${current?.label}`}>
          <ImportPreviewTable rows={tableRows} />
          <p className="mt-2 text-caption text-muted">En el celular, deslizá la tabla para ver todas las columnas.</p>
        </section>
      </div>

      <footer className="fixed bottom-0 left-1/2 z-30 w-full max-w-phone -translate-x-1/2 border-t border-line bg-bg/95 px-gutter pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <p className="mb-2 text-center text-small text-muted">
          {pending.length ? "Podés seguir igual: lo no vinculado queda sin video." : "¡Todo vinculado!"}
        </p>
        <PillButton block arrow onClick={onContinue}>
          Asignar a cliente
        </PillButton>
      </footer>
    </div>
  );
}
