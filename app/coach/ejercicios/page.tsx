"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { InlineLoading } from "@/components/Loading";
import { FilterChip, Input, PillButton, StatusBadge } from "@/components/ui";
import { ExerciseThumb } from "@/components/video/ExerciseThumb";
import { cn } from "@/lib/cn";
import { data, hasVideo, type Exercise } from "@/lib/data";
import { exerciseMeta, groupByRegion, inRegion, REGION_NAMES, searchExercises, type Region } from "@/lib/exercises";
import { useQuery } from "@/lib/hooks";

function NoVideoIcon() {
  return (
    <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-md border-2 border-dashed border-warning text-warning">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3M3 3l18 18" />
      </svg>
    </span>
  );
}

function aliasLabel(e: Exercise) {
  const n = e.aliases.length;
  if (!n) return null;
  return `${n} alias`;
}

type Hit = ReturnType<typeof searchExercises>[number];

function ExerciseRow({ hit: { exercise: e, matchedAlias } }: { hit: Hit }) {
  const video = hasVideo(e);
  const both = !!e.videoPath && !!e.youtubeUrl;
  return (
    <li>
      <Link
        href={`/coach/ejercicios/${e.id}`}
        className="flex min-h-[76px] items-center gap-3 rounded-lg border border-line bg-surface p-3 hover:bg-surface-2"
      >
        {video ? (
          <ExerciseThumb posterPath={e.videoPosterPath} showPlay={false} className="h-[52px] w-[52px] shrink-0 rounded-md" />
        ) : (
          <NoVideoIcon />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-title-sm leading-tight">{e.name}</p>
          <p className="mt-0.5 truncate text-small text-muted">{matchedAlias ? `Alias: ${matchedAlias}` : exerciseMeta(e)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {!video && <StatusBadge status="sin-video" />}
          {both && <StatusBadge status="video-yt" />}
          {aliasLabel(e) && <span className="text-small text-muted">{aliasLabel(e)}</span>}
        </div>
      </Link>
    </li>
  );
}

function CoachEjercicios() {
  const params = useSearchParams();
  const exercises = useQuery(() => data.exercises.list(), []);
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(params.get("sin-video") === "1");
  // Mismas zonas que la biblioteca del cliente.
  const [region, setRegion] = useState<Region | "Todos">("Todos");

  const all = useMemo(() => exercises.data ?? [], [exercises.data]);
  const missing = useMemo(() => all.filter((e) => !hasVideo(e)).length, [all]);
  // Búsqueda + «sin video»; la zona se aplica después (así los chips muestran cuántos hay en cada una).
  const matching = useMemo(
    () => searchExercises(all, query).filter((h) => !onlyMissing || !hasVideo(h.exercise)),
    [all, query, onlyMissing],
  );
  const results = useMemo(
    () => matching.filter((h) => region === "Todos" || inRegion(h.exercise, region)),
    [matching, region],
  );
  // En «Todos» y sin búsqueda: secciones por zona. Buscando, la lista va por relevancia.
  const sections = region === "Todos" && !query.trim() ? groupByRegion(results) : null;

  return (
    <div className="pb-6">
      <header className="flex items-center justify-between gap-3 px-gutter pb-4 pt-12">
        <h1 className="display text-display-xl text-title">Ejercicios</h1>
        <PillButton href="/coach/ejercicios/nuevo" size="md" className="shrink-0">
          + Ejercicio
        </PillButton>
      </header>
      <div className="px-gutter">
        <Input
          search
          placeholder="Nombre, alias o músculo"
          aria-label="Buscar ejercicio por nombre, alias o músculo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-small text-muted">
            {all.length} ejercicios · {missing} sin video
          </p>
          <button
            type="button"
            aria-pressed={onlyMissing}
            onClick={() => setOnlyMissing((v) => !v)}
            className={cn(
              "h-11 shrink-0 rounded-full px-4 text-small font-semibold transition-colors",
              onlyMissing ? "bg-warning text-bg" : "border border-line bg-surface text-ink hover:bg-surface-2",
            )}
          >
            Ver solo sin video ({missing})
          </button>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-gutter" role="group" aria-label="Filtrar por zona">
        {(["Todos", ...REGION_NAMES] as const).map((r) => (
          <FilterChip key={r} active={region === r} onClick={() => setRegion(r)}>
            {r}{" "}
            <span className={region === r ? "text-ink/80" : "text-muted"}>
              {exercises.data ? (r === "Todos" ? matching.length : matching.filter((h) => inRegion(h.exercise, r)).length) : ""}
            </span>
          </FilterChip>
        ))}
      </div>

      <div className="px-gutter">
        {exercises.loading && !exercises.data ? (
          <InlineLoading />
        ) : results.length === 0 ? (
          <p className="mt-10 text-center text-muted">
            {query
              ? `No hay ejercicios que coincidan con «${query}».`
              : onlyMissing
                ? region === "Todos"
                  ? "¡Todos los ejercicios tienen video!"
                  : `¡Todos los de ${region} tienen video!`
                : `Todavía no hay ejercicios de ${region}.`}
          </p>
        ) : sections ? (
          sections.map((g) => (
            <section key={g.region} className="mt-6" aria-labelledby={`zona-${g.region}`}>
              <h2 id={`zona-${g.region}`} className="display flex items-baseline justify-between text-h2 text-title">
                {g.region}
                <span className="text-small font-normal not-italic text-muted">
                  {g.items.length} {g.items.length === 1 ? "ejercicio" : "ejercicios"}
                </span>
              </h2>
              <ul className="mt-3 space-y-3">
                {g.items.map((hit) => (
                  <ExerciseRow key={hit.exercise.id} hit={hit} />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <ul className="mt-4 space-y-3">
            {results.map((hit) => (
              <ExerciseRow key={hit.exercise.id} hit={hit} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CoachEjerciciosPage() {
  return (
    <Suspense fallback={<InlineLoading />}>
      <CoachEjercicios />
    </Suspense>
  );
}
