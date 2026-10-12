// Videos en modo mock: los archivos subidos se guardan en IndexedDB (sobreviven a recargas)
// y se reproducen con URL.createObjectURL. Los del seed apuntan a /public/mock-videos.
import type { VideosRepo } from "../repositories";
import { uuid } from "./store";

const DB_NAME = "reactive-mock-videos";
const STORE = "files";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const conn = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const urlCache = new Map<string, string>();

export const mockVideos: VideosRepo = {
  async upload(file, { name, onProgress, signal }) {
    // Simula una subida con progreso (y cancelable) para probar la UI.
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      if (signal?.aborted) throw new DOMException("Subida cancelada", "AbortError");
      await new Promise((r) => setTimeout(r, 60));
      onProgress?.(i / steps);
    }
    const safe = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const path = `mock/${uuid()}-${safe}`;
    await idb("readwrite", (s) => s.put(file, path));
    return path;
  },

  async getUrl(path) {
    if (path.startsWith("seed/")) return `/mock-videos/${path.slice(5)}`;
    const cached = urlCache.get(path);
    if (cached) return cached;
    try {
      const blob = await idb<Blob | undefined>("readonly", (s) => s.get(path));
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urlCache.set(path, url);
      return url;
    } catch {
      return null;
    }
  },

  async remove(path) {
    if (!path.startsWith("mock/")) return;
    const url = urlCache.get(path);
    if (url) URL.revokeObjectURL(url);
    urlCache.delete(path);
    await idb("readwrite", (s) => s.delete(path));
  },
};
