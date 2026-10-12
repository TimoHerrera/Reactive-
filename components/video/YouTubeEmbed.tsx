import { cn } from "@/lib/cn";
import { parseYouTubeUrl, youTubeEmbedUrl, youTubeWatchUrl } from "@/lib/video/youtube";

/** Fallback cuando no hay video subido pero sí link de YouTube (embed sin cookies). */
export function YouTubeEmbed({ url, title, className }: { url: string; title: string; className?: string }) {
  const ref = parseYouTubeUrl(url);
  if (!ref) return null;
  return (
    <div className={cn("relative w-full bg-black", ref.isShort ? "mx-auto aspect-[9/16] max-h-[70vh]" : "aspect-video", className)}>
      <iframe
        src={youTubeEmbedUrl(ref)}
        title={`Video de ${title}`}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

/** Botón secundario «Ver en YouTube ↗» (abre la app o una pestaña nueva). */
export function YouTubeLink({ url, className }: { url: string; className?: string }) {
  const ref = parseYouTubeUrl(url);
  if (!ref) return null;
  return (
    <a
      href={youTubeWatchUrl(ref)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-small font-semibold text-ink hover:bg-surface-2",
        className,
      )}
    >
      Ver en YouTube <span aria-hidden="true">↗</span>
    </a>
  );
}
