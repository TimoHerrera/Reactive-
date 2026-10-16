"use client";

import { InlineLoading } from "@/components/Loading";
import { QueryError } from "@/components/QueryError";
import { cn } from "@/lib/cn";
import { data, type Exercise, type RoutineItem, type RoutineTree, type SetLog } from "@/lib/data";
import { formatShortWeekday, toISODate } from "@/lib/dates";
import { useQuery } from "@/lib/hooks";
import { effortLabel } from "@/lib/routine/effort";
import { itemsOfDay, setsReps } from "@/lib/routine/locate";
import { summarizeSession } from "@/lib/routine/setlogs";

/** Cuántas sesiones se muestran (las más recientes). */
const MAX_SESSIONS = 12;

function planned(item: RoutineItem): string {
  return [setsReps(item), item.load, effortLabel(item)].filter(Boolean).join(" · ");
}

function setLine(l: SetLog): string {
  const work = l.reps && l.load ? `${l.reps} × ${l.load}` : (l.reps ?? l.load ?? "—");
  return l.rpe != null ? `${work} · RPE ${l.rpe}` : work;
}

/** Pestaña «Registro» de la ficha: lo planificado vs. lo hecho, por sesión y ejercicio. */
export function ClientLog({ clientId }: { clientId: string }) {
  const q = useQuery(async () => {
    const sessions = (await data.sessions.list({ clientId }))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, MAX_SESSIONS);
    const ids = sessions.map((s) => s.id);
    const routineIds = [...new Set(sessions.map((s) => s.routineId))];
    const [checks, logs, exercises, trees] = await Promise.all([
      data.sessions.listChecks(ids),
      data.sessions.listSetLogs(ids),
      data.exercises.list(),
      Promise.all(routineIds.map((id) => data.routines.getTree(id))),
    ]);
    const treeById = new Map((trees.filter(Boolean) as RoutineTree[]).map((t) => [t.id, t]));
    return { sessions, checks, logs, exercises: new Map(exercises.map((e) => [e.id, e] as [string, Exercise])), treeById };
  }, [clientId]);

  if (q.error && !q.data) return <QueryError what="el registro" onRetry={() => void q.reload()} />;
  if (!q.data) return <InlineLoading />;
  const { sessions, checks, logs, exercises, treeById } = q.data;

  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-line p-5 text-center text-small text-muted">
        Todavía no registró entrenamientos. Cuando marque ejercicios en «Mi Rutina» van a aparecer acá.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-small text-muted">
        Lo planificado y lo que hizo, por sesión. <span className="font-semibold text-danger-ink">RPE ↑</span> = el RPE real superó al objetivo por 2 o más.
      </p>
      {sessions.map((s) => {
        const tree = treeById.get(s.routineId);
        const day = tree?.days.find((d) => d.id === s.dayId);
        if (!day) return null;
        const items = itemsOfDay(day);
        const sLogs = logs.filter((l) => l.sessionId === s.id);
        const done = new Set(checks.filter((c) => c.sessionId === s.id).map((c) => c.itemId));
        const byItem = new Map(summarizeSession(items, sLogs).map((x) => [x.itemId, x]));
        const alerts = [...byItem.values()].filter((x) => x.alert).length;
        return (
          <section key={s.id} className={cn("rounded-lg border bg-surface", alerts ? "border-danger/70" : "border-line")} aria-label={`Día ${day.label} del ${formatShortWeekday(toISODate(new Date(s.startedAt)))}`}>
            <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
              <p className="text-title-sm">
                Día {day.label}
                {day.title ? ` · ${day.title}` : ""}
              </p>
              <p className="shrink-0 text-small text-muted">
                {formatShortWeekday(toISODate(new Date(s.startedAt)))} · {done.size}/{items.length}
              </p>
            </header>
            <ul>
              {items.map((it) => {
                const sum = byItem.get(it.id);
                const name = (it.exerciseId && exercises.get(it.exerciseId)?.name) || it.rawName;
                return (
                  <li key={it.id} className="border-b border-line px-4 py-3 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className={cn("min-w-0 font-semibold", !done.has(it.id) && "text-muted")}>{name}</p>
                      {sum?.alert && (
                        <span className="shrink-0 rounded-full bg-danger/20 px-2 py-0.5 text-caption font-bold text-danger-ink">
                          RPE ↑ {sum.maxRpe} (obj. {it.rpeTarget})
                        </span>
                      )}
                    </div>
                    <dl className="mt-1 grid grid-cols-[5.5rem_1fr] gap-x-2 text-small">
                      <dt className="text-muted">Planificado</dt>
                      <dd className="text-title">{planned(it) || "—"}</dd>
                      <dt className="text-muted">Hecho</dt>
                      <dd>
                        {sum ? (
                          <ol className="space-y-0.5">
                            {sum.logs.map((l) => (
                              <li key={l.setNumber} className="tabular-nums">
                                <span className="text-muted">S{l.setNumber}</span> {setLine(l)}
                              </li>
                            ))}
                          </ol>
                        ) : done.has(it.id) ? (
                          <span className="text-title">Hecho, sin registro</span>
                        ) : (
                          <span className="text-muted">No lo marcó</span>
                        )}
                      </dd>
                    </dl>
                    {sum?.note && <p className="mt-2 rounded-sm bg-surface-2 px-3 py-2 text-small text-title">«{sum.note}»</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
