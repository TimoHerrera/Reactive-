"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { data } from "@/lib/data";
import { subscribeMockDb } from "@/lib/data/mock/store";
import { onSessionChange } from "@/lib/auth/session-events";

export type QueryState<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => Promise<void>;
  /** Actualiza el valor local sin refetch (UI optimista). */
  setData: (updater: (prev: T | undefined) => T | undefined) => void;
};

/**
 * Carga asíncrona simple desde la capa de datos.
 * Se vuelve a ejecutar cuando cambian `deps` y, en modo mock, cuando cambia la base (otra pestaña, otra pantalla).
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[], opts: { live?: boolean } = {}): QueryState<T> {
  const live = opts.live ?? true;
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; loading: boolean }>({
    data: undefined,
    error: null,
    loading: true,
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true }));
    try {
      const value = await fnRef.current();
      if (id === seq.current) setState({ data: value, error: null, loading: false });
    } catch (e) {
      if (id === seq.current) setState((s) => ({ ...s, error: e as Error, loading: false }));
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (data.kind !== "mock" || !live) return;
    return subscribeMockDb(() => void run(true));
  }, [run, live]);

  // Cambió el usuario (login/logout/activación): se descartan los datos del anterior —y cualquier respuesta
  // en vuelo— y se vuelve a pedir con la sesión nueva. Nunca se muestran datos de otra sesión.
  useEffect(
    () =>
      onSessionChange(() => {
        seq.current++;
        setState({ data: undefined, error: null, loading: true });
        void run();
      }),
    [run],
  );

  const setData = useCallback((updater: (prev: T | undefined) => T | undefined) => {
    setState((s) => ({ ...s, data: updater(s.data) }));
  }, []);

  return { ...state, reload: () => run(true), setData };
}
