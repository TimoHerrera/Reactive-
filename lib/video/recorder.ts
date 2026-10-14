// Grabar con la cámara desde la app (PC y celular): formato de grabación, nombre del archivo y
// mensajes de error del permiso. Puro y testeable; el componente es components/coach/CameraRecorder.tsx.

/** Formatos que intentamos grabar, en orden. Safari graba mp4; Chrome/Firefox/Android, webm. */
const CANDIDATES = [
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

/** Primer formato que soporta este navegador (o "" para que elija él). */
export function pickRecorderMime(isTypeSupported: (type: string) => boolean): string {
  for (const t of CANDIDATES) {
    try {
      if (isTypeSupported(t)) return t;
    } catch {
      // algunos navegadores tiran en vez de devolver false
    }
  }
  return "";
}

/** «video/webm;codecs=vp9» → «video/webm» (lo que aceptan la validación y el bucket). */
export function baseMime(mime: string): "video/mp4" | "video/webm" {
  return mime.startsWith("video/mp4") ? "video/mp4" : "video/webm";
}

/** Archivo listo para el mismo flujo que «Subir video». */
export function recordingFile(chunks: Blob[], mime: string, now: Date = new Date()): File {
  const type = baseMime(mime);
  const ext = type === "video/mp4" ? "mp4" : "webm";
  const stamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return new File(chunks, `grabacion-${stamp}.${ext}`, { type });
}

export type Device = "iphone" | "android" | "pc";

export function detectDevice(userAgent: string): Device {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iphone";
  if (/Android/i.test(userAgent)) return "android";
  return "pc";
}

/** Cómo volver a habilitar la cámara si quedó bloqueada, según el dispositivo. */
export const ENABLE_STEPS: Record<Device, string[]> = {
  pc: [
    "Tocá el candado (o el ícono de cámara tachada) a la izquierda de la dirección, arriba.",
    "En «Cámara» elegí «Permitir» (y en «Micrófono», si querés grabar con sonido).",
    "Volvé a tocar «Habilitar cámara».",
  ],
  android: [
    "Tocá el candado a la izquierda de la dirección, arriba (en Chrome: ⋮ → Configuración → Configuración de sitios → Cámara).",
    "Elegí «Permitir» para la cámara.",
    "Volvé a tocar «Habilitar cámara».",
  ],
  iphone: [
    "Tocá «aA» en la barra de direcciones → Configuración del sitio web → Cámara → Permitir.",
    "Si no aparece: Ajustes del iPhone → Safari → Cámara → Permitir (o «Preguntar»).",
    "Volvé a tocar «Habilitar cámara».",
  ],
};

export type CameraProblem = "denied" | "no-camera" | "busy" | "insecure" | "unsupported" | "unknown";

/** Error de getUserMedia → motivo para mostrar. */
export function cameraProblem(err: unknown): CameraProblem {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no-camera";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  if (name === "NotSupportedError") return "unsupported";
  return "unknown";
}

export const PROBLEM_MESSAGES: Record<CameraProblem, string> = {
  denied: "La cámara está bloqueada para esta página.",
  "no-camera": "No encontramos una cámara en este dispositivo.",
  busy: "La cámara la está usando otra app (videollamada, cámara del celular…). Cerrala y probá de nuevo.",
  insecure: "Para usar la cámara, la página tiene que abrirse con https://.",
  unsupported: "Este navegador no deja grabar desde la página.",
  unknown: "No pudimos abrir la cámara.",
};

/** «0:07 / 1:00» */
export function recordingClock(elapsedS: number, maxS: number): string {
  const f = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return `${f(Math.min(elapsedS, maxS))} / ${f(maxS)}`;
}
