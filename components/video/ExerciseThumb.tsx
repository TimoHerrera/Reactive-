"use client";

import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/exercises";
import { IconPlay } from "@/components/ui/icons";
import { useVideoUrl } from "./useVideoUrl";

/** Placeholder del diseño: grilla + banda azul (duotono). */
export function DuotonePlaceholder({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn("bg-grid overflow-hidden bg-surface-2", !className?.includes("absolute") && "relative", className)}
      aria-hidden="true"
    >
      <div className="absolute inset-x-0 bottom-0 h-[24%] bg-accent-deep" />
      {label && (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-caption font-bold tracking-[.1em] text-muted">
          {label}
        </p>
      )}
    </div>
  );
}

/** Miniatura 9:16 (o la proporción que le des) con ▶ y duración. */
export function ExerciseThumb({
  posterPath,
  durationS,
  showPlay = true,
  className,
}: {
  posterPath: string | null;
  durationS?: number | null;
  showPlay?: boolean;
  className?: string;
}) {
  const { url } = useVideoUrl(posterPath);
  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-line", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmada/objectURL, no pasa por next/image
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <DuotonePlaceholder className="absolute inset-0" />
      )}
      {showPlay && (
        <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-small text-ink">
          <IconPlay />
        </span>
      )}
      {durationS ? (
        <span className="absolute bottom-2 right-2 rounded-sm bg-bg/85 px-1.5 py-0.5 text-caption font-bold text-ink">
          {formatDuration(durationS)}
        </span>
      ) : null}
    </div>
  );
}
