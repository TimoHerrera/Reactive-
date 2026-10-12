"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loading } from "@/components/Loading";
import { useSession } from "@/components/SessionProvider";
import { PillButton, StatusBadge } from "@/components/ui";
import { IconArrowLeft, IconPlay } from "@/components/ui/icons";
import { DuotonePlaceholder } from "@/components/video/ExerciseThumb";
import { ExerciseVideo, type PlayerHandle, type PlayerState } from "@/components/video/ExerciseVideo";
import { useVideoUrl } from "@/components/video/useVideoUrl";
import { YouTubeEmbed, YouTubeLink } from "@/components/video/YouTubeEmbed";
import { cn } from "@/lib/cn";
import { data, isStaff, type Exercise } from "@/lib/data";
import { formatDuration } from "@/lib/exercises";
import { useQuery } from "@/lib/hooks";
import { pad2 } from "@/components/ui/ExerciseCard";
import { currentRoutine } from "@/lib/routine/status";
import { locateItem, type LocatedItem } from "@/lib/routine/locate";

function useLocatedItem(clientId: string | undefined, itemId: string | null) {
  return useQuery(async (): Promise<LocatedItem | null> => {
    if (!clientId || !itemId) return null;
    const routines = await data.routines.listForClient(clientId);
    const cur = currentRoutine(routines);
    const tree = cur ? await data.routines.getTree(cur.id) : null;
    return tree ? locateItem(tree, itemId) : null;
  }, [clientId, itemId]);
}

function SeriesCard({ located }: { located: LocatedItem }) {
  const { item, day } = located;
  const stats = [
    item.sets || item.reps ? { value: item.sets && item.reps ? `${item.sets} × ${item.reps}` : (item.reps ?? `${item.sets}`), label: "Series × reps" } : null,
    item.load ? { value: item.load, label: "Carga" } : null,
    item.rest ? { value: item.rest, label: "Descanso" } : null,
    item.tempo ? { value: item.tempo, label: "Tempo" } : null,
  ].filter(Boolean) as { value: string; label: string }[];

  return (
    <section className="rounded-lg border-2 border-accent bg-surface p-4" aria-label="Tu serie de hoy">
      <p className="label">Tu serie de hoy · Día {day.label}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 min-[360px]:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="sr-only">{s.label}</dt>
            <dd className="display text-[1.75rem] leading-none">{s.value}</dd>
            <p aria-hidden="true" className="mt-1 text-caption text-muted">
              {s.label}
            </p>
          </div>
        ))}
      </dl>
      {item.notes && (
        <p className="mt-3 text-small text-title">
          <strong className="text-ink">Profe:</strong> {item.notes}
        </p>
      )}
    </section>
  );
}

function Chips({ exercise }: { exercise: Exercise }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {exercise.muscleGroups.map((m) => (
        <li key={m} className="rounded-full bg-ink px-3 py-1 text-small font-semibold text-bg">
          {m}
        </li>
      ))}
      {exercise.equipment && (
        <li className="rounded-full border border-ink/60 px-3 py-1 text-small font-semibold text-ink">{exercise.equipment}</li>
      )}
    </ul>
  );
}

export function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const fromRutina = params.get("from") === "rutina";
  const itemId = params.get("item");

  const exercise = useQuery(() => data.exercises.get(id), [id]);
  const located = useLocatedItem(user && !isStaff(user.role) ? user.id : undefined, fromRutina ? itemId : null);
  const video = useVideoUrl(exercise.data?.videoPath);
  const poster = useVideoUrl(exercise.data?.videoPosterPath);

  // Registrar la vista (una vez por apertura; solo clientes).
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    if (!user || isStaff(user.role) || !exercise.data || recorded.current === id) return;
    recorded.current = id;
    void data.views.record(user.id, id);
  }, [user, exercise.data, id]);

  // Header compacto al scrollear (y pausa del video).
  const heroRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerHandle>(null);
  const [compact, setCompact] = useState(false);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const onPlayerState = useCallback((s: PlayerState) => setPlayer(s), []);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    let wasCompact = false;
    const check = () => {
      // Compacto cuando el video ya quedó tapado (aunque se vean el título y los controles).
      const box = el.querySelector("[data-video-box]") ?? el;
      const hidden = box.getBoundingClientRect().bottom < 120;
      if (hidden !== wasCompact) {
        wasCompact = hidden;
        setCompact(hidden);
        if (hidden) playerRef.current?.pause();
      }
    };
    window.addEventListener("scroll", check, { passive: true });
    check();
    return () => window.removeEventListener("scroll", check);
  }, [exercise.data]);

  if (exercise.loading && !exercise.data) return <Loading />;
  const e = exercise.data;
  if (!e) {
    return (
      <div className="px-gutter pt-16 text-center">
        <p className="display text-h1">Ejercicio no encontrado</p>
        <PillButton href="/app/ejercicios" variant="inverse" className="mt-8">
          Ver ejercicios
        </PillButton>
      </div>
    );
  }

  const backHref = fromRutina
    ? `/app/rutina${located.data ? `?dia=${located.data.day.id}&item=${located.data.item.id}` : ""}`
    : "/app/ejercicios";
  const backLabel = fromRutina ? "Volver a mi rutina" : "Volver a ejercicios";
  const goBack = () => {
    // Si venimos de la rutina dentro de la app, «atrás» conserva el estado; si se abrió directo, navegamos.
    if (fromRutina && window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push(backHref);
  };

  const backButton = (
    <button
      type="button"
      onClick={goBack}
      aria-label={backLabel}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2/90 text-[1.375rem] text-ink"
    >
      <IconArrowLeft />
    </button>
  );

  const hasUpload = !!e.videoPath;
  const status = player
    ? `${player.playing ? "Reproduciendo" : "Video en pausa"} · ${formatDuration(player.current)} / ${formatDuration(player.duration)}`
    : "";

  return (
    <article className="pb-28">
      {/* Header compacto (aparece al scrollear) */}
      <div
        className={cn(
          "fixed left-1/2 top-0 z-30 w-full max-w-phone -translate-x-1/2 border-b border-line bg-bg/95 px-gutter py-3 backdrop-blur transition-transform",
          compact ? "translate-y-0" : "-translate-y-full",
        )}
        aria-hidden={!compact}
      >
        <div className="flex items-center gap-3">
          {backButton}
          {hasUpload && (
            <button
              type="button"
              tabIndex={compact ? 0 : -1}
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
                playerRef.current?.play();
              }}
              aria-label="Volver al video y reproducir"
              className="relative h-[72px] w-[48px] shrink-0 overflow-hidden rounded-md"
            >
              {poster.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <DuotonePlaceholder className="h-full w-full" />
              )}
              <span className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-[0.6rem] text-ink">
                <IconPlay />
              </span>
            </button>
          )}
          <div className="min-w-0">
            <p className="display truncate text-[1.75rem]">{e.name}</p>
            {hasUpload && <p className="text-small text-muted">{status}</p>}
          </div>
        </div>
      </div>

      <div ref={heroRef}>
        {hasUpload ? (
          <ExerciseVideo
            ref={playerRef}
            src={video.loading ? null : video.url}
            poster={poster.url}
            durationHint={e.videoDurationS}
            onStateChange={onPlayerState}
            overlay={
              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                {backButton}
                {located.data && (
                  <span className="rounded-full bg-bg/80 px-3 py-1.5 text-small font-bold">
                    Ejercicio {pad2(located.data.index)} de {pad2(located.data.total)}
                  </span>
                )}
              </div>
            }
          >
            <h1 className="display text-display-section">{e.name}</h1>
            <div className="mt-3">
              <Chips exercise={e} />
            </div>
          </ExerciseVideo>
        ) : (
          <div>
            <div className="flex items-center justify-between px-gutter pb-4 pt-6">
              {backButton}
              {located.data && (
                <span className="rounded-full bg-surface-2 px-3 py-1.5 text-small font-bold">
                  Ejercicio {pad2(located.data.index)} de {pad2(located.data.total)}
                </span>
              )}
            </div>
            {e.youtubeUrl ? (
              <YouTubeEmbed url={e.youtubeUrl} title={e.name} />
            ) : (
              <DuotonePlaceholder className="mx-gutter h-48 rounded-lg" label="TODAVÍA SIN VIDEO" />
            )}
            <div className="px-gutter pt-5">
              <h1 className="display text-display-section">{e.name}</h1>
              <div className="mt-3">
                <Chips exercise={e} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6 px-gutter pt-6">
        {hasUpload && e.youtubeUrl && <YouTubeLink url={e.youtubeUrl} />}

        {located.data && <SeriesCard located={located.data} />}

        {e.techniqueCues.length > 0 && (
          <section>
            <h2 className="display text-h2 text-title">Claves técnicas</h2>
            <ul className="mt-3 space-y-3">
              {e.techniqueCues.map((c, i) => (
                <li key={i} className="flex gap-3 text-body">
                  <span className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-[2px] bg-accent" aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        {e.commonMistakes.length > 0 && (
          <section className="rounded-lg border border-line bg-surface p-4">
            <h2 className="flex flex-wrap items-center gap-2">
              <StatusBadge status="no-hagas-esto" />
              <span className="display text-[1.625rem]">Errores comunes</span>
            </h2>
            <ul className="mt-3 space-y-3">
              {e.commonMistakes.map((m, i) => (
                <li key={i} className="flex gap-3 text-body">
                  <span className="font-bold text-danger" aria-hidden="true">
                    ✕
                  </span>
                  {m}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* «← VOLVER A MI RUTINA» fijo abajo (esta pantalla no tiene tab bar) */}
      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-phone -translate-x-1/2 border-t border-line bg-bg/95 px-gutter pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {fromRutina ? (
          <PillButton variant="inverse" block onClick={goBack}>
            ← {backLabel}
          </PillButton>
        ) : (
          <Link
            href="/app/ejercicios"
            className="display flex h-14 w-full items-center justify-center rounded-full bg-ink text-button text-bg"
          >
            ← {backLabel}
          </Link>
        )}
      </div>
    </article>
  );
}
