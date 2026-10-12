// Links de YouTube: validación y embed «youtube-nocookie».

export type YouTubeRef = { id: string; isShort: boolean };

const ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeUrl(input: string | null | undefined): YouTubeRef | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  let id: string | null = null;
  let isShort = false;

  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live" || parts[0] === "v") {
      id = parts[1] ?? null;
      isShort = parts[0] === "shorts";
    }
  }
  return id && ID.test(id) ? { id, isShort } : null;
}

export function isValidYouTubeUrl(input: string | null | undefined): boolean {
  return parseYouTubeUrl(input) !== null;
}

export function youTubeEmbedUrl(ref: YouTubeRef): string {
  return `https://www.youtube-nocookie.com/embed/${ref.id}?playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${ref.id}`;
}

/** Link para abrir en la app de YouTube o en una pestaña nueva. */
export function youTubeWatchUrl(ref: YouTubeRef): string {
  return ref.isShort ? `https://www.youtube.com/shorts/${ref.id}` : `https://www.youtube.com/watch?v=${ref.id}`;
}
