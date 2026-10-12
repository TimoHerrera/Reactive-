// Flujo Rutina → Video → Volver: se guarda el día y la posición de scroll al abrir un video
// y se restauran al volver (mismo día, misma posición).

const KEY = "rx-rutina-pos";
const NAV_KEY = "rx-rutina-nav";

export type RutinaPos = { dayId: string; y: number; itemId: string; at: number };

export function saveRutinaPos(pos: Omit<RutinaPos, "at">) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...pos, at: Date.now() }));
    sessionStorage.setItem(NAV_KEY, "1");
  } catch {
    // sin storage: se vuelve al principio del día
  }
}

/** Lee y borra la posición guardada (válida por 30 minutos). */
export function takeRutinaPos(): RutinaPos | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const pos = JSON.parse(raw) as RutinaPos;
    return Date.now() - pos.at < 30 * 60_000 ? pos : null;
  } catch {
    return null;
  }
}

/** ¿Se llegó al video desde Mi Rutina dentro de la app? (para usar «atrás» del historial). */
export function cameFromRutina(): boolean {
  try {
    return sessionStorage.getItem(NAV_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mi Rutina lo limpia al montarse: el flag vale solo para el video que se abrió desde ahí. */
export function clearRutinaNav() {
  try {
    sessionStorage.removeItem(NAV_KEY);
  } catch {
    // nada
  }
}
