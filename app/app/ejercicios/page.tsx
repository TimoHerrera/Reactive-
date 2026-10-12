"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InlineLoading } from "@/components/Loading";
import { FilterChip, Input } from "@/components/ui";
import { ExerciseThumb } from "@/components/video/ExerciseThumb";
import { data, hasVideo } from "@/lib/data";
import { inRegion, REGION_NAMES, searchExercises, type Region } from "@/lib/exercises";
import { useQuery } from "@/lib/hooks";

export default function EjerciciosPage() {
  const exercises = useQuery(() => data.exercises.list(), []);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<Region | "Todos">("Todos");

  const withVideo = useMemo(() => (exercises.data ?? []).filter(hasVideo), [exercises.data]);
  const results = useMemo(
    () =>
      searchExercises(withVideo, query).filter((h) => region === "Todos" || inRegion(h.exercise, region)),
    [withVideo, query, region],
  );

  return (
    <div className="pb-6">
      <header className="px-gutter pb-4 pt-12">
        <h1 className="display text-display-xl text-title">Ejercicios</h1>
        <Input
          search
          className="mt-5"
          placeholder="¿No sabés cómo se llama? Buscalo por músculo o nombre"
          aria-label="Buscar ejercicio por nombre, alias o músculo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-gutter" role="group" aria-label="Filtrar por zona">
        {(["Todos", ...REGION_NAMES] as const).map((r) => (
          <FilterChip key={r} active={region === r} onClick={() => setRegion(r)}>
            {r}
          </FilterChip>
        ))}
      </div>

      <div className="px-gutter">
        {exercises.loading && !exercises.data ? (
          <InlineLoading />
        ) : (
          <>
            <p className="mt-4 text-small text-muted" aria-live="polite">
              {query || region !== "Todos"
                ? `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`
                : `${withVideo.length} videos grabados por tus profes`}
            </p>
            {results.length === 0 ? (
              <p className="mt-10 text-center text-body text-muted">
                No encontramos nada con «{query}». Probá con otro nombre o con el músculo.
              </p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3">
                {results.map(({ exercise: e, matchedAlias }) => (
                  <li key={e.id}>
                    <Link href={`/app/ejercicios/${e.id}`} className="group block rounded-lg">
                      <ExerciseThumb posterPath={e.videoPosterPath} durationS={e.videoDurationS} className="aspect-[4/5]" />
                      <p className="mt-2 text-title-sm leading-tight group-hover:underline">{e.name}</p>
                      <p className="mt-0.5 text-small text-muted">
                        {matchedAlias ? `Alias: ${matchedAlias}` : e.muscleGroups.slice(0, 2).join(" · ")}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
