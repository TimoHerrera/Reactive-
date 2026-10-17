"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { data, type ItemCheck, type Profile, type Routine, type RoutineTree, type WorkoutSession } from "@/lib/data";
import { addDays, startOfWeek, todayISO } from "@/lib/dates";
import { useQuery } from "@/lib/hooks";
import { itemsOfDay } from "@/lib/routine/locate";
import { sessionForDay } from "@/lib/routine/progress";
import { currentRoutine } from "@/lib/routine/status";
import { useViewedClient } from "./useViewedClient";

export type ClientRoutineData = {
  client: Profile | null;
  coach: Profile | null;
  routine: RoutineTree | null;
  /** Quién cargó y quién editó la rutina actual (perfiles de staff). */
  author: Profile | null;
  editor: Profile | null;
  routines: Routine[];
  sessions: WorkoutSession[];
  checks: ItemCheck[];
};

const PENDING = "pending-session";

/**
 * Todo lo que necesitan Hoy, Mi Rutina y Perfil.
 * `toggleItem` marca/desmarca con UI optimista: actualiza al toque y sincroniza en segundo plano
 * (crea la sesión del día si no existe y la marca completa cuando están todos los ítems).
 */
export function useClientRoutine() {
  const { clientId, viewingAs, ready } = useViewedClient();
  const [syncError, setSyncError] = useState<string | null>(null);

  const query = useQuery(async (): Promise<ClientRoutineData | null> => {
    if (!clientId) return null;
    const [client, routines] = await Promise.all([data.profiles.get(clientId), data.routines.listForClient(clientId)]);
    const cur = currentRoutine(routines.filter((r) => r.publishedAt));
    const [coach, routine, sessions] = await Promise.all([
      client?.coachId ? data.profiles.get(client.coachId) : Promise.resolve(null),
      cur ? data.routines.getTree(cur.id) : Promise.resolve(null),
      cur
        ? data.sessions.list({ clientId, routineId: cur.id, since: new Date(`${addDays(startOfWeek(todayISO()), -1)}T00:00:00`).toISOString() })
        : Promise.resolve([] as WorkoutSession[]),
    ]);
    const staffProfile = (id: string | null | undefined) => (id ? (id === coach?.id ? Promise.resolve(coach) : data.profiles.get(id)) : Promise.resolve(null));
    const [checks, author, editor] = await Promise.all([
      data.sessions.listChecks(sessions.map((s) => s.id)),
      staffProfile(routine?.createdBy),
      staffProfile(routine?.updatedBy && routine.updatedBy !== routine.createdBy ? routine.updatedBy : null),
    ]);
    return { client, coach, routine, routines, sessions, checks, author, editor };
  }, [clientId], { live: false });

  // Semana a semana (lunes a domingo): si la app quedó abierta (o en segundo plano) y empezó otra
  // semana, al volver se recarga y los días aparecen sin hacer. El historial queda guardado.
  const loadedWeek = useRef(startOfWeek(todayISO()));
  const reloadRef = useRef(query.reload);
  reloadRef.current = query.reload;
  useEffect(() => {
    const check = () => {
      const week = startOfWeek(todayISO());
      if (week === loadedWeek.current || document.visibilityState !== "visible") return;
      loadedWeek.current = week;
      void reloadRef.current();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const id = setInterval(check, 60_000); // abierta y en pantalla justo a la medianoche del domingo
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      clearInterval(id);
    };
  }, []);

  const { setData } = query;
  // Último estado (incluye lo optimista) para la cola de sincronización.
  const dataRef = useRef<ClientRoutineData | null>(null);
  dataRef.current = query.data ?? null;
  const update = useCallback(
    (fn: (prev: ClientRoutineData) => ClientRoutineData) =>
      setData((prev) => {
        const next = prev ? fn(prev) : prev;
        dataRef.current = next ?? null;
        return next;
      }),
    [setData],
  );
  // Una cola por día para que dos toques rápidos no creen dos sesiones.
  const queues = useRef(new Map<string, Promise<void>>());

  const toggleItem = useCallback(
    (dayId: string, itemId: string) => {
      const snapshot = dataRef.current;
      if (!snapshot?.routine || !clientId || viewingAs) return;
      const day = snapshot.routine.days.find((d) => d.id === dayId);
      if (!day) return;
      const existing = sessionForDay(snapshot.sessions, dayId);
      const sessionId = existing?.id ?? PENDING;
      const wasChecked = snapshot.checks.some((c) => c.sessionId === sessionId && c.itemId === itemId);

      // 1) UI optimista
      update((prev) => {
        const sessions = existing
          ? prev.sessions
          : [
              ...prev.sessions,
              { id: PENDING, clientId, routineId: prev.routine!.id, dayId, startedAt: new Date().toISOString(), completedAt: null },
            ];
        const checks = wasChecked
          ? prev.checks.filter((c) => !(c.sessionId === sessionId && c.itemId === itemId))
          : [...prev.checks, { sessionId, itemId, checkedAt: new Date().toISOString() }];
        return { ...prev, sessions, checks };
      });
      setSyncError(null);

      // 2) Sincronización en orden
      const run = async () => {
        let sid = sessionForDay(dataRef.current?.sessions ?? snapshot.sessions, dayId)?.id;
        if (!sid || sid === PENDING) {
          const created = await data.sessions.start({ clientId, routineId: snapshot.routine!.id, dayId });
          sid = created.id;
          update((prev) => ({
            ...prev,
            sessions: prev.sessions.map((s) => (s.id === PENDING ? created : s)),
            checks: prev.checks.map((c) => (c.sessionId === PENDING ? { ...c, sessionId: created.id } : c)),
          }));
        }
        await data.sessions.setCheck(sid, itemId, !wasChecked);
        // ¿Quedó completo el día?
        const all = await data.sessions.listChecks([sid]);
        const total = itemsOfDay(day).length;
        const complete = total > 0 && itemsOfDay(day).every((i) => all.some((c) => c.itemId === i.id));
        const session = dataRef.current?.sessions.find((s) => s.id === sid);
        if (complete !== !!session?.completedAt) {
          const updated = await data.sessions.complete(sid, complete);
          update((prev) => ({ ...prev, sessions: prev.sessions.map((s) => (s.id === sid ? updated : s)) }));
        }
      };

      const prevRun = queues.current.get(dayId) ?? Promise.resolve();
      const next = prevRun.then(run).catch(() => {
        setSyncError("No se pudo guardar el check. Revisá la conexión y probá de nuevo.");
        void query.reload();
      });
      queues.current.set(dayId, next);
    },
    [query, clientId, viewingAs, update],
  );

  return useMemo(
    () => ({
      loading: !ready || (query.loading && !query.data),
      error: query.error,
      data: query.data ?? null,
      clientId,
      viewingAs,
      /** «Ver como» un cliente que no es de este profe (o no existe). */
      noAccess: viewingAs && !!query.data && !query.data.client,
      readOnly: viewingAs,
      toggleItem,
      syncError,
    }),
    [ready, query.loading, query.data, query.error, clientId, viewingAs, toggleItem, syncError],
  );
}
