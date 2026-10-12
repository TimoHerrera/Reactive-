"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { InlineLoading } from "@/components/Loading";
import { Input, PillButton, StatusBadge } from "@/components/ui";
import { ExerciseThumb } from "@/components/video/ExerciseThumb";
import { cn } from "@/lib/cn";
import { data, hasVideo, type Exercise } from "@/lib/data";
import { exerciseMeta, searchExercises } from "@/lib/exercises";
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

function CoachEjercicios() {
  const params = useSearchParams();
  const exercises = useQuery(() => data.exercises.list(), []);
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(params.get("sin-video") === "1");

  const all = useMemo(() => exercises.data ?? [], [exercises.data]);
  const missing = useMemo(() => all.filter((e) => !hasVideo(e)).length, [all]);
  const results = useMemo(
    () => searchExercises(all, query).filter((h) => !onlyMissing || !hasVideo(h.exercise)),
    [all, query, onlyMissing],
  );

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

        {exercises.loading && !exercises.data ? (
          <InlineLoading />
        ) : results.length === 0 ? (
          <p className="mt-10 text-center text-muted">
            {onlyMissing ? "¡Todos los ejercicios tienen video!" : `No hay ejercicios que coincidan con «${query}».`}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {results.map(({ exercise: e, matchedAlias }) => {
              const video = hasVideo(e);
              const both = !!e.videoPath && !!e.youtubeUrl;
              return (
                <li key={e.id}>
                  <Link
                    href={`/coach/ejercicios/${e.id}`}
                    className="flex min-h-[76px] items-center gap-3 rounded-lg border border-line bg-surface p-3 hover:bg-surface-2"
                  >
                    {video ? (
                      <ExerciseThumb
                        posterPath={e.videoPosterPath}
                        showPlay={false}
                        className="h-[52px] w-[52px] shrink-0 rounded-md"
                      />
                    ) : (
                      <NoVideoIcon />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-title-sm leading-tight">{e.name}</p>
                      <p className="mt-0.5 truncate text-small text-muted">
                        {matchedAlias ? `Alias: ${matchedAlias}` : exerciseMeta(e)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {!video && <StatusBadge status="sin-video" />}
                      {both && <StatusBadge status="video-yt" />}
                      {aliasLabel(e) && <span className="text-small text-muted">{aliasLabel(e)}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
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
