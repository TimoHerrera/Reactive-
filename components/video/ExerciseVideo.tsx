"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/exercises";
import { DuotonePlaceholder } from "./ExerciseThumb";

export type PlayerState = { playing: boolean; current: number; duration: number; rate: 1 | 0.5; loop: boolean };
export type PlayerHandle = { play: () => void; pause: () => void; toggle: () => void };

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
function IconPlayBig() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}
function IconLoop() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 2l3 3-3 3" />
      <path d="M4 11V9a4 4 0 0 1 4-4h12" />
      <path d="M7 22l-3-3 3-3" />
      <path d="M20 13v2a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

type Props = {
  src: string | null;
  poster?: string | null;
  /** Duración conocida (para mostrar antes de cargar metadata). */
  durationHint?: number | null;
  /** Overlays arriba del video (volver, «Ejercicio 03 de 09»). */
  overlay?: ReactNode;
  /** Título y chips: van entre el video y los controles, sobre fondo azul oscuro. */
  children?: ReactNode;
  onStateChange?: (s: PlayerState) => void;
};

/**
 * Reproductor 9:16 con controles propios del diseño:
 * play/pausa, velocidad 1× / 0.5×, loop y barra de progreso.
 * <video playsinline muted loop preload="metadata" poster=…>
 */
export const ExerciseVideo = forwardRef<PlayerHandle, Props>(function ExerciseVideo(
  { src, poster, durationHint, overlay, children, onStateChange },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>({
    playing: false,
    current: 0,
    duration: durationHint ?? 0,
    rate: 1,
    loop: true,
  });
  const [failed, setFailed] = useState(false);

  const play = () => void videoRef.current?.play().catch(() => undefined);
  const pause = () => videoRef.current?.pause();
  const toggle = () => (videoRef.current?.paused ? play() : pause());
  useImperativeHandle(ref, () => ({ play, pause, toggle }));

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const update = (patch: Partial<PlayerState>) => setState((s) => ({ ...s, ...patch }));

  const setRate = (rate: 1 | 0.5) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    update({ rate });
  };
  const setLoop = (loop: boolean) => {
    if (videoRef.current) videoRef.current.loop = loop;
    update({ loop });
  };
  const seek = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
    update({ current: t });
  };

  const unavailable = !src || failed;
  const pct = state.duration ? Math.min(100, (state.current / state.duration) * 100) : 0;

  return (
    <section aria-label="Video del ejercicio">
      <div data-video-box className="relative h-[min(62vh,600px)] min-h-[360px] bg-black">
        {unavailable ? (
          <DuotonePlaceholder
            className="absolute inset-0"
            label={src ? "[VIDEO NO DISPONIBLE]" : "[VIDEO 9:16 GRABADO POR EL PROFE]"}
          />
        ) : (
          <video
            ref={videoRef}
            src={src}
            poster={poster ?? undefined}
            className="absolute inset-0 h-full w-full object-contain"
            playsInline
            muted
            loop={state.loop}
            autoPlay
            preload="metadata"
            onClick={toggle}
            onPlay={() => update({ playing: true })}
            onPause={() => update({ playing: false })}
            onTimeUpdate={(e) => update({ current: e.currentTarget.currentTime })}
            onLoadedMetadata={(e) => {
              e.currentTarget.playbackRate = state.rate;
              update({ duration: e.currentTarget.duration || durationHint || 0 });
            }}
            onEnded={() => update({ playing: false })}
            onError={() => setFailed(true)}
          />
        )}
        {overlay}
        {!unavailable && (
          <div className="absolute bottom-6 right-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setRate(state.rate === 1 ? 0.5 : 1)}
              aria-label={state.rate === 1 ? "Pasar a cámara lenta (0.5×)" : "Volver a velocidad normal (1×)"}
              className={cn(
                "display flex h-14 w-14 items-center justify-center rounded-full border text-[1.125rem]",
                state.rate === 0.5 ? "border-accent bg-accent text-ink" : "border-line bg-bg/70 text-ink",
              )}
            >
              {state.rate === 1 ? "1×" : "0.5×"}
            </button>
            <button
              type="button"
              onClick={() => setLoop(!state.loop)}
              aria-pressed={state.loop}
              aria-label={state.loop ? "Desactivar repetición" : "Repetir en loop"}
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full border",
                state.loop ? "border-line bg-bg/70 text-ink" : "border-line bg-bg/40 text-muted line-through",
              )}
            >
              <IconLoop />
            </button>
          </div>
        )}
      </div>

      <div className="h-10 bg-accent-deep" aria-hidden="true" />
      <div className="bg-[#0F1A3D] px-gutter pb-5 pt-5">
        {children}
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={toggle}
            disabled={unavailable}
            aria-label={state.playing ? "Pausar" : "Reproducir"}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-bg disabled:opacity-40"
          >
            {state.playing ? <IconPause /> : <IconPlayBig />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="relative h-5">
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink/20" />
              <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
                style={{ left: `${pct}%` }}
                aria-hidden="true"
              />
              <input
                type="range"
                min={0}
                max={state.duration || 0}
                step={0.1}
                value={state.current}
                onChange={(e) => seek(Number(e.target.value))}
                disabled={unavailable || !state.duration}
                aria-label="Posición del video"
                aria-valuetext={`${formatDuration(state.current)} de ${formatDuration(state.duration)}`}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
            <div className="mt-1 flex justify-between text-small text-title">
              <span>{formatDuration(state.current)}</span>
              <span>{state.rate === 1 ? "Velocidad normal" : "Cámara lenta"}</span>
              <span>{formatDuration(state.duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
