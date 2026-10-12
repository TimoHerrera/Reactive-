"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoutineDraft } from "@/lib/routine/draft";

// El borrador vive en sessionStorage: sobrevive a recargas y a ir y volver entre pasos.
const KEY = "rx-routine-draft";

export function loadDraft(): RoutineDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RoutineDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: RoutineDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // storage lleno/bloqueado: el borrador queda solo en memoria
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nada
  }
}

export function useDraft() {
  const [draft, setDraft] = useState<RoutineDraft | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDraft(loadDraft());
    setLoaded(true);
  }, []);

  const update = useCallback((fn: (d: RoutineDraft) => RoutineDraft) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      saveDraft(next);
      return next;
    });
  }, []);

  return { draft, loaded, update };
}
