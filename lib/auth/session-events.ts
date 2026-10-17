// Cambios de sesión (login, logout, activación): avisan a las queries para que descarten los datos
// del usuario anterior y limpian el estado de la pestaña que pertenece a una sesión.

const listeners = new Set<() => void>();

export function onSessionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitSessionChange() {
  listeners.forEach((fn) => fn());
}

// Sesión revocada: el usuario fue desactivado o eliminado con la sesión abierta.
// La capa de datos lo detecta en la próxima acción y la app lo manda al login.
const revokedListeners = new Set<() => void>();

export function onSessionRevoked(fn: () => void): () => void {
  revokedListeners.add(fn);
  return () => revokedListeners.delete(fn);
}

export function emitSessionRevoked() {
  revokedListeners.forEach((fn) => fn());
}

/**
 * Claves de sessionStorage atadas al usuario: borrador de rutina, «Ver como», posición en Mi Rutina…
 * Todas empiezan con «rx-». Se borran al entrar y al salir para que nada pase de una sesión a otra.
 */
export function clearSessionScopedStorage() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith("rx-")) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // sin storage: nada que limpiar
  }
}

/**
 * Cambio de sesión completo: limpia el estado de la pestaña y navega con recarga real,
 * así no sobrevive nada en memoria (estado de React, caché de rutas de Next) del usuario anterior.
 */
export function hardNavigate(path: string) {
  clearSessionScopedStorage();
  emitSessionChange();
  window.location.replace(path);
}
