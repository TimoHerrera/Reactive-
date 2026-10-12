"use client";

import { useMemo, useState } from "react";
import { Avatar, Input, PillButton } from "@/components/ui";
import { IconCheck } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Exercise, Profile, Routine } from "@/lib/data";
import { diffDays, formatDM } from "@/lib/dates";
import { draftStats, type RoutineDraft } from "@/lib/routine/draft";
import { replacementInfo } from "@/lib/routine/replace";
import { normalizeText } from "@/lib/text";
import { WizardFooter } from "./WizardHeader";

export function StepPublish({
  draft,
  update,
  clients,
  routines,
  exercises,
  onReview,
  onChangeDates,
  onPublish,
  publishing,
  error,
}: {
  draft: RoutineDraft;
  update: (fn: (d: RoutineDraft) => RoutineDraft) => void;
  clients: Profile[];
  routines: Routine[];
  exercises: Exercise[];
  onReview: () => void;
  onChangeDates: () => void;
  onPublish: () => void;
  publishing: boolean;
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const stats = draftStats(draft, exercises);
  const isTemplateEdit = !!draft.routineId && !!draft.isTemplate;
  const editingOwner = draft.routineId && !draft.isTemplate ? draft.clientIds[0] : null;
  const weeks = Math.round((diffDays(draft.startsOn, draft.endsOn) + 1) / 7);

  const list = useMemo(() => {
    const q = normalizeText(query);
    const filtered = clients.filter((c) => !q || normalizeText(c.fullName).includes(q));
    // Seleccionados primero.
    return filtered.sort((a, b) => Number(draft.clientIds.includes(b.id)) - Number(draft.clientIds.includes(a.id)));
  }, [clients, query, draft.clientIds]);

  const toggle = (id: string) =>
    update((d) => ({ ...d, clientIds: d.clientIds.includes(id) ? d.clientIds.filter((x) => x !== id) : [...d.clientIds, id] }));

  const count = draft.clientIds.length;
  const action = isTemplateEdit
    ? "Guardar plantilla"
    : count === 0
      ? draft.saveAsTemplate
        ? "Guardar plantilla"
        : "Elegí a quién"
      : "Publicar";
  const canPublish = isTemplateEdit || count > 0 || draft.saveAsTemplate;

  return (
    <>
      <div className="space-y-5 px-gutter pb-32 pt-6">
        <h1 className="display text-display-section">Último paso</h1>

        <section className="rounded-lg border border-line bg-surface p-4">
          <p className="display text-h2">{draft.name}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <dd className="display text-h1 leading-none">{stats.days}</dd>
              <dt className="text-small text-muted">días</dt>
            </div>
            <div>
              <dd className="display text-h1 leading-none">{stats.items}</dd>
              <dt className="text-small text-muted">ejercicios</dt>
            </div>
            <div>
              <dd className="display text-h1 leading-none text-success">{stats.withVideo}</dd>
              <dt className="text-small text-muted">con video</dt>
            </div>
          </dl>
          {stats.unlinked > 0 && (
            <p className="mt-3 text-small text-warning">
              {stats.unlinked} {stats.unlinked === 1 ? "ejercicio queda" : "ejercicios quedan"} sin vincular (sin video).
            </p>
          )}
          <button type="button" onClick={onReview} className="mt-3 h-11 text-small font-semibold text-title underline underline-offset-4">
            Revisar ejercicios
          </button>
        </section>

        {!isTemplateEdit && (
          <>
            <section aria-labelledby="asignar">
              <p id="asignar" className="label mb-2">
                Asignar a
              </p>
              <Input search placeholder="Buscar cliente" aria-label="Buscar cliente" value={query} onChange={(e) => setQuery(e.target.value)} />
              <ul className="mt-3 max-h-[340px] overflow-y-auto rounded-lg border border-line bg-surface">
                {list.map((c) => {
                  const checked = draft.clientIds.includes(c.id);
                  const locked = editingOwner === c.id;
                  const info = replacementInfo(
                    routines.filter((r) => r.clientId === c.id),
                    undefined,
                    draft.routineId,
                  );
                  return (
                    <li key={c.id} className="border-b border-line last:border-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        disabled={locked}
                        onClick={() => toggle(c.id)}
                        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-2 text-left disabled:cursor-default"
                      >
                        <Avatar name={c.fullName} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-title-sm">{c.fullName}</span>
                          <span
                            className={cn(
                              "block truncate text-small",
                              locked ? "text-muted" : checked && info.kind === "active" ? "text-warning" : "text-muted",
                            )}
                          >
                            {locked ? "Editando su rutina" : info.note}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-sm",
                            checked ? "bg-accent text-ink" : "border-2 border-line text-transparent",
                          )}
                        >
                          <IconCheck className="h-4 w-4" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
              <div>
                <p className="text-title-sm">Vigencia</p>
                <p className="text-small text-muted">
                  {formatDM(draft.startsOn)} → {formatDM(draft.endsOn)} · {weeks} {weeks === 1 ? "semana" : "semanas"}
                </p>
              </div>
              <button type="button" onClick={onChangeDates} className="h-11 px-2 text-small font-bold text-title">
                Cambiar
              </button>
            </section>

            {!draft.routineId && (
              <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
                <span>
                  <span className="block text-title-sm">Guardar también como plantilla</span>
                  <span className="block text-small text-muted">Para reusarla con otro cliente</span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.saveAsTemplate}
                  onChange={(e) => update((d) => ({ ...d, saveAsTemplate: e.target.checked }))}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="relative h-8 w-14 shrink-0 rounded-full bg-surface-2 transition-colors after:absolute after:left-1 after:top-1 after:h-6 after:w-6 after:rounded-full after:bg-ink after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-6 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ink"
                />
              </label>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-danger bg-danger/10 px-4 py-3 text-small font-medium text-danger-ink">
            ✕ {error}
          </p>
        )}
      </div>

      <WizardFooter>
        <PillButton block arrow onClick={onPublish} disabled={!canPublish || publishing}>
          {publishing ? "Publicando…" : action}
        </PillButton>
      </WizardFooter>
    </>
  );
}
