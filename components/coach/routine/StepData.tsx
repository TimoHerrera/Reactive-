"use client";

import { useState } from "react";
import { Input, PillButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Profile } from "@/lib/data";
import { diffDays } from "@/lib/dates";
import {
  daysLostWith,
  endFromWeeks,
  setDaysPerWeek,
  validateData,
  DAY_LABELS,
  type RoutineDraft,
  type StepErrors,
} from "@/lib/routine/draft";
import { ClientPicker } from "./ClientPicker";
import { WizardFooter } from "./WizardHeader";

/** «Se crean Día A, B y C.» */
function daysHint(labels: string[]): string {
  if (labels.length === 1) return `Se crea el Día ${labels[0]}.`;
  return `Se crean Día ${labels.slice(0, -1).join(", ")} y ${labels.at(-1)}.`;
}

const fieldDate =
  "h-12 w-full rounded-md border border-line bg-surface px-4 text-body font-medium text-ink outline-none [color-scheme:dark] focus:border-accent";

export function StepData({
  draft,
  update,
  clients,
  onNext,
}: {
  draft: RoutineDraft;
  update: (fn: (d: RoutineDraft) => RoutineDraft) => void;
  clients: Profile[];
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<StepErrors>({});
  const weeks = draft.startsOn && draft.endsOn ? (diffDays(draft.startsOn, draft.endsOn) + 1) / 7 : 0;
  const labels = DAY_LABELS.slice(0, draft.daysPerWeek);
  const isTemplateEdit = draft.isTemplate && !!draft.routineId;

  const next = () => {
    const e = validateData(draft);
    if (isTemplateEdit) delete e.dates;
    setErrors(e);
    if (Object.keys(e).length === 0) onNext();
  };

  const setDays = (n: number) => {
    const lost = daysLostWith(draft, n);
    if (lost.length && !window.confirm(`Se van a borrar los ejercicios de ${lost.map((d) => `Día ${d.label}`).join(", ")}. ¿Seguimos?`)) return;
    update((d) => setDaysPerWeek(d, n));
  };

  return (
    <>
      <div className="space-y-6 px-gutter pb-32 pt-6">
        <h1 className="display text-display-section">Datos generales</h1>

        <Input
          label="Nombre de la rutina"
          value={draft.name}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          placeholder="Readaptación – Fase 2"
          error={errors.name}
          autoFocus={!draft.name}
        />

        {!isTemplateEdit && (
          <>
            <ClientPicker clients={clients} value={draft.clientIds} onChange={(ids) => update((d) => ({ ...d, clientIds: ids }))} />

            <div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="inicio" className="label mb-2 block">
                    Inicio
                  </label>
                  <input
                    id="inicio"
                    type="date"
                    value={draft.startsOn}
                    onChange={(e) => {
                      const start = e.target.value;
                      update((d) => ({ ...d, startsOn: start, endsOn: weeks > 0 && Number.isInteger(weeks) ? endFromWeeks(start, weeks) : d.endsOn }));
                    }}
                    className={fieldDate}
                  />
                </div>
                <div>
                  <label htmlFor="fin" className="label mb-2 block">
                    Fin
                  </label>
                  <input
                    id="fin"
                    type="date"
                    value={draft.endsOn}
                    min={draft.startsOn}
                    onChange={(e) => update((d) => ({ ...d, endsOn: e.target.value }))}
                    className={cn(fieldDate, errors.dates && "border-danger")}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2" role="group" aria-label="Duración">
                {[2, 4, 6].map((w) => (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={weeks === w}
                    onClick={() => update((d) => ({ ...d, endsOn: endFromWeeks(d.startsOn, w) }))}
                    className={cn(
                      "h-11 rounded-full px-4 text-small font-semibold",
                      weeks === w ? "bg-ink text-bg" : "border border-line text-title hover:bg-surface-2",
                    )}
                  >
                    {w} semanas
                  </button>
                ))}
              </div>
              {errors.dates && <p className="mt-2 text-small text-danger-ink">✕ {errors.dates}</p>}
            </div>
          </>
        )}

        <fieldset>
          <legend className="label mb-2">Días por semana</legend>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={draft.daysPerWeek === n}
                onClick={() => setDays(n)}
                className={cn(
                  "display h-14 rounded-md text-[1.5rem]",
                  draft.daysPerWeek === n ? "bg-accent text-ink" : "border border-line bg-surface-2 hover:bg-line",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-small text-muted">{daysHint(labels)} Después los podés renombrar.</p>
        </fieldset>

        <div>
          <label htmlFor="msg" className="label mb-2 block">
            Mensaje para el cliente (opcional)
          </label>
          <textarea
            id="msg"
            rows={3}
            value={draft.clientMessage}
            onChange={(e) => update((d) => ({ ...d, clientMessage: e.target.value }))}
            placeholder="Si el tobillo molesta en la búlgara, bajá a peso corporal…"
            className="w-full rounded-md border border-line bg-surface px-4 py-3 text-body text-ink outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <p className="mt-2 text-small text-muted">Aparece como «Nota del profe» en la pantalla Hoy.</p>
        </div>
      </div>

      <WizardFooter>
        <PillButton block arrow onClick={next}>
          Siguiente: días y ejercicios
        </PillButton>
      </WizardFooter>
    </>
  );
}
