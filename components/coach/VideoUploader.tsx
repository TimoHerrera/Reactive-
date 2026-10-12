"use client";

import { useRef, useState } from "react";
import { PillButton } from "@/components/ui";
import { useVideoUrl } from "@/components/video/useVideoUrl";
import { data } from "@/lib/data";
import { formatDuration } from "@/lib/exercises";
import { probeVideo } from "@/lib/video/poster";
import { ACCEPT_ATTR, checkVideoDuration, checkVideoFile, MAX_VIDEO_MB, MAX_VIDEO_SECONDS } from "@/lib/video/validate";

export type UploadedVideo = { videoPath: string; videoPosterPath: string | null; videoDurationS: number | null };

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; name: string }
  | { kind: "uploading"; name: string; progress: number }
  | { kind: "error"; message: string };

/**
 * Subir video (acción principal): galería o cámara del celular.
 * Valida tipo, tamaño y duración, genera la miniatura a 1 s y sube con progreso y cancelación.
 */
export function VideoUploader({
  value,
  onUploaded,
  onRemove,
}: {
  value: UploadedVideo | null;
  onUploaded: (v: UploadedVideo) => void;
  onRemove: () => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const preview = useVideoUrl(value?.videoPath);
  const poster = useVideoUrl(value?.videoPosterPath);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const basic = checkVideoFile(file);
    if (!basic.ok) return setPhase({ kind: "error", message: basic.error });

    setPhase({ kind: "reading", name: file.name });
    let probe: Awaited<ReturnType<typeof probeVideo>> | null = null;
    try {
      probe = await probeVideo(file);
    } catch {
      probe = null; // el navegador no lo pudo leer (ej. HEVC): subimos igual
    }
    if (probe) {
      const dur = checkVideoDuration(probe.durationS);
      if (!dur.ok) return setPhase({ kind: "error", message: dur.error });
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: "uploading", name: file.name, progress: 0 });
    try {
      const videoPath = await data.videos.upload(file, {
        name: file.name,
        signal: controller.signal,
        onProgress: (p) => setPhase({ kind: "uploading", name: file.name, progress: p }),
      });
      let videoPosterPath: string | null = null;
      if (probe?.poster) {
        videoPosterPath = await data.videos.upload(probe.poster, { name: `${file.name}.jpg` }).catch(() => null);
      }
      onUploaded({
        videoPath,
        videoPosterPath,
        videoDurationS: probe && probe.durationS >= 1 ? Math.round(probe.durationS) : null,
      });
      setPhase({ kind: "idle" });
    } catch (e) {
      if ((e as Error).name === "AbortError") setPhase({ kind: "idle" });
      else setPhase({ kind: "error", message: "Se cortó la subida. Revisá la conexión y probá de nuevo." });
    } finally {
      abortRef.current = null;
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  const busy = phase.kind === "reading" || phase.kind === "uploading";

  return (
    <div className="space-y-3">
      {/* Inputs ocultos: galería (sin capture) y cámara (capture) */}
      <input ref={galleryRef} type="file" accept={ACCEPT_ATTR} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void handleFile(e.target.files?.[0])} />
      <input ref={cameraRef} type="file" accept="video/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void handleFile(e.target.files?.[0])} />

      {value && !busy ? (
        <div className="flex gap-4 rounded-lg border border-line bg-surface p-3">
          <video
            src={preview.url ?? undefined}
            poster={poster.url ?? undefined}
            className="aspect-[9/16] w-[108px] shrink-0 rounded-md bg-black object-cover"
            controls
            playsInline
            muted
            loop
            preload="metadata"
          />
          <div className="flex min-w-0 flex-col">
            <p className="label">Vista previa</p>
            <p className="mt-1 text-title-sm">Reel 9:16{value.videoDurationS ? ` · ${formatDuration(value.videoDurationS)}` : ""}</p>
            <p className="mt-1 text-small text-muted">Así lo ven tus clientes.</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-3">
              <button type="button" onClick={() => galleryRef.current?.click()} className="h-11 rounded-full border border-line px-4 text-small font-semibold hover:bg-surface-2">
                Reemplazar
              </button>
              <button type="button" onClick={onRemove} className="h-11 rounded-full px-3 text-small font-semibold text-danger-ink hover:bg-surface-2">
                Quitar
              </button>
            </div>
          </div>
        </div>
      ) : phase.kind === "uploading" || phase.kind === "reading" ? (
        <div className="rounded-lg border border-line bg-surface p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-small font-semibold">{phase.name}</p>
            <p className="shrink-0 text-small text-muted">
              {phase.kind === "reading" ? "Revisando…" : `${Math.round(phase.progress * 100)}%`}
            </p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-label="Progreso de la subida"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={phase.kind === "uploading" ? Math.round(phase.progress * 100) : 0}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${phase.kind === "uploading" ? phase.progress * 100 : 4}%` }}
            />
          </div>
          {phase.kind === "uploading" && (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="mt-3 h-11 rounded-full border border-line px-4 text-small font-semibold hover:bg-surface-2"
            >
              Cancelar subida
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <PillButton block onClick={() => galleryRef.current?.click()}>
            Subir video
          </PillButton>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex h-11 w-full items-center justify-center rounded-full border border-line text-small font-semibold hover:bg-surface-2"
          >
            Grabar con la cámara
          </button>
        </div>
      )}

      {phase.kind === "error" && (
        <p role="alert" className="text-small font-medium text-danger-ink">
          ✕ {phase.message}
        </p>
      )}
      <p className="text-caption text-muted">
        .mp4, .mov o .webm · hasta {MAX_VIDEO_MB} MB y {MAX_VIDEO_SECONDS} s. Tip iPhone: en Ajustes → Cámara → Formatos
        elegí <strong className="text-title">«Más compatible»</strong> para que se vea bien también en Android.
      </p>
    </div>
  );
}
