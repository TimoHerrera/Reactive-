"use client";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EmptyRoutine } from "@/components/client/EmptyRoutine";
import { HowDidItGo } from "@/components/client/HowDidItGo";
import { SyncToast } from "@/components/client/SyncToast";
import { useClientRoutine } from "@/components/client/useClientRoutine";
import { PickClientNotice, ViewAsBanner, ViewAsNoAccess } from "@/components/client/ViewAsBanner";
import { Loading } from "@/components/Loading";
import { DayChip, ExerciseCard, type ExerciseChip } from "@/components/ui";
import { data, hasVideo, type Exercise, type RoutineItem } from "@/lib/data";
import { formatDM } from "@/lib/dates";
import { useQuery } from "@/lib/hooks";
import { dayProgress, sessionForDay, suggestedDay } from "@/lib/routine/progress";
import { clearRutinaNav, saveRutinaPos, takeRutinaPos } from "@/lib/routine/scroll";
import { effortLabel } from "@/lib/routine/effort";

function chipsFor(item: RoutineItem): ExerciseChip[] {
  const out: ExerciseChip[] = [];
  if (item.sets && item.reps) out.push({ text: `${item.sets} × ${item.reps}` });
  else if (item.reps) out.push({ text: item.reps });
  else if (item.sets) out.push({ text: `${item.sets} series` });
  if (item.load) out.push({ text: item.load });
  if (item.rest) out.push({ text: `Desc. ${item.rest}`, muted: true });
  if (item.tempo) out.push({ text: `Tempo ${item.tempo}`, muted: true });
  return out;
}

export function RutinaView() {
  const router = useRouter();
  const params = useSearchParams();
  const r = useClientRoutine();
  const exercises = useQuery(() => data.exercises.list(), []);
  const byId = useMemo(() => new Map((exercises.data ?? []).map((e) => [e.id, e] as [string, Exercise])), [exercises.data]);

  const routine = r.data?.routine ?? null;
  const urlDay = params.get("dia");
  const fallbackDay = useMemo(
    () => (routine ? suggestedDay(routine, r.data?.sessions ?? []) : null),
    // Solo al cargar: no queremos que el día cambie solo mientras se marcan checks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routine?.id],
  );
  const day = routine?.days.find((d) => d.id === urlDay) ?? fallbackDay ?? routine?.days[0] ?? null;

  // Restaurar posición al volver del video (mismo día y mismo scroll) y resaltar el ejercicio.
  const [highlight, setHighlight] = useState<string | null>(null);
  // «¿Cómo te fue?»: se abre al marcar un ejercicio (desmarcar es directo).
  const [logFor, setLogFor] = useState<{ dayId: string; item: RoutineItem; name: string } | null>(null);
  const restored = useRef(false);
  const ready = !!routine && !!exercises.data;
  useLayoutEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    clearRutinaNav();
    const pos = takeRutinaPos();
    const itemId = params.get("item") ?? pos?.itemId ?? null;
    if (pos && (!urlDay || pos.dayId === urlDay)) {
      if (!urlDay) router.replace(`/app/rutina?dia=${pos.dayId}`, { scroll: false });
      window.scrollTo(0, pos.y);
    } else if (itemId) {
      document.getElementById(`item-${itemId}`)?.scrollIntoView({ block: "center" });
    }
    if (itemId) setHighlight(itemId);
  }, [ready, params, router, urlDay]);
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), 1600);
    return () => clearTimeout(t);
  }, [highlight]);

  if (r.viewingAs && !r.clientId) return <PickClientNotice />;
  if (r.noAccess) return <ViewAsNoAccess />;
  if (r.loading || (!exercises.data && exercises.loading)) return <Loading />;
  if (!routine || !day) {
    return (
      <>
        {r.viewingAs && <ViewAsBanner client={r.data?.client ?? null} />}
        <EmptyRoutine />
      </>
    );
  }

  const session = sessionForDay(r.data!.sessions, day.id);
  const { done, total } = dayProgress(day, r.data!.checks, session?.id ?? null);
  const isChecked = (itemId: string) => !!session && r.data!.checks.some((c) => c.sessionId === session.id && c.itemId === itemId);
  const { author, editor } = r.data!;

  let n = 0;
  return (
    <div className="pb-8">
      {r.viewingAs && <ViewAsBanner client={r.data!.client} />}

      <header className="bg-grid px-gutter pb-4 pt-10">
        <p className="label">Mi rutina</p>
        <h1 className="display mt-2 text-h1">{routine.name}</h1>
        <p className="mt-3 flex items-center gap-2 text-small text-muted" data-testid="routine-author">
          {author && <ProfileAvatar avatarPath={author.avatarPath} name={author.fullName} size="xs" pro />}
          <span>
            {author && (
              <>
                Cargada por <strong className="font-semibold text-ink">{author.fullName}</strong>
                {editor && (
                  <>
                    {" "}
                    · editada por <strong className="font-semibold text-ink">{editor.fullName}</strong>
                  </>
                )}{" "}
                ·{" "}
              </>
            )}
            Vigente {formatDM(routine.startsOn)} → {formatDM(routine.endsOn)}
          </span>
        </p>
      </header>

      {/* Días + progreso: quedan fijos arriba al scrollear */}
      <div className="sticky top-0 z-20 border-b border-line bg-bg/95 px-gutter pb-3 pt-3 backdrop-blur">
        <div className="flex gap-2" role="group" aria-label="Días de la rutina">
          {routine.days.map((d) => (
            <DayChip
              key={d.id}
              label={`Día ${d.label}`}
              title={d.title}
              active={d.id === day.id}
              onClick={() => {
                router.replace(`/app/rutina?dia=${d.id}`, { scroll: false });
                window.scrollTo({ top: 0 });
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-label={`Día ${day.label}`}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <div className="h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <p className="shrink-0 text-small font-semibold" aria-live="polite">
            {done === total && total > 0 ? "¡Día completo!" : `${done} de ${total} hechos`}
          </p>
        </div>
      </div>

      <div className="space-y-8 px-gutter pt-6">
        {day.blocks.map((block) => (
          <section key={block.id} aria-labelledby={`block-${block.id}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 id={`block-${block.id}`} className="display text-h2 text-title">
                {block.name}
              </h2>
              <p className="shrink-0 text-small text-muted">
                {block.items.length} {block.items.length === 1 ? "ejercicio" : "ejercicios"}
              </p>
            </div>
            <div className="mt-3 space-y-3">
              {block.items.map((item) => {
                n += 1;
                const ex = item.exerciseId ? byId.get(item.exerciseId) : undefined;
                const href = ex && hasVideo(ex) ? `/app/ejercicios/${ex.id}?from=rutina&item=${item.id}` : undefined;
                return (
                  <ExerciseCard
                    key={item.id}
                    id={`item-${item.id}`}
                    number={n}
                    name={ex?.name ?? item.rawName}
                    href={href}
                    chips={chipsFor(item)}
                    effort={effortLabel(item)}
                    note={item.notes ?? undefined}
                    done={isChecked(item.id)}
                    highlight={highlight === item.id}
                    readOnly={r.readOnly}
                    onToggle={
                      r.readOnly
                        ? undefined
                        : () => (isChecked(item.id) ? r.toggleItem(day.id, item.id) : setLogFor({ dayId: day.id, item, name: ex?.name ?? item.rawName }))
                    }
                    onOpen={() => {
                      // Fijamos el día en la URL para que «atrás» vuelva exactamente a este día.
                      if (urlDay !== day.id) window.history.replaceState(null, "", `/app/rutina?dia=${day.id}`);
                      saveRutinaPos({ dayId: day.id, y: window.scrollY, itemId: item.id });
                    }}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {logFor && (
        <HowDidItGo
          name={logFor.name}
          item={logFor.item}
          previous={session ? r.data!.setLogs.filter((l) => l.sessionId === session.id && l.itemId === logFor.item.id) : []}
          onClose={() => setLogFor(null)}
          onSkip={() => {
            r.toggleItem(logFor.dayId, logFor.item.id);
            setLogFor(null);
          }}
          onSave={(logs) => {
            r.toggleItem(logFor.dayId, logFor.item.id, logs);
            setLogFor(null);
          }}
        />
      )}

      <SyncToast message={r.syncError} />
    </div>
  );
}
