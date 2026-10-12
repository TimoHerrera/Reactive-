// Validación de videos antes de subir (tipo, tamaño y duración).

export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const ACCEPT_ATTR = ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm";

export const MAX_VIDEO_MB = Number(process.env.NEXT_PUBLIC_MAX_VIDEO_MB) || 50;
export const MAX_VIDEO_SECONDS = Number(process.env.NEXT_PUBLIC_MAX_VIDEO_SECONDS) || 60;

const EXT_TYPES: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

/** Algunos Android mandan type vacío: lo deducimos de la extensión. */
export function videoMimeType(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? "";
}

export type VideoCheck = { ok: true } | { ok: false; error: string };

const SHRINK_TIP = "Para achicarlo: grabá en 1080p o 720p (no en 4K) y recortá el video a lo justo antes de subirlo.";

export function checkVideoFile(
  file: { name: string; type: string; size: number },
  maxMb: number = MAX_VIDEO_MB,
): VideoCheck {
  const type = videoMimeType(file);
  if (!(ACCEPTED_VIDEO_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "Ese formato no va. Subí un video .mp4, .mov o .webm." };
  }
  const mb = file.size / (1024 * 1024);
  if (mb > maxMb) {
    return { ok: false, error: `El video pesa ${mb.toFixed(0)} MB y el máximo es ${maxMb} MB. ${SHRINK_TIP}` };
  }
  return { ok: true };
}

export function checkVideoDuration(seconds: number, maxSeconds: number = MAX_VIDEO_SECONDS): VideoCheck {
  if (!Number.isFinite(seconds) || seconds <= 0) return { ok: true }; // no se pudo leer: no bloqueamos
  if (seconds > maxSeconds + 0.5) {
    return {
      ok: false,
      error: `El video dura ${Math.round(seconds)} s y el máximo es ${maxSeconds} s. Recortalo desde la galería del celular y volvé a subirlo.`,
    };
  }
  return { ok: true };
}
